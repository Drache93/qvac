#include "chat.h"
#include "ggml-backend.h"
#include "llama.h"
#include "nlohmann/json.hpp"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

using json = nlohmann::ordered_json;
using Clock = std::chrono::steady_clock;

static std::unique_ptr<llama_model, decltype(&llama_model_free)> model(nullptr, llama_model_free);
static std::unique_ptr<llama_context, decltype(&llama_free)> context(nullptr, llama_free);
static std::unique_ptr<llama_sampler, decltype(&llama_sampler_free)> sampler(nullptr, llama_sampler_free);
static common_chat_templates_ptr templates;
static ggml_backend_dev_t gpu = nullptr;
static std::string result = "{}";
static std::vector<llama_token> prompt;
static size_t prefilled = 0;
static int generated = 0;
static int max_tokens = 0;
static bool active = false;
static double prompt_ms = 0;
static double decode_ms = 0;
static int batch_size = 128;

static double elapsed(Clock::time_point start) {
    return std::chrono::duration<double, std::milli>(Clock::now() - start).count();
}

static int respond(const json & value) {
    result = value.dump();
    return 0;
}

static int fail(const std::exception & error) {
    active = false;
    sampler.reset();
    result = json({{"error", error.what()}}).dump();
    return -1;
}

static void require(bool condition, const char * message) {
    if (!condition) throw std::runtime_error(message);
}

static void keys(const json & input, std::initializer_list<const char *> allowed) {
    require(input.is_object(), "Expected a JSON object");
    for (const auto & item : input.items()) {
        bool found = false;
        for (const char * key : allowed) found = found || item.key() == key;
        require(found, "Unsupported bridge option");
    }
}

static json progress(const char * phase, bool done) {
    return {{"phase", phase}, {"done", done}, {"tokenBytes", json::array()},
            {"promptTokens", prompt.size()}, {"prefilledTokens", prefilled},
            {"generatedTokens", generated}, {"promptMs", prompt_ms}, {"decodeMs", decode_ms}};
}

static void release_model() {
    active = false;
    sampler.reset();
    templates.reset();
    context.reset();
    model.reset();
    prompt.clear();
}

