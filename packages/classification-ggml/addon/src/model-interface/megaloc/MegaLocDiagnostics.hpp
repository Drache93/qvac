#pragma once

#include <cstdarg>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <string>
#include <stdexcept>
#include <vector>

#if defined(__ANDROID__)
#include <android/log.h>
#elif defined(_WIN32)
#include <windows.h>
#endif

namespace classification_ggml::megaloc::diagnostics {

inline std::string env(const char* key) {
#if defined(_WIN32)
  const auto size = GetEnvironmentVariableA(key, nullptr, 0);
  if (!size) return "";
  std::string value(size, '\0');
  const auto length = GetEnvironmentVariableA(key, value.data(), size);
  value.resize(length);
  return value;
#else
  const auto* value = std::getenv(key);
  return value ? value : "";
#endif
}

inline void log(const char* format, ...) {
  va_list args;
  va_start(args, format);
#if defined(__ANDROID__)
  __android_log_vprint(ANDROID_LOG_INFO, "MegaLocDiag", format, args);
#else
  std::fputs("MegaLocDiag: ", stderr);
  std::vfprintf(stderr, format, args);
  std::fputc('\n', stderr);
  std::fflush(stderr);
#endif
  va_end(args);
}

inline void compare(const char* label, const std::vector<float>& a,
                    const std::vector<float>& b) {
  double aa = 0, bb = 0, ab = 0, squared = 0, maximum = 0;
  size_t nonfinite = 0;
  for (size_t i = 0; i < a.size(); ++i) {
    if (!std::isfinite(a[i]) || !std::isfinite(b[i])) ++nonfinite;
    const double delta = static_cast<double>(a[i]) - b[i];
    aa += static_cast<double>(a[i]) * a[i];
    bb += static_cast<double>(b[i]) * b[i];
    ab += static_cast<double>(a[i]) * b[i];
    squared += delta * delta;
    maximum = std::max(maximum, std::abs(delta));
  }
  log("COMPARE label=%s n=%zu cosine=%.12g relative_rmse=%.12g max_abs=%.12g nonfinite=%zu",
      label, a.size(), ab / std::sqrt(std::max(aa * bb, 1e-300)),
      std::sqrt(squared / std::max(aa, 1e-300)), maximum, nonfinite);
}

inline bool contains(const std::string& list, const std::string& item) {
  return ("," + list + ",").find("," + item + ",") != std::string::npos;
}

struct Trace {
  std::string mode;
  std::string directory;
  bool done = false;
  size_t count = 0;

