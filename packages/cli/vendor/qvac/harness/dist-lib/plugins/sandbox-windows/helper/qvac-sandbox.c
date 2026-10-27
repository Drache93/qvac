// qvac-sandbox: runs one cmd line inside the harness's AppContainer.
//
//   qvac-sandbox --probe
//   qvac-sandbox --prepare [--deny <root>]... [--pin <folder>]...
//                [--write <capability> <root>]... [--read <capability> <root>]...
//   qvac-sandbox [--cap <capability>]... [--net] [--cwd <dir>] -- <line>
//
// --prepare changes ACLs and runs nothing; a line run changes no ACL, so killing it never
// leaves a tree half written. Each root is granted to its own capability SID, and the child's
// token carries only the capabilities of this run, so a grant an earlier run left on a folder
// does nothing here. A denied root gets a protected DACL that holds no capability, so no grant
// reaches it. With no --cwd the line starts in its TEMP. A failure before the child starts
// exits REFUSED with a `qvac-sandbox:` line on stderr.
//
// MSVC: cl /nologo /std:c11 /O2 /W4 qvac-sandbox.c

#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <aclapi.h>
#include <sddl.h>
#include <userenv.h>
#include <objbase.h>
#include <shlobj.h>
#include <knownfolders.h>
#include <stdio.h>
#include <stdlib.h>
#include <wchar.h>

#ifdef _MSC_VER
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "userenv.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "uuid.lib")
#endif

// AppContainerSandbox's REFUSED holds the same number
#define REFUSED 125
#define PROFILE L"qvac.harness.sandbox"
#define MAX_ROOTS 256
#define NETWORK_CAPABILITIES 3

#define READ_MASK (FILE_GENERIC_READ | FILE_GENERIC_EXECUTE)
// No FILE_DELETE_CHILD: a denied folder inside a write root cannot be removed or renamed away
#define WRITE_MASK (READ_MASK | FILE_GENERIC_WRITE | DELETE)
#define DENY_MASK FILE_ALL_ACCESS
#define INHERIT (OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE)
#define ROOT_ONLY 0

typedef BOOL(WINAPI *derive_capability_t)(LPCWSTR, PSID **, DWORD *, PSID **, DWORD *);

typedef struct {
  const wchar_t *capability;
  const wchar_t *root;
} grant_t;

typedef struct {
  grant_t write[MAX_ROOTS];
  grant_t read[MAX_ROOTS];
  const wchar_t *deny[MAX_ROOTS];
  const wchar_t *pin[MAX_ROOTS];
  const wchar_t *cap[2 * MAX_ROOTS];
  int writes, reads, denies, pins, caps;
  BOOL network, probe, prepare;
  const wchar_t *cwd, *line;
} request_t;

static int
refuse(const wchar_t *what, const wchar_t *subject, DWORD error) {
  fwprintf(stderr, L"qvac-sandbox: %ls%ls%ls (error %lu)\n", what, subject ? L" " : L"", subject ? subject : L"", error);
  return REFUSED;
}

static BOOL
parse(int argc, wchar_t **argv, request_t *req) {
  for (int i = 1; i < argc; i++) {
    const wchar_t *arg = argv[i];
    if (wcscmp(arg, L"--probe") == 0) {
      req->probe = TRUE;
    } else if (wcscmp(arg, L"--prepare") == 0) {
      req->prepare = TRUE;
    } else if (wcscmp(arg, L"--net") == 0) {
      req->network = TRUE;
    } else if (wcscmp(arg, L"--write") == 0 && i + 2 < argc && req->writes < MAX_ROOTS) {
      req->write[req->writes++] = (grant_t){argv[i + 1], argv[i + 2]};
      i += 2;
    } else if (wcscmp(arg, L"--read") == 0 && i + 2 < argc && req->reads < MAX_ROOTS) {
      req->read[req->reads++] = (grant_t){argv[i + 1], argv[i + 2]};
      i += 2;
    } else if (wcscmp(arg, L"--deny") == 0 && i + 1 < argc && req->denies < MAX_ROOTS) {
      req->deny[req->denies++] = argv[++i];
    } else if (wcscmp(arg, L"--pin") == 0 && i + 1 < argc && req->pins < MAX_ROOTS) {
      req->pin[req->pins++] = argv[++i];
    } else if (wcscmp(arg, L"--cap") == 0 && i + 1 < argc && req->caps < 2 * MAX_ROOTS) {
      req->cap[req->caps++] = argv[++i];
    } else if (wcscmp(arg, L"--cwd") == 0 && i + 1 < argc) {
      req->cwd = argv[++i];
    } else if (wcscmp(arg, L"--") == 0 && i + 2 == argc) {
      req->line = argv[++i];
    } else {
      return FALSE;
    }
  }

  return req->probe || req->prepare || req->line;
}