extern "C" {

const char * web_result() {
    return result.c_str();
}

int web_init() {
    try {
        llama_backend_init();
        auto reg = ggml_backend_reg_by_name("WebGPU");
        require(reg != nullptr && ggml_backend_reg_dev_count(reg) > 0,
                "WebGPU backend has no supported device; shader-f16 is required");
        gpu = ggml_backend_reg_dev_get(reg, 0);
        require(ggml_backend_dev_type(gpu) == GGML_BACKEND_DEVICE_TYPE_GPU, "WebGPU device is not a GPU");
        return respond({{"backend", "WebGPU"}, {"device", ggml_backend_dev_name(gpu)},
                        {"description", ggml_backend_dev_description(gpu)}});
    } catch (const std::exception & error) {
        return fail(error);
    }
}

int web_load(const char * text) {
    try {
        require(gpu != nullptr, "Initialize WebGPU before loading a model");
        require(!model, "Unload the resident model before loading another");
        const auto input = json::parse(text);
        keys(input, {"modelPath", "contextSize", "batchSize"});
        const auto path = input.at("modelPath").get<std::string>();
        const int context_size = input.value("contextSize", 2048);
        batch_size = input.value("batchSize", 128);
        require(batch_size == 1 || batch_size == 128, "Unsupported prefill batch size");
        require(context_size >= 256 && context_size <= 8192, "contextSize must be between 256 and 8192");
        ggml_backend_dev_t devices[] = {gpu, nullptr};
        auto params = llama_model_default_params();
        params.devices = devices;
        params.n_gpu_layers = -1;
        params.split_mode = LLAMA_SPLIT_MODE_NONE;
        params.load_mode = LLAMA_LOAD_MODE_NONE;
        params.load_mtp = false;
        model.reset(llama_model_load_from_file(path.c_str(), params));
        require(model != nullptr, "Model loading failed; inspect the engine log");
        auto ctx = llama_context_default_params();
        ctx.n_ctx = context_size;
        ctx.n_batch = batch_size;
        ctx.n_ubatch = batch_size;
        ctx.n_seq_max = 1;
        ctx.n_threads = 1;
        ctx.n_threads_batch = 1;
        ctx.flash_attn_type = LLAMA_FLASH_ATTN_TYPE_ENABLED;
        ctx.no_perf = false;
        context.reset(llama_init_from_model(model.get(), ctx));
        require(context != nullptr, "Context initialization failed");
        templates = common_chat_templates_init(model.get(), "");
        return respond({{"contextSize", llama_n_ctx(context.get())}, {"layers", llama_model_n_layer(model.get())},
                        {"backend", "WebGPU"}, {"device", ggml_backend_dev_name(gpu)},
                        {"modelBytes", llama_model_size(model.get())}, {"prefillBatchSize", batch_size}});
    } catch (const std::exception & error) {
        release_model();
        return fail(error);
    }
}

int web_begin(const char * text) {
    try {
        require(model && context, "Load a model before generating");
        const auto input = json::parse(text);
        keys(input, {"messages", "temperature", "seed", "maxTokens"});
        const auto & messages = input.at("messages");
        require(messages.is_array() && !messages.empty(), "messages must be a nonempty array");
        common_chat_templates_inputs chat;
        chat.use_jinja = true;
        chat.enable_thinking = false;
        chat.add_generation_prompt = true;
        for (const auto & message : messages) {
            keys(message, {"role", "content"});
            common_chat_msg msg;
            msg.role = message.at("role").get<std::string>();
            require(msg.role == "system" || msg.role == "user" || msg.role == "assistant", "Unsupported chat role");
            msg.content = message.at("content").get<std::string>();
            chat.messages.push_back(std::move(msg));
        }
        require(chat.messages.back().role == "user", "The last message must have role user");
        const auto rendered = common_chat_templates_apply(templates.get(), chat);
        const auto * vocab = llama_model_get_vocab(model.get());
        int size = llama_tokenize(vocab, rendered.prompt.c_str(), rendered.prompt.size(), nullptr, 0, true, true);
        require(size < 0, "The rendered prompt has no tokens");
        prompt.resize(-size);
        size = llama_tokenize(vocab, rendered.prompt.c_str(), rendered.prompt.size(), prompt.data(), prompt.size(), true, true);
        require(size > 0, "Prompt tokenization failed");
        prompt.resize(size);
        max_tokens = input.value("maxTokens", 128);
        require(max_tokens >= 1 && max_tokens <= 2048, "maxTokens must be between 1 and 2048");
        require(prompt.size() + max_tokens <= llama_n_ctx(context.get()), "Prompt plus output exceeds contextSize");
        const float temperature = input.value("temperature", 0.0f);
        require(std::isfinite(temperature) && temperature >= 0 && temperature <= 2, "temperature must be between 0 and 2");
        const uint32_t seed = input.value("seed", uint32_t(42));
        sampler.reset(llama_sampler_chain_init(llama_sampler_chain_default_params()));
        require(sampler != nullptr, "Sampler initialization failed");
        if (temperature == 0) {
            llama_sampler_chain_add(sampler.get(), llama_sampler_init_greedy());
        } else {
            llama_sampler_chain_add(sampler.get(), llama_sampler_init_temp(temperature));
            llama_sampler_chain_add(sampler.get(), llama_sampler_init_dist(seed));
        }
        llama_memory_clear(llama_get_memory(context.get()), true);
        llama_perf_context_reset(context.get());
        generated = 0;
        prefilled = 0;
        prompt_ms = 0;
        decode_ms = 0;
        active = true;
        return respond({{"promptTokens", prompt.size()}, {"promptTokenIds", prompt}, {"renderedPrompt", rendered.prompt},
                        {"generationPrompt", rendered.generation_prompt}, {"thinkingForcedOpen", rendered.thinking_forced_open}});
    } catch (const std::exception & error) {
        return fail(error);
    }
}

int web_step() {
    try {
        require(active && context && sampler, "No active generation");
        const auto start = Clock::now();
        if (prefilled < prompt.size()) {
            const auto count = std::min(size_t(batch_size), prompt.size() - prefilled);
            const int code = llama_decode(context.get(), llama_batch_get_one(prompt.data() + prefilled, count));
            require(code == 0, "Prompt evaluation failed");
            llama_synchronize(context.get());
            prompt_ms += elapsed(start);
            prefilled += count;
            return respond(progress("prefill", false));
        }
        const auto * vocab = llama_model_get_vocab(model.get());
        llama_token token = llama_sampler_sample(sampler.get(), context.get(), -1);
        if (llama_vocab_is_eog(vocab, token)) {
            active = false;
            auto output = progress("decode", true);
            output["stopReason"] = "eos";
            return respond(output);
        }
        std::vector<char> bytes(256);
        int count = llama_token_to_piece(vocab, token, bytes.data(), bytes.size(), 0, true);
        if (count < 0) {
            bytes.resize(-count);
            count = llama_token_to_piece(vocab, token, bytes.data(), bytes.size(), 0, true);
        }
        require(count >= 0, "Token conversion failed");
        ++generated;
        const bool done = generated >= max_tokens;
        if (!done) {
            const int code = llama_decode(context.get(), llama_batch_get_one(&token, 1));
            require(code == 0, "Token evaluation failed");
            llama_synchronize(context.get());
        }
        decode_ms += elapsed(start);
        auto output = progress("decode", done);
        for (int i = 0; i < count; ++i) output["tokenBytes"].push_back(static_cast<uint8_t>(bytes[i]));
        output["tokenId"] = token;
        if (done) {
            active = false;
            output["stopReason"] = "limit";
        }
        return respond(output);
    } catch (const std::exception & error) {
        return fail(error);
    }
}

int web_unload() {
    try {
        release_model();
        return respond({{"unloaded", true}});
    } catch (const std::exception & error) {
        return fail(error);
    }
}

}