  static bool callback(ggml_tensor* tensor, bool ask, void* user) {
    auto& trace = *static_cast<Trace*>(user);
    const std::string name = ggml_get_name(tensor);
    const auto index = name.starts_with("diag_") ? std::atoi(name.c_str() + 5) : -1;
    const bool capture = index >= 0 && (index < 110 || name.find("checkpoint") != std::string::npos ||
        tensor->op == GGML_OP_NORM || tensor->op == GGML_OP_UNARY);
    const bool selected = !trace.done && capture &&
        tensor->type == GGML_TYPE_F32 && ggml_is_contiguous(tensor) &&
        tensor->op != GGML_OP_VIEW && tensor->op != GGML_OP_RESHAPE &&
        tensor->op != GGML_OP_PERMUTE && tensor->op != GGML_OP_TRANSPOSE;
    if (ask) return selected;
    if (!selected) return true;
    std::vector<float> values(ggml_nelements(tensor));
    ggml_backend_tensor_get(tensor, values.data(), 0, ggml_nbytes(tensor));
    const auto filename = trace.directory + "/" + name.substr(0, 9) + ".bin";
    if (trace.mode == "save") {
      std::ofstream out(filename, std::ios::binary);
      out.write(reinterpret_cast<const char*>(values.data()), ggml_nbytes(tensor));
      log("TRACE_SAVE node=%s op=%s elements=%zu valid=%d", name.c_str(),
          ggml_op_desc(tensor), values.size(), static_cast<int>(out.good()));
    } else {
      std::vector<float> reference(values.size());
      std::ifstream input(filename, std::ios::binary);
      input.read(reinterpret_cast<char*>(reference.data()), ggml_nbytes(tensor));
      if (!input.good()) {
        log("TRACE_MISSING node=%s bytes=%zu", name.c_str(), ggml_nbytes(tensor));
      } else {
        compare(name.c_str(), reference, values);
      }
    }
    ++trace.count;
    return true;
  }
};

inline void probe(ggml_backend_t cpu, ggml_backend_t device, const std::string& kind) {
  auto* ctx = ggml_init({ggml_tensor_overhead() * 128 + ggml_graph_overhead(), nullptr, true});
  if (!ctx) throw std::runtime_error("Diagnostic context allocation failed");
  ggml_tensor* a = nullptr;
  ggml_tensor* b = nullptr;
  ggml_tensor* out = nullptr;
  if (kind == "linear_f16" || kind == "linear_f32") {
    a = ggml_new_tensor_2d(ctx, kind == "linear_f16" ? GGML_TYPE_F16 : GGML_TYPE_F32, 768, 768);
    b = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, 768, 530);
    out = ggml_mul_mat(ctx, a, b);
    ggml_prec_set_acc(out, GGML_PREC_F32);
  } else if (kind == "attention_qk") {
    a = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, 64, 530, 12);
    b = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, 64, 530, 12);
    out = ggml_mul_mat(ctx, a, b);
    ggml_prec_set_acc(out, GGML_PREC_F32);
  } else if (kind == "attention_values") {
    a = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, 530, 64, 12);
    b = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, 530, 530, 12);
    out = ggml_mul_mat(ctx, a, b);
    ggml_prec_set_acc(out, GGML_PREC_F32);
  } else {
    a = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, kind == "softmax" ? 530 : 768, 530);
    if (kind == "norm") out = ggml_norm(ctx, a, 1e-6F);
    if (kind == "gelu_erf") out = ggml_gelu_erf(ctx, a);
    if (kind == "softmax") out = ggml_soft_max(ctx, a);
    if (kind == "sum_rows") out = ggml_sum_rows(ctx, a);
    if (kind == "exp") out = ggml_exp(ctx, a);
  }
  auto* graph = ggml_new_graph(ctx);
  ggml_build_forward_expand(graph, out);
  bool supported = true;
  for (int i = 0; i < ggml_graph_n_nodes(graph); ++i)
    supported = supported && ggml_backend_supports_op(device, ggml_graph_node(graph, i));
  if (!supported) {
    log("PROBE_UNAVAILABLE backend=%s kind=%s", ggml_backend_name(device), kind.c_str());
    ggml_free(ctx);
    return;
  }
  auto* buffer = ggml_backend_alloc_ctx_tensors(ctx, cpu);
  if (!buffer) throw std::runtime_error("Diagnostic CPU buffer allocation failed");
  for (auto* tensor : {a, b}) {
    if (!tensor) continue;
    std::vector<float> values(ggml_nelements(tensor));
    for (size_t i = 0; i < values.size(); ++i)
      values[i] = static_cast<float>(std::sin(i * 0.017) * 2.0 + std::cos(i * 0.031) * 0.5);
    if (tensor->type == GGML_TYPE_F16) {
      std::vector<ggml_fp16_t> half(values.size());
      ggml_fp32_to_fp16_row(values.data(), half.data(), half.size());
      ggml_backend_tensor_set(tensor, half.data(), 0, ggml_nbytes(tensor));
    } else {
      ggml_backend_tensor_set(tensor, values.data(), 0, ggml_nbytes(tensor));
    }
  }
  auto copy = ggml_backend_graph_copy(device, graph);
  if (!copy.graph) throw std::runtime_error("Diagnostic graph copy failed");
  const auto cpuStatus = ggml_backend_graph_compute(cpu, graph);
  const auto gpuStatus = ggml_backend_graph_compute(device, copy.graph);
  auto* other = ggml_graph_node(copy.graph, ggml_graph_n_nodes(copy.graph) - 1);
  if (cpuStatus == GGML_STATUS_SUCCESS && gpuStatus == GGML_STATUS_SUCCESS) {
    std::vector<float> reference(ggml_nelements(out)), actual(reference.size());
    ggml_backend_tensor_get(out, reference.data(), 0, ggml_nbytes(out));
    ggml_backend_tensor_get(other, actual.data(), 0, ggml_nbytes(other));
    compare((std::string("probe/") + ggml_backend_name(device) + "/" + kind).c_str(), reference, actual);
  } else {
    log("PROBE_ERROR kind=%s cpu=%d gpu=%d", kind.c_str(), cpuStatus, gpuStatus);
  }
  ggml_backend_graph_copy_free(copy);
  ggml_backend_buffer_free(buffer);
  ggml_free(ctx);
}

inline void probes(ggml_backend_t cpu, ggml_backend_t device) {
  for (const auto* kind : {"norm", "gelu_erf", "softmax", "sum_rows", "exp",
                           "linear_f16", "linear_f32", "attention_qk", "attention_values"})
    probe(cpu, device, kind);
}

} // namespace classification_ggml::megaloc::diagnostics
