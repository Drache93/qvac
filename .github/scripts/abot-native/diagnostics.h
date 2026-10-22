#ifndef QVAC_ABOT_DIAGNOSTICS_H
#define QVAC_ABOT_DIAGNOSTICS_H

#include <cstdlib>
#include <chrono>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <mutex>
#include <map>
#include <sstream>
#include <string>
#include <vector>
#include "ggml.h"
#include "ggml-backend.h"

inline std::mutex& abot_diag_mutex() {
    static std::mutex mutex;
    return mutex;
}

inline const char* abot_diag_dir() {
#ifdef SD_ABOT_DIAGNOSTICS
    const char* dir = std::getenv("SD_ABOT_DIAGNOSTIC_DIR");
    return dir && *dir ? dir : nullptr;
#else
    return nullptr;
#endif
}

inline void abot_diag_event(const char* event, const void* pointer, size_t bytes, const char* name = "") {
    const char* dir = abot_diag_dir();
    if (!dir) return;
    std::lock_guard<std::mutex> guard(abot_diag_mutex());
    std::ofstream out(std::string(dir) + "/memory.jsonl", std::ios::app);
    out << "{\"timeNs\":" << std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::steady_clock::now().time_since_epoch()).count()
        << ",\"event\":" << std::quoted(event) << ",\"pointer\":\"" << pointer
        << "\",\"bytes\":" << bytes << ",\"name\":" << std::quoted(name) << "}\n";
    if (!out) std::abort();
}

inline void abot_diag_dump(const char* stage, int block, int step, const float* data, size_t count) {
    const char* dir = abot_diag_dir();
    if (!dir) return;
    // The runner creates this directory. Only activations/noise are passed here.
    if (count > 32 * 1024 * 1024 || (count && !data)) std::abort();
    std::ostringstream name;
    name << dir << "/b" << block << "-s" << step << "-" << stage << ".f32";
    std::ofstream out(name.str(), std::ios::binary);
    out.write(reinterpret_cast<const char*>(data), static_cast<std::streamsize>(count * sizeof(float)));
    if (!out) std::abort();
}

inline void abot_diag_sync(ggml_backend_t backend, const char* stage) {
    if (abot_diag_dir() && std::getenv("SD_ABOT_DIAGNOSTIC_SYNC")) {
        ggml_backend_synchronize(backend);
        abot_diag_event(stage, backend, 0);
    }
}

inline bool abot_diag_node(ggml_tensor* tensor, bool ask, void*) {
    const char* filter = std::getenv("SD_ABOT_DIAGNOSTIC_NODE");
    const bool selected = filter && *filter && tensor->op != GGML_OP_NONE &&
                          tensor->type == GGML_TYPE_F32 && ggml_is_contiguous(tensor) &&
                          std::string(tensor->name).find(filter) != std::string::npos;
    if (ask) return selected;
    if (!selected || !abot_diag_dir()) return true;
    // This callback synchronizes execution and is a separate, intrusive probe.
    static std::map<std::string, size_t> sequences;
    size_t& sequence = sequences[abot_diag_dir()];
    if (sequence >= 8 || ggml_nbytes(tensor) > 8 * 1024 * 1024) {
        abot_diag_event("node-capture-limit", tensor->data, ggml_nbytes(tensor), tensor->name);
        return true;
    }
    const int index = static_cast<int>(sequence++);
    std::vector<float> values(static_cast<size_t>(ggml_nelements(tensor)));
    ggml_backend_tensor_get(tensor, values.data(), 0, values.size() * sizeof(float));
    abot_diag_dump("node", index, 0, values.data(), values.size());
    abot_diag_event("node", tensor->data, ggml_nbytes(tensor), tensor->name);
    return true;
}

#endif