// Made once per user; every later run derives the same SID from the name
static HRESULT
container(PSID *sid) {
  HRESULT hr = CreateAppContainerProfile(PROFILE, PROFILE, L"qvac harness exec sandbox", NULL, 0, sid);
  if (hr == HRESULT_FROM_WIN32(ERROR_ALREADY_EXISTS)) {
    hr = DeriveAppContainerSidFromAppContainerName(PROFILE, sid);
  }

  return hr;
}

// Kernelbase exports it with no import library in older SDKs
static PSID
capability(const wchar_t *name) {
  static derive_capability_t derive = NULL;
  if (!derive) {
    HMODULE kernelbase = GetModuleHandleW(L"kernelbase.dll");
    if (!kernelbase) return NULL;
    derive = (derive_capability_t) (void *) GetProcAddress(kernelbase, "DeriveCapabilitySidsFromName");
    if (!derive) return NULL;
  }

  PSID *groups = NULL, *sids = NULL;
  DWORD group_count = 0, sid_count = 0;
  if (!derive(name, &groups, &group_count, &sids, &sid_count) || sid_count < 1) return NULL;

  return sids[0];
}

// An explicit ACE whose inheritance flags are exactly `flags`
static BOOL
has_ace(PACL dacl, BYTE type, PSID sid, DWORD mask, BYTE flags) {
  if (!dacl) return FALSE;

  for (DWORD i = 0; i < dacl->AceCount; i++) {
    ACE_HEADER *header;
    if (!GetAce(dacl, i, (void **) &header)) continue;
    if (header->AceType != type || (header->AceFlags & VALID_INHERIT_FLAGS) != flags) continue;

    // An allowed and a denied ACE share this layout
    ACCESS_ALLOWED_ACE *ace = (ACCESS_ALLOWED_ACE *) header;
    if ((ace->Mask & mask) == mask && EqualSid((PSID) &ace->SidStart, sid)) return TRUE;
  }

  return FALSE;
}

// A root-only ACE written to this one object, with no walk below it. Written after a walk, it
// is the proof that the walk finished: a check of the root's own entry alone proves nothing.
static DWORD
mark(const wchar_t *path, BYTE type, PSID sid, DWORD mask) {
  PACL dacl = NULL, marked = NULL;
  PSECURITY_DESCRIPTOR descriptor = NULL;
  DWORD error = GetNamedSecurityInfoW(path, SE_FILE_OBJECT, DACL_SECURITY_INFORMATION, NULL, NULL, &dacl, NULL, &descriptor);
  if (error != ERROR_SUCCESS) return error;

  if (!dacl) {
    error = ERROR_INVALID_ACL;
  } else if (!has_ace(dacl, type, sid, mask, ROOT_ONLY)) {
    BOOL deny = type == ACCESS_DENIED_ACE_TYPE, placed = FALSE;
    DWORD size = dacl->AclSize + sizeof(ACCESS_ALLOWED_ACE) + GetLengthSid(sid);
    marked = LocalAlloc(LPTR, size);
    BOOL ok = marked && InitializeAcl(marked, size, dacl->AclRevision);

    // Canonical order: a deny goes first, an allow before the first inherited entry
    for (DWORD i = 0; ok && i <= dacl->AceCount; i++) {
      ACE_HEADER *header = NULL;
      if (i < dacl->AceCount) ok = GetAce(dacl, i, (void **) &header);
      if (ok && !placed && (deny || !header || (header->AceFlags & INHERITED_ACE))) {
        placed = TRUE;
        ok = deny ? AddAccessDeniedAceEx(marked, dacl->AclRevision, ROOT_ONLY, mask, sid)
                  : AddAccessAllowedAceEx(marked, dacl->AclRevision, ROOT_ONLY, mask, sid);
      }
      if (ok && header) ok = AddAce(marked, dacl->AclRevision, MAXDWORD, header, header->AceSize);
    }

    // SetFileSecurityW writes no child; the copied control bits keep the root protected or inheriting
    SECURITY_DESCRIPTOR fresh;
    SECURITY_DESCRIPTOR_CONTROL control = 0, kept = SE_DACL_PROTECTED | SE_DACL_AUTO_INHERITED;
    DWORD revision = 0;
    ok = ok && GetSecurityDescriptorControl(descriptor, &control, &revision) &&
         InitializeSecurityDescriptor(&fresh, SECURITY_DESCRIPTOR_REVISION) &&
         SetSecurityDescriptorDacl(&fresh, TRUE, marked, FALSE) &&
         SetSecurityDescriptorControl(&fresh, kept, control & kept) &&
         SetFileSecurityW(path, DACL_SECURITY_INFORMATION, &fresh);
    error = ok ? ERROR_SUCCESS : GetLastError();
  }

  LocalFree(marked);
  LocalFree(descriptor);

  return error;
}

