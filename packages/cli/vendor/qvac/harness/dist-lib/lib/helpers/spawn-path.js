export const HOMEBREW_BIN_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];
export function withHomebrewPath(path, platformName) {
    if (platformName !== 'darwin')
        return path;
    const dirs = (path ?? '').split(':').filter(Boolean);
    const seen = new Set(dirs);
    const missing = HOMEBREW_BIN_DIRS.filter((dir) => !seen.has(dir));
    if (missing.length === 0) {
        return path;
    }
    return [...dirs, ...missing].join(':');
}
export const EXEC_ENV_ALLOWLIST = [
    'PATH',
    'HOME',
    'TMPDIR',
    'TMP',
    'TEMP',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'TZ',
    'USER',
    'LOGNAME',
    'HTTP_PROXY',
    'http_proxy',
    'HTTPS_PROXY',
    'https_proxy',
    'ALL_PROXY',
    'all_proxy',
    'NO_PROXY',
    'no_proxy',
    'SSL_CERT_FILE',
    'SSL_CERT_DIR',
    'CURL_CA_BUNDLE',
    'REQUESTS_CA_BUNDLE',
    'NODE_EXTRA_CA_CERTS'
];
const PLATFORM_EXEC_ENV_ALLOWLIST = {
    win32: ['SystemRoot', 'COMSPEC', 'PATHEXT', 'USERPROFILE'],
    linux: ['DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR']
};
export function execEnv(env, platformName) {
    const out = {};
    const keys = [...EXEC_ENV_ALLOWLIST, ...(PLATFORM_EXEC_ENV_ALLOWLIST[platformName] ?? [])];
    for (const key of keys) {
        const value = env[key];
        if (value !== undefined) {
            out[key] = value;
        }
    }
    const path = withHomebrewPath(out.PATH ?? env.Path, platformName);
    if (path !== undefined) {
        out.PATH = path;
    }
    return out;
}
export function spawnEnv(env, platformName, overrides) {
    return { ...execEnv(env, platformName), ...overrides };
}
