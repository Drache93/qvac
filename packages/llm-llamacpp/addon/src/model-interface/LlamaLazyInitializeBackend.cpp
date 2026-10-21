#include "LlamaLazyInitializeBackend.hpp"

#include <filesystem>
#include <string>
#include <unordered_set>

#include <ggml-backend.h>
#include <llama.h>
#include <qvac-fabric.h>

#if defined(__linux__)
#include <dlfcn.h>
#endif

#include "LlamaModel.hpp"
#include "utils/LoggingMacros.hpp"

using namespace qvac_lib_inference_addon_llama::logging;
using namespace qvac_lib_inference_addon_cpp::logger;

namespace {

#if defined(__linux__)
// Linux and Android load the ggml backends as GGML_BACKEND_DL modules
// (libqvac-ggml-cuda.so, -vulkan, -cpu-*, ...), dlopen'd RTLD_LOCAL. Each
// statically links its own ggml-base, so llama_log_set() only reaches the
// runtime's logger: the modules keep ggml's default callback, which writes
// every line to stderr, DEBUG included (e.g. "CUDA Graph id N reused" on each
// decode). Install the addon callback into each module's own copy as well.
void setLogCallbackInBackendModules() {
  using LogSetFn = void (*)(ggml_log_callback, void*);
  std::unordered_set<std::string> modulePaths;
  for (size_t i = 0; i < ggml_backend_reg_count(); ++i) {
    // A backend registry is a static object of the module that registered it.
    Dl_info info{};
    if (dladdr(ggml_backend_reg_get(i), &info) == 0 ||
        info.dli_fname == nullptr ||
        !modulePaths.insert(info.dli_fname).second) {
      continue;
    }
    void* handle = dlopen(info.dli_fname, RTLD_NOW | RTLD_NOLOAD);
    if (handle == nullptr) {
      continue;
    }
    if (auto* logSet =
            reinterpret_cast<LogSetFn>(dlsym(handle, "ggml_log_set"))) {
      logSet(LlamaModel::llamaLogCallback, nullptr);
    }
    dlclose(handle);
  }
}
#endif

} // namespace

std::mutex LlamaLazyInitializeBackend::g_initMutex;
bool LlamaLazyInitializeBackend::g_initialized = false;
std::string LlamaLazyInitializeBackend::g_recordedBackendsDir;
int LlamaLazyInitializeBackend::g_refCount = 0;

bool LlamaLazyInitializeBackend::initialize(
    const std::string& backendsDir, const std::string& openclCacheDir) {
  std::lock_guard<std::mutex> lock(g_initMutex);
  return initializeLocked(backendsDir, openclCacheDir);
}

void LlamaLazyInitializeBackend::acquire(
    const std::string& backendsDir, const std::string& openclCacheDir) {
  // Initialization and ownership must be atomic with the last model unloading.
  const std::lock_guard<std::mutex> lock(g_initMutex);
  initializeLocked(backendsDir, openclCacheDir);
  ++g_refCount;
}

bool LlamaLazyInitializeBackend::initializeLocked(
    const std::string& backendsDir, const std::string& openclCacheDir) {
  if (g_initialized) {
    if (!backendsDir.empty() && !g_recordedBackendsDir.empty() &&
        backendsDir != g_recordedBackendsDir) {
      QLOG_IF(
          Priority::WARNING,
          "Backend already initialized with different backendsDir. "
          "Previously initialized at: " +
              g_recordedBackendsDir + ", requested: " + backendsDir);
    }
    return false;
  }

  if (!backendsDir.empty()) {
    g_recordedBackendsDir = backendsDir;
  }

  llama_log_set(LlamaModel::llamaLogCallback, nullptr);

#ifdef __ANDROID__
  if (!openclCacheDir.empty()) {
    auto oclCachePath =
        (std::filesystem::path(openclCacheDir) / "opencl-cache").string();
    setenv("GGML_OPENCL_CACHE_DIR", oclCachePath.c_str(), /*overwrite=*/1);
  }
#endif

  if (!backendsDir.empty()) {
    QLOG_IF(
        Priority::INFO, "Loading backends from directory: " + backendsDir);
    ggml_backend_load_all_from_path(backendsDir.c_str());
  } else {
    QLOG_IF(
        Priority::DEBUG,
        std::string("Loading backends shipped with @qvac/fabric from: ") +
            qvac_fabric_backends_dir());
    qvac_fabric_load_backends();
  }
#if defined(__linux__)
  setLogCallbackInBackendModules();
#endif

  llama_backend_init();
  g_initialized = true;
  return true;
}

void LlamaLazyInitializeBackend::incrementRefCount() {
  std::lock_guard<std::mutex> lock(g_initMutex);
  g_refCount++;
}

void LlamaLazyInitializeBackend::decrementRefCount() {
  std::lock_guard<std::mutex> lock(g_initMutex);
  if (g_refCount > 0) {
    g_refCount--;
    if (g_refCount == 0 && g_initialized) {
      QLOG_IF(
          Priority::DEBUG, "Freeing backend (reference count reached zero)");
      llama_backend_free();
      g_initialized = false;
      g_recordedBackendsDir.clear();
    }
  }
}

LlamaBackendsHandle::LlamaBackendsHandle(
    const std::string& backendsDir, const std::string& openclCacheDir)
    : ownsHandle_(true) {
  LlamaLazyInitializeBackend::acquire(backendsDir, openclCacheDir);
}

LlamaBackendsHandle::~LlamaBackendsHandle() {
  if (ownsHandle_) {
    LlamaLazyInitializeBackend::decrementRefCount();
  }
}

LlamaBackendsHandle::LlamaBackendsHandle(LlamaBackendsHandle&& other) noexcept
    : ownsHandle_(other.ownsHandle_) {
  other.ownsHandle_ = false;
}

LlamaBackendsHandle&
LlamaBackendsHandle::operator=(LlamaBackendsHandle&& other) noexcept {
  if (this != &other) {
    if (ownsHandle_) {
      LlamaLazyInitializeBackend::decrementRefCount();
    }
    ownsHandle_ = other.ownsHandle_;
    other.ownsHandle_ = false;
  }
  return *this;
}