// An inheritable ACE on the root and every file below it, then its proof. With no proof the
// ACL is written again, which walks the tree again, so a walk cut short is finished.
static DWORD
add_ace(const wchar_t *root, PSID sid, DWORD mask) {
  PACL dacl = NULL, merged = NULL;
  PSECURITY_DESCRIPTOR descriptor = NULL;
  DWORD error = GetNamedSecurityInfoW(root, SE_FILE_OBJECT, DACL_SECURITY_INFORMATION, NULL, NULL, &dacl, NULL, &descriptor);
  if (error != ERROR_SUCCESS) return error;

  if (!has_ace(dacl, ACCESS_ALLOWED_ACE_TYPE, sid, mask, ROOT_ONLY)) {
    if (!has_ace(dacl, ACCESS_ALLOWED_ACE_TYPE, sid, mask, INHERIT)) {
      EXPLICIT_ACCESSW access = {0};
      access.grfAccessPermissions = mask;
      access.grfAccessMode = GRANT_ACCESS;
      access.grfInheritance = SUB_CONTAINERS_AND_OBJECTS_INHERIT;
      access.Trustee.TrusteeForm = TRUSTEE_IS_SID;
      access.Trustee.TrusteeType = TRUSTEE_IS_UNKNOWN;
      access.Trustee.ptstrName = (LPWSTR) sid;

      error = SetEntriesInAclW(1, &access, dacl, &merged);
    }

    if (error == ERROR_SUCCESS) {
      error = SetNamedSecurityInfoW((LPWSTR) root, SE_FILE_OBJECT, DACL_SECURITY_INFORMATION, NULL, NULL, merged ? merged : dacl, NULL);
    }
    if (error == ERROR_SUCCESS) error = mark(root, ACCESS_ALLOWED_ACE_TYPE, sid, mask);

    LocalFree(merged);
  }

  LocalFree(descriptor);

  return error;
}

static BOOL
denies(const ACE_HEADER *header) {
  return header->AceType == ACCESS_DENIED_ACE_TYPE || header->AceType == ACCESS_DENIED_CALLBACK_ACE_TYPE;
}

// An allow for a capability SID (S-1-15-3-...), explicit or inherited
static BOOL
grants_capability(const ACE_HEADER *header) {
  static const SID_IDENTIFIER_AUTHORITY app_package = SECURITY_APP_PACKAGE_AUTHORITY;
  if (header->AceType != ACCESS_ALLOWED_ACE_TYPE && header->AceType != ACCESS_ALLOWED_CALLBACK_ACE_TYPE) return FALSE;

  // A callback ACE shares this layout
  PSID sid = (PSID) &((ACCESS_ALLOWED_ACE *) header)->SidStart;
  return memcmp(GetSidIdentifierAuthority(sid), &app_package, sizeof(app_package)) == 0 &&
         *GetSidSubAuthorityCount(sid) > 0 && *GetSidSubAuthority(sid, 0) == SECURITY_CAPABILITY_BASE_RID;
}

static BOOL
fenced(PSECURITY_DESCRIPTOR descriptor, PACL dacl, PSID container_sid) {
  SECURITY_DESCRIPTOR_CONTROL control = 0;
  DWORD revision = 0;
  if (!GetSecurityDescriptorControl(descriptor, &control, &revision) || !(control & SE_DACL_PROTECTED)) return FALSE;

  for (DWORD i = 0; i < dacl->AceCount; i++) {
    ACE_HEADER *header;
    if (GetAce(dacl, i, (void **) &header) && grants_capability(header)) return FALSE;
  }

  return has_ace(dacl, ACCESS_DENIED_ACE_TYPE, container_sid, DENY_MASK, INHERIT) &&
         has_ace(dacl, ACCESS_DENIED_ACE_TYPE, container_sid, DENY_MASK, ROOT_ONLY);
}

// The container's deny ACE alone holds writes but not reads. A denied root instead inherits
// nothing and keeps no capability allow, so no grant on it or above it opens it; every other
// entry stays, made explicit, so its owner keeps their access. Skipped once its proof is there.
static DWORD
protect(const wchar_t *root, PSID container_sid) {
  PACL dacl = NULL, rebuilt = NULL;
  PSECURITY_DESCRIPTOR descriptor = NULL;
  DWORD error = GetNamedSecurityInfoW(root, SE_FILE_OBJECT, DACL_SECURITY_INFORMATION, NULL, NULL, &dacl, NULL, &descriptor);
  if (error != ERROR_SUCCESS) return error;

  // A null DACL lets everyone in; a deny-only DACL in its place would lock the owner out
  if (!dacl) {
    error = ERROR_INVALID_ACL;
  } else if (!fenced(descriptor, dacl, container_sid)) {
    DWORD size = dacl->AclSize + sizeof(ACCESS_DENIED_ACE) + GetLengthSid(container_sid);
    rebuilt = LocalAlloc(LPTR, size);
    BOOL ok = rebuilt && InitializeAcl(rebuilt, size, dacl->AclRevision) &&
              AddAccessDeniedAceEx(rebuilt, dacl->AclRevision, INHERIT, DENY_MASK, container_sid);

    // Every entry is explicit now, so denies go first or an allow before them wins
    for (int pass = 0; ok && pass < 2; pass++) {
      for (DWORD i = 0; ok && i < dacl->AceCount; i++) {
        ACE_HEADER *header, *added;
        if (!GetAce(dacl, i, (void **) &header) || denies(header) != (pass == 0) || grants_capability(header)) continue;
        if (denies(header) && EqualSid((PSID) &((ACCESS_DENIED_ACE *) header)->SidStart, container_sid)) continue;

        ok = AddAce(rebuilt, dacl->AclRevision, MAXDWORD, header, header->AceSize) &&
             GetAce(rebuilt, rebuilt->AceCount - 1, (void **) &added);
        if (ok) added->AceFlags &= ~INHERITED_ACE;
      }
    }

    error = ok ? SetNamedSecurityInfoW((LPWSTR) root, SE_FILE_OBJECT, DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION, NULL, NULL, rebuilt, NULL)
               : GetLastError();
    if (error == ERROR_SUCCESS) error = mark(root, ACCESS_DENIED_ACE_TYPE, container_sid, DENY_MASK);
  }

  LocalFree(rebuilt);
  LocalFree(descriptor);

  return error;
}

static BOOL
missing(DWORD error) {
  return error == ERROR_FILE_NOT_FOUND || error == ERROR_PATH_NOT_FOUND;
}

// Fences each denied root, pins the folders above it, then grants each root to its capability.
// Fenced first, a parent's new grant stops at the protected root.
static int
prepare(const request_t *req, PSID container_sid) {
  for (int i = 0; i < req->denies; i++) {
    DWORD error = protect(req->deny[i], container_sid);
    if (error != ERROR_SUCCESS && !missing(error)) return refuse(L"could not deny", req->deny[i], error);
  }

  // A line that renames a folder above a denied root would move the root out from under its path
  for (int i = 0; i < req->pins; i++) {
    DWORD error = mark(req->pin[i], ACCESS_DENIED_ACE_TYPE, container_sid, DELETE);
    if (error != ERROR_SUCCESS && !missing(error)) return refuse(L"could not pin", req->pin[i], error);
  }

  for (int i = 0; i < req->writes + req->reads; i++) {
    BOOL writes = i < req->writes;
    const grant_t *each = writes ? &req->write[i] : &req->read[i - req->writes];
    PSID sid = capability(each->capability);
    if (!sid) return refuse(L"could not derive the capability for", each->root, GetLastError());

    DWORD error = add_ace(each->root, sid, writes ? WRITE_MASK : READ_MASK);
    // A read root that does not exist yet has nothing to grant
    if (error != ERROR_SUCCESS && (writes || !missing(error))) return refuse(L"could not grant", each->root, error);
  }

  return 0;
}

static int
capabilities(const request_t *req, SID_AND_ATTRIBUTES *caps, DWORD *count) {
  for (int i = 0; i < req->caps; i++) {
    PSID sid = capability(req->cap[i]);
    if (!sid) return refuse(L"could not derive the capability", req->cap[i], GetLastError());

    caps[(*count)++] = (SID_AND_ATTRIBUTES){sid, SE_GROUP_ENABLED};
  }

  return 0;
}

static int
network(SID_AND_ATTRIBUTES *caps, DWORD *count, BYTE storage[][SECURITY_MAX_SID_SIZE]) {
  static const WELL_KNOWN_SID_TYPE kinds[NETWORK_CAPABILITIES] = {
    WinCapabilityInternetClientSid,
    WinCapabilityInternetClientServerSid,
    WinCapabilityPrivateNetworkClientServerSid,
  };

  for (int i = 0; i < NETWORK_CAPABILITIES; i++) {
    DWORD size = SECURITY_MAX_SID_SIZE;
    if (!CreateWellKnownSid(kinds[i], NULL, storage[i], &size)) {
      return refuse(L"could not make a network capability", NULL, GetLastError());
    }

    caps[(*count)++] = (SID_AND_ATTRIBUTES){storage[i], SE_GROUP_ENABLED};
  }

  return 0;
}

// Windows builds the container's environment from these; the run's env allowlist leaves them out
static int
app_data(void) {
  static const struct {
    const wchar_t *name;
    const KNOWNFOLDERID *folder;
  } dirs[] = {
    {L"LOCALAPPDATA", &FOLDERID_LocalAppData},
    {L"APPDATA", &FOLDERID_RoamingAppData},
  };

  for (size_t i = 0; i < sizeof(dirs) / sizeof(dirs[0]); i++) {
    if (GetEnvironmentVariableW(dirs[i].name, NULL, 0) > 0) continue;

    PWSTR path = NULL;
    HRESULT hr = SHGetKnownFolderPath(dirs[i].folder, 0, NULL, &path);
    if (FAILED(hr)) return refuse(L"could not find", dirs[i].name, (DWORD) hr);

    BOOL set = SetEnvironmentVariableW(dirs[i].name, path);
    CoTaskMemFree(path);
    if (!set) return refuse(L"could not set", dirs[i].name, GetLastError());
  }

  return 0;
}

// TEMP and TMP point into the container's own folder, which it can write with no grant
static int
temp_dir(PSID container_sid, wchar_t temp[MAX_PATH * 2]) {
  LPWSTR sid_string = NULL, folder = NULL;
  if (!ConvertSidToStringSidW(container_sid, &sid_string)) {
    return refuse(L"could not name the container", NULL, GetLastError());
  }

  HRESULT hr = GetAppContainerFolderPath(sid_string, &folder);
  LocalFree(sid_string);
  if (FAILED(hr)) return refuse(L"could not find the container folder", NULL, (DWORD) hr);

  int written = swprintf(temp, MAX_PATH * 2, L"%ls\\Temp", folder);
  CoTaskMemFree(folder);
  if (written < 0) return refuse(L"the container folder path is too long", NULL, ERROR_BUFFER_OVERFLOW);

  if (!CreateDirectoryW(temp, NULL) && GetLastError() != ERROR_ALREADY_EXISTS) {
    return refuse(L"could not make", temp, GetLastError());
  }

  if (!SetEnvironmentVariableW(L"TEMP", temp) || !SetEnvironmentVariableW(L"TMP", temp)) {
    return refuse(L"could not set TEMP", NULL, GetLastError());
  }

  return 0;
}

// The child gets the stdio handles and nothing else this process holds
static DWORD
stdio_handles(HANDLE std[3], HANDLE inherit[3]) {
  DWORD count = 0;
  for (int i = 0; i < 3; i++) {
    HANDLE handle = std[i];
    if (handle == NULL || handle == INVALID_HANDLE_VALUE) continue;

    BOOL listed = FALSE;
    for (DWORD j = 0; j < count; j++) listed |= inherit[j] == handle;
    if (listed || !SetHandleInformation(handle, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT)) continue;

    inherit[count++] = handle;
  }

  return count;
}

// Runs `%COMSPEC% /d /s /c "<line>"`, as Node's shell: true does, in a Job that dies with this process
static int
run(PSID container_sid, SID_AND_ATTRIBUTES *caps, DWORD count, const wchar_t *cwd, const wchar_t *line) {
  wchar_t comspec[MAX_PATH];
  DWORD length = GetEnvironmentVariableW(L"COMSPEC", comspec, MAX_PATH);
  if (length == 0 || length >= MAX_PATH) {
    length = GetSystemDirectoryW(comspec, MAX_PATH);
    if (length == 0 || length + 9 > MAX_PATH) return refuse(L"could not find cmd.exe", NULL, GetLastError());
    wcscat_s(comspec, MAX_PATH, L"\\cmd.exe");
  }

  size_t size = wcslen(comspec) + wcslen(line) + 16;
  wchar_t *command = malloc(size * sizeof(wchar_t));
  if (!command || swprintf(command, size, L"\"%ls\" /d /s /c \"%ls\"", comspec, line) < 0) {
    return refuse(L"the line is too long", NULL, ERROR_BUFFER_OVERFLOW);
  }

  HANDLE job = CreateJobObjectW(NULL, NULL);
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits = {0};
  limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  if (!job || !SetInformationJobObject(job, JobObjectExtendedLimitInformation, &limits, sizeof(limits))) {
    return refuse(L"could not make the job", NULL, GetLastError());
  }

  HANDLE std[3] = {GetStdHandle(STD_INPUT_HANDLE), GetStdHandle(STD_OUTPUT_HANDLE), GetStdHandle(STD_ERROR_HANDLE)};
  HANDLE inherit[3];
  DWORD inherited = stdio_handles(std, inherit);

  SIZE_T attributes_size = 0;
  InitializeProcThreadAttributeList(NULL, 2, 0, &attributes_size);
  LPPROC_THREAD_ATTRIBUTE_LIST attributes = HeapAlloc(GetProcessHeap(), 0, attributes_size);
  SECURITY_CAPABILITIES security = {container_sid, count ? caps : NULL, count, 0};
  if (
    !attributes ||
    !InitializeProcThreadAttributeList(attributes, 2, 0, &attributes_size) ||
    !UpdateProcThreadAttribute(attributes, 0, PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES, &security, sizeof(security), NULL, NULL) ||
    (inherited && !UpdateProcThreadAttribute(attributes, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST, inherit, inherited * sizeof(HANDLE), NULL, NULL))
  ) {
    return refuse(L"could not set the container attributes", NULL, GetLastError());
  }

  STARTUPINFOEXW startup = {0};
  startup.StartupInfo.cb = sizeof(startup);
  startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
  startup.StartupInfo.hStdInput = std[0];
  startup.StartupInfo.hStdOutput = std[1];
  startup.StartupInfo.hStdError = std[2];
  startup.lpAttributeList = attributes;

  PROCESS_INFORMATION child = {0};
  DWORD flags = EXTENDED_STARTUPINFO_PRESENT | CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT;
  if (!CreateProcessW(comspec, command, NULL, NULL, inherited > 0, flags, NULL, cwd, &startup.StartupInfo, &child)) {
    return refuse(L"could not start the line in", cwd, GetLastError());
  }

  // Assigned while suspended, so nothing it starts escapes the job
  if (!AssignProcessToJobObject(job, child.hProcess)) {
    DWORD error = GetLastError();
    TerminateProcess(child.hProcess, REFUSED);
    return refuse(L"could not put the line in its job", NULL, error);
  }

  ResumeThread(child.hThread);
  WaitForSingleObject(child.hProcess, INFINITE);

  DWORD code = 1;
  GetExitCodeProcess(child.hProcess, &code);

  return (int) code;
}

int
wmain(int argc, wchar_t **argv) {
  static request_t req;
  if (!parse(argc, argv, &req)) {
    return refuse(L"usage: --probe | --prepare [--deny <root>] [--pin <folder>] [--write <cap> <root>] [--read <cap> <root>] | [--cap <cap>] [--net] [--cwd <dir>] -- <line>", NULL, ERROR_INVALID_PARAMETER);
  }

  PSID container_sid = NULL;
  HRESULT hr = container(&container_sid);
  if (FAILED(hr)) return refuse(L"could not make the AppContainer profile", PROFILE, (DWORD) hr);
  if (req.prepare) return prepare(&req, container_sid);

  static wchar_t temp[MAX_PATH * 2];
  int failed = app_data();
  if (!failed) failed = temp_dir(container_sid, temp);
  if (failed) return failed;

  if (req.probe) return run(container_sid, NULL, 0, temp, L"exit 0");

  static SID_AND_ATTRIBUTES caps[2 * MAX_ROOTS + NETWORK_CAPABILITIES];
  static BYTE network_sids[NETWORK_CAPABILITIES][SECURITY_MAX_SID_SIZE];
  DWORD count = 0;
  failed = capabilities(&req, caps, &count);
  if (!failed && req.network) failed = network(caps, &count, network_sids);
  if (failed) return failed;

  return run(container_sid, caps, count, req.cwd ? req.cwd : temp, req.line);
}
