import { type CreateModelParams, type PluginModelResult, type ResolveContext, type LlmConfigInput } from '../../../schemas/index.js';
export declare const llmPlugin: {
    modelType: "llamacpp-completion";
    displayName: string;
    addonPackage: "@qvac/llm-llamacpp";
    loadConfigSchema: import("zod").ZodObject<{
        backend: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEnum<{
            auto: "auto";
            cuda: "cuda";
            vulkan: "vulkan";
            metal: "metal";
            opencl: "opencl";
        }>>>;
        ctx_size: import("zod").ZodOptional<import("zod").ZodNumber>;
        temp: import("zod").ZodOptional<import("zod").ZodNumber>;
        top_p: import("zod").ZodOptional<import("zod").ZodNumber>;
        top_k: import("zod").ZodOptional<import("zod").ZodNumber>;
        seed: import("zod").ZodOptional<import("zod").ZodNumber>;
        gpu_layers: import("zod").ZodOptional<import("zod").ZodNumber>;
        lora: import("zod").ZodOptional<import("zod").ZodString>;
        device: import("zod").ZodOptional<import("zod").ZodString>;
        predict: import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodLiteral<-1>, import("zod").ZodLiteral<-2>, import("zod").ZodNumber]>>;
        system_prompt: import("zod").ZodOptional<import("zod").ZodString>;
        load_mode: import("zod").ZodOptional<import("zod").ZodEnum<{
            none: "none";
            mmap: "mmap";
            mlock: "mlock";
            "mmap+mlock": "mmap+mlock";
            dio: "dio";
        }>>;
        verbosity: import("zod").ZodOptional<import("zod").ZodEnum<{
            readonly ERROR: 0;
            readonly WARN: 1;
            readonly INFO: 2;
            readonly DEBUG: 3;
        }>>;
        presence_penalty: import("zod").ZodOptional<import("zod").ZodNumber>;
        frequency_penalty: import("zod").ZodOptional<import("zod").ZodNumber>;
        repeat_penalty: import("zod").ZodOptional<import("zod").ZodNumber>;
        stop_sequences: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString>>;
        parallel: import("zod").ZodOptional<import("zod").ZodNumber>;
        tools: import("zod").ZodOptional<import("zod").ZodBoolean>;
        cache_checkpoints: import("zod").ZodOptional<import("zod").ZodNumber>;
        cache_checkpoints_max_bytes: import("zod").ZodOptional<import("zod").ZodNumber>;
        cache_checkpoint_storage: import("zod").ZodOptional<import("zod").ZodEnum<{
            memory: "memory";
            disk: "disk";
        }>>;
        cache_checkpoint_dir: import("zod").ZodOptional<import("zod").ZodString>;
        cache_ram_mib: import("zod").ZodOptional<import("zod").ZodNumber>;
        'cache-type-k': import("zod").ZodOptional<import("zod").ZodString>;
        'cache-type-v': import("zod").ZodOptional<import("zod").ZodString>;
        'main-gpu': import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodNumber, import("zod").ZodEnum<{
            integrated: "integrated";
            dedicated: "dedicated";
        }>]>>;
        'rpc-servers': import("zod").ZodOptional<import("zod").ZodString>;
        devices: import("zod").ZodOptional<import("zod").ZodString>;
        'split-mode': import("zod").ZodOptional<import("zod").ZodEnum<{
            none: "none";
            layer: "layer";
            tensor: "tensor";
        }>>;
        'flash-attn': import("zod").ZodOptional<import("zod").ZodEnum<{
            auto: "auto";
            on: "on";
            off: "off";
        }>>;
        'tensor-split': import("zod").ZodOptional<import("zod").ZodString>;
        'batch-size': import("zod").ZodOptional<import("zod").ZodNumber>;
        'ubatch-size': import("zod").ZodOptional<import("zod").ZodNumber>;
        'cpu-moe': import("zod").ZodOptional<import("zod").ZodBoolean>;
        'n-cpu-moe': import("zod").ZodOptional<import("zod").ZodNumber>;
        'kv-offload': import("zod").ZodOptional<import("zod").ZodBoolean>;
        'image-max-tokens': import("zod").ZodOptional<import("zod").ZodNumber>;
        'image-min-tokens': import("zod").ZodOptional<import("zod").ZodNumber>;
        'image-max-megapixels': import("zod").ZodOptional<import("zod").ZodNumber>;
        poll: import("zod").ZodOptional<import("zod").ZodNumber>;
        pollBatch: import("zod").ZodOptional<import("zod").ZodNumber>;
        threads: import("zod").ZodOptional<import("zod").ZodNumber>;
        'threads-batch': import("zod").ZodOptional<import("zod").ZodNumber>;
        'cpu-mask': import("zod").ZodOptional<import("zod").ZodString>;
        'cpu-mask-batch': import("zod").ZodOptional<import("zod").ZodString>;
        'override-tensor': import("zod").ZodOptional<import("zod").ZodString>;
        'n-cpu-ffn': import("zod").ZodOptional<import("zod").ZodNumber>;
        'moe-cache-mib': import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodNumber, import("zod").ZodLiteral<"auto">]>>;
        'prefetch-weights': import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodBoolean, import("zod").ZodLiteral<"auto">]>>;
        'tensor-read-lazy': import("zod").ZodOptional<import("zod").ZodEnum<{
            auto: "auto";
            on: "on";
            off: "off";
        }>>;
        fit: import("zod").ZodOptional<import("zod").ZodBoolean>;
        'fit-target': import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodNumber, import("zod").ZodString]>>;
        'fit-ctx': import("zod").ZodOptional<import("zod").ZodNumber>;
        openclCacheDir: import("zod").ZodOptional<import("zod").ZodString>;
        reasoning_budget: import("zod").ZodOptional<import("zod").ZodNumber>;
        spec_type: import("zod").ZodOptional<import("zod").ZodEnum<{
            none: "none";
            "draft-mtp": "draft-mtp";
            "draft-dflash": "draft-dflash";
        }>>;
        spec_draft_n_max: import("zod").ZodOptional<import("zod").ZodNumber>;
        spec_draft_n_min: import("zod").ZodOptional<import("zod").ZodNumber>;
        spec_draft_p_min: import("zod").ZodOptional<import("zod").ZodNumber>;
        projectionModelSrc: import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodObject<{
            src: import("zod").ZodString;
            name: import("zod").ZodOptional<import("zod").ZodString>;
            modelId: import("zod").ZodOptional<import("zod").ZodString>;
            registryPath: import("zod").ZodOptional<import("zod").ZodString>;
            registrySource: import("zod").ZodOptional<import("zod").ZodString>;
            blobCoreKey: import("zod").ZodOptional<import("zod").ZodString>;
            blobIndex: import("zod").ZodOptional<import("zod").ZodNumber>;
            engine: import("zod").ZodOptional<import("zod").ZodString>;
            expectedSize: import("zod").ZodOptional<import("zod").ZodNumber>;
            sha256Checksum: import("zod").ZodOptional<import("zod").ZodString>;
            addon: import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodEnum<{
                embeddings: "embeddings";
                diffusion: "diffusion";
                audiogen: "audiogen";
                tts: "tts";
                ocr: "ocr";
                vla: "vla";
                "llamacpp-completion": "llamacpp-completion";
                "whispercpp-transcription": "whispercpp-transcription";
                "bci-whispercpp-transcription": "bci-whispercpp-transcription";
                "llamacpp-embedding": "llamacpp-embedding";
                "llamacpp-decision": "llamacpp-decision";
                "llamacpp-rerank": "llamacpp-rerank";
                "nmtcpp-translation": "nmtcpp-translation";
                "onnx-tts": "onnx-tts";
                "tts-ggml": "tts-ggml";
                "parakeet-transcription": "parakeet-transcription";
                "moss-transcribe": "moss-transcribe";
                "ggml-ocr": "ggml-ocr";
                "sdcpp-generation": "sdcpp-generation";
                "audiogen-ggml": "audiogen-ggml";
                "ggml-vla": "ggml-vla";
                "ggml-classification": "ggml-classification";
                llm: "llm";
                whisper: "whisper";
                bci: "bci";
                nmt: "nmt";
                parakeet: "parakeet";
                classification: "classification";
            }>, import("zod").ZodLiteral<"vad">]>>;
        }, import("zod/v4/core").$strip>]>>;
        draftModelSrc: import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodObject<{
            src: import("zod").ZodString;
            name: import("zod").ZodOptional<import("zod").ZodString>;
            modelId: import("zod").ZodOptional<import("zod").ZodString>;
            registryPath: import("zod").ZodOptional<import("zod").ZodString>;
            registrySource: import("zod").ZodOptional<import("zod").ZodString>;
            blobCoreKey: import("zod").ZodOptional<import("zod").ZodString>;
            blobIndex: import("zod").ZodOptional<import("zod").ZodNumber>;
            engine: import("zod").ZodOptional<import("zod").ZodString>;
            expectedSize: import("zod").ZodOptional<import("zod").ZodNumber>;
            sha256Checksum: import("zod").ZodOptional<import("zod").ZodString>;
            addon: import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodEnum<{
                embeddings: "embeddings";
                diffusion: "diffusion";
                audiogen: "audiogen";
                tts: "tts";
                ocr: "ocr";
                vla: "vla";
                "llamacpp-completion": "llamacpp-completion";
                "whispercpp-transcription": "whispercpp-transcription";
                "bci-whispercpp-transcription": "bci-whispercpp-transcription";
                "llamacpp-embedding": "llamacpp-embedding";
                "llamacpp-decision": "llamacpp-decision";
                "llamacpp-rerank": "llamacpp-rerank";
                "nmtcpp-translation": "nmtcpp-translation";
                "onnx-tts": "onnx-tts";
                "tts-ggml": "tts-ggml";
                "parakeet-transcription": "parakeet-transcription";
                "moss-transcribe": "moss-transcribe";
                "ggml-ocr": "ggml-ocr";
                "sdcpp-generation": "sdcpp-generation";
                "audiogen-ggml": "audiogen-ggml";
                "ggml-vla": "ggml-vla";
                "ggml-classification": "ggml-classification";
                llm: "llm";
                whisper: "whisper";
                bci: "bci";
                nmt: "nmt";
                parakeet: "parakeet";
                classification: "classification";
            }>, import("zod").ZodLiteral<"vad">]>>;
        }, import("zod/v4/core").$strip>]>>;
        image_tile_mode: import("zod").ZodOptional<import("zod").ZodEnum<{
            disabled: "disabled";
            batched: "batched";
            sequential: "sequential";
        }>>;
        image_no_upscale: import("zod").ZodOptional<import("zod").ZodEnum<{
            on: "on";
            off: "off";
        }>>;
        'mmproj-use-gpu': import("zod").ZodOptional<import("zod").ZodBoolean>;
    }, import("zod/v4/core").$strip>;
    assessFit: typeof import("node_modules/@qvac/llm-llamacpp/fit").assessFit;
    resolveConfig(cfg: LlmConfigInput, ctx: ResolveContext): Promise<{
        config: {
            backend?: ("auto" | "cuda" | "vulkan" | "metal" | "opencl")[] | undefined;
            ctx_size?: number | undefined;
            temp?: number | undefined;
            top_p?: number | undefined;
            top_k?: number | undefined;
            seed?: number | undefined;
            gpu_layers?: number | undefined;
            lora?: string | undefined;
            device?: string | undefined;
            predict?: number | undefined;
            system_prompt?: string | undefined;
            load_mode?: "none" | "mmap" | "mlock" | "mmap+mlock" | "dio" | undefined;
            verbosity?: 0 | 3 | 2 | 1 | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            repeat_penalty?: number | undefined;
            stop_sequences?: string[] | undefined;
            parallel?: number | undefined;
            tools?: boolean | undefined;
            cache_checkpoints?: number | undefined;
            cache_checkpoints_max_bytes?: number | undefined;
            cache_checkpoint_storage?: "memory" | "disk" | undefined;
            cache_checkpoint_dir?: string | undefined;
            cache_ram_mib?: number | undefined;
            'cache-type-k'?: string | undefined;
            'cache-type-v'?: string | undefined;
            'main-gpu'?: number | "integrated" | "dedicated" | undefined;
            'rpc-servers'?: string | undefined;
            devices?: string | undefined;
            'split-mode'?: "none" | "layer" | "tensor" | undefined;
            'flash-attn'?: "auto" | "on" | "off" | undefined;
            'tensor-split'?: string | undefined;
            'batch-size'?: number | undefined;
            'ubatch-size'?: number | undefined;
            'cpu-moe'?: boolean | undefined;
            'n-cpu-moe'?: number | undefined;
            'kv-offload'?: boolean | undefined;
            'image-max-tokens'?: number | undefined;
            'image-min-tokens'?: number | undefined;
            'image-max-megapixels'?: number | undefined;
            poll?: number | undefined;
            pollBatch?: number | undefined;
            threads?: number | undefined;
            'threads-batch'?: number | undefined;
            'cpu-mask'?: string | undefined;
            'cpu-mask-batch'?: string | undefined;
            'override-tensor'?: string | undefined;
            'n-cpu-ffn'?: number | undefined;
            'moe-cache-mib'?: number | "auto" | undefined;
            'prefetch-weights'?: boolean | "auto" | undefined;
            'tensor-read-lazy'?: "auto" | "on" | "off" | undefined;
            fit?: boolean | undefined;
            'fit-target'?: string | number | undefined;
            'fit-ctx'?: number | undefined;
            openclCacheDir?: string | undefined;
            reasoning_budget?: number | undefined;
            spec_type?: "none" | "draft-mtp" | "draft-dflash" | undefined;
            spec_draft_n_max?: number | undefined;
            spec_draft_n_min?: number | undefined;
            spec_draft_p_min?: number | undefined;
            image_tile_mode?: "disabled" | "batched" | "sequential" | undefined;
            image_no_upscale?: "on" | "off" | undefined;
            'mmproj-use-gpu'?: boolean | undefined;
        };
        artifacts?: never;
    } | {
        config: {
            backend?: ("auto" | "cuda" | "vulkan" | "metal" | "opencl")[] | undefined;
            ctx_size?: number | undefined;
            temp?: number | undefined;
            top_p?: number | undefined;
            top_k?: number | undefined;
            seed?: number | undefined;
            gpu_layers?: number | undefined;
            lora?: string | undefined;
            device?: string | undefined;
            predict?: number | undefined;
            system_prompt?: string | undefined;
            load_mode?: "none" | "mmap" | "mlock" | "mmap+mlock" | "dio" | undefined;
            verbosity?: 0 | 3 | 2 | 1 | undefined;
            presence_penalty?: number | undefined;
            frequency_penalty?: number | undefined;
            repeat_penalty?: number | undefined;
            stop_sequences?: string[] | undefined;
            parallel?: number | undefined;
            tools?: boolean | undefined;
            cache_checkpoints?: number | undefined;
            cache_checkpoints_max_bytes?: number | undefined;
            cache_checkpoint_storage?: "memory" | "disk" | undefined;
            cache_checkpoint_dir?: string | undefined;
            cache_ram_mib?: number | undefined;
            'cache-type-k'?: string | undefined;
            'cache-type-v'?: string | undefined;
            'main-gpu'?: number | "integrated" | "dedicated" | undefined;
            'rpc-servers'?: string | undefined;
            devices?: string | undefined;
            'split-mode'?: "none" | "layer" | "tensor" | undefined;
            'flash-attn'?: "auto" | "on" | "off" | undefined;
            'tensor-split'?: string | undefined;
            'batch-size'?: number | undefined;
            'ubatch-size'?: number | undefined;
            'cpu-moe'?: boolean | undefined;
            'n-cpu-moe'?: number | undefined;
            'kv-offload'?: boolean | undefined;
            'image-max-tokens'?: number | undefined;
            'image-min-tokens'?: number | undefined;
            'image-max-megapixels'?: number | undefined;
            poll?: number | undefined;
            pollBatch?: number | undefined;
            threads?: number | undefined;
            'threads-batch'?: number | undefined;
            'cpu-mask'?: string | undefined;
            'cpu-mask-batch'?: string | undefined;
            'override-tensor'?: string | undefined;
            'n-cpu-ffn'?: number | undefined;
            'moe-cache-mib'?: number | "auto" | undefined;
            'prefetch-weights'?: boolean | "auto" | undefined;
            'tensor-read-lazy'?: "auto" | "on" | "off" | undefined;
            fit?: boolean | undefined;
            'fit-target'?: string | number | undefined;
            'fit-ctx'?: number | undefined;
            openclCacheDir?: string | undefined;
            reasoning_budget?: number | undefined;
            spec_type?: "none" | "draft-mtp" | "draft-dflash" | undefined;
            spec_draft_n_max?: number | undefined;
            spec_draft_n_min?: number | undefined;
            spec_draft_p_min?: number | undefined;
            image_tile_mode?: "disabled" | "batched" | "sequential" | undefined;
            image_no_upscale?: "on" | "off" | undefined;
            'mmproj-use-gpu'?: boolean | undefined;
        };
        artifacts: {
            draftModelPath?: string;
            projectionModelPath?: string;
        };
    }>;
    createModel(params: CreateModelParams): PluginModelResult;
    handlers: {
        batchCompletionStream: import("../../../schemas/index.js").PluginHandlerDefinition<import("zod").ZodObject<{
            modelId: import("zod").ZodString;
            stream: import("zod").ZodOptional<import("zod").ZodBoolean>;
            captureThinking: import("zod").ZodOptional<import("zod").ZodBoolean>;
            emitRawDeltas: import("zod").ZodOptional<import("zod").ZodBoolean>;
            toolDialect: import("zod").ZodOptional<import("zod").ZodEnum<{
                json: "json";
                hermes: "hermes";
                pythonic: "pythonic";
                harmony: "harmony";
                qwen35: "qwen35";
                gemma4: "gemma4";
                dsml: "dsml";
            }>>;
            requestId: import("zod").ZodOptional<import("zod").ZodString>;
            prompts: import("zod").ZodArray<import("zod").ZodObject<{
                id: import("zod").ZodOptional<import("zod").ZodString>;
                history: import("zod").ZodArray<import("zod").ZodPipe<import("zod").ZodObject<{
                    role: import("zod").ZodString;
                    content: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
                    attachments: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                        path: import("zod").ZodString;
                    }, import("zod/v4/core").$strip>>>;
                    toolCalls: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                        id: import("zod").ZodOptional<import("zod").ZodString>;
                        name: import("zod").ZodString;
                        arguments: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>;
                    }, import("zod/v4/core").$strip>>>;
                    toolCallId: import("zod").ZodOptional<import("zod").ZodString>;
                    toolName: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>, import("zod").ZodTransform<{
                    content: string;
                    role: string;
                    attachments?: {
                        path: string;
                    }[] | undefined;
                    toolCalls?: {
                        name: string;
                        arguments: Record<string, unknown>;
                        id?: string | undefined;
                    }[] | undefined;
                    toolCallId?: string | undefined;
                    toolName?: string | undefined;
                }, {
                    role: string;
                    content?: string | null | undefined;
                    attachments?: {
                        path: string;
                    }[] | undefined;
                    toolCalls?: {
                        name: string;
                        arguments: Record<string, unknown>;
                        id?: string | undefined;
                    }[] | undefined;
                    toolCallId?: string | undefined;
                    toolName?: string | undefined;
                }>>>;
                generationParams: import("zod").ZodOptional<import("zod").ZodObject<{
                    temp: import("zod").ZodOptional<import("zod").ZodNumber>;
                    top_p: import("zod").ZodOptional<import("zod").ZodNumber>;
                    top_k: import("zod").ZodOptional<import("zod").ZodNumber>;
                    predict: import("zod").ZodOptional<import("zod").ZodNumber>;
                    seed: import("zod").ZodOptional<import("zod").ZodNumber>;
                    frequency_penalty: import("zod").ZodOptional<import("zod").ZodNumber>;
                    presence_penalty: import("zod").ZodOptional<import("zod").ZodNumber>;
                    repeat_penalty: import("zod").ZodOptional<import("zod").ZodNumber>;
                    reasoning_budget: import("zod").ZodOptional<import("zod").ZodNumber>;
                    tool_choice: import("zod").ZodOptional<import("zod").ZodString>;
                    parallel_tool_calls: import("zod").ZodOptional<import("zod").ZodBoolean>;
                }, import("zod/v4/core").$strict>>;
                responseFormat: import("zod").ZodOptional<import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"text">;
                }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"json_object">;
                }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"json_schema">;
                    json_schema: import("zod").ZodObject<{
                        name: import("zod").ZodString;
                        description: import("zod").ZodOptional<import("zod").ZodString>;
                        schema: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>;
                        strict: import("zod").ZodOptional<import("zod").ZodBoolean>;
                    }, import("zod/v4/core").$strict>;
                }, import("zod/v4/core").$strict>], "type">>;
                tools: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"function">;
                    name: import("zod").ZodString;
                    description: import("zod").ZodString;
                    deferLoading: import("zod").ZodOptional<import("zod").ZodBoolean>;
                    group: import("zod").ZodOptional<import("zod").ZodString>;
                    parameters: import("zod").ZodObject<{
                        type: import("zod").ZodLiteral<"object">;
                        properties: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodObject<{
                            type: import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodEnum<{
                                string: "string";
                                number: "number";
                                boolean: "boolean";
                                object: "object";
                                null: "null";
                                array: "array";
                                integer: "integer";
                            }>, import("zod").ZodArray<import("zod").ZodEnum<{
                                string: "string";
                                number: "number";
                                boolean: "boolean";
                                object: "object";
                                null: "null";
                                array: "array";
                                integer: "integer";
                            }>>]>>;
                            description: import("zod").ZodOptional<import("zod").ZodString>;
                            enum: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodNull]>>>;
                        }, import("zod/v4/core").$loose>>;
                        required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString>>;
                    }, import("zod/v4/core").$loose>;
                }, import("zod/v4/core").$strip>>>;
            }, import("zod/v4/core").$strict>>;
            type: import("zod").ZodLiteral<"batchCompletionStream">;
        }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
            type: import("zod").ZodLiteral<"batchCompletionStream">;
            done: import("zod").ZodOptional<import("zod").ZodBoolean>;
            ids: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString>>;
            events: import("zod").ZodArray<import("zod").ZodObject<{
                id: import("zod").ZodString;
                event: import("zod").ZodUnion<readonly [import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"contentDelta">;
                    seq: import("zod").ZodNumber;
                    text: import("zod").ZodString;
                }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"rawDelta">;
                    seq: import("zod").ZodNumber;
                    text: import("zod").ZodString;
                }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"thinkingDelta">;
                    seq: import("zod").ZodNumber;
                    text: import("zod").ZodString;
                }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"toolCall">;
                    seq: import("zod").ZodNumber;
                    call: import("zod").ZodObject<{
                        id: import("zod").ZodString;
                        name: import("zod").ZodString;
                        arguments: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>;
                        raw: import("zod").ZodOptional<import("zod").ZodString>;
                    }, import("zod/v4/core").$strip>;
                }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"toolError">;
                    seq: import("zod").ZodNumber;
                    error: import("zod").ZodObject<{
                        code: import("zod").ZodEnum<{
                            PARSE_ERROR: "PARSE_ERROR";
                            VALIDATION_ERROR: "VALIDATION_ERROR";
                            UNKNOWN_TOOL: "UNKNOWN_TOOL";
                        }>;
                        message: import("zod").ZodString;
                        raw: import("zod").ZodOptional<import("zod").ZodString>;
                    }, import("zod/v4/core").$strip>;
                }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"completionStats">;
                    seq: import("zod").ZodNumber;
                    stats: import("zod").ZodObject<{
                        timeToFirstToken: import("zod").ZodOptional<import("zod").ZodNumber>;
                        tokensPerSecond: import("zod").ZodOptional<import("zod").ZodNumber>;
                        promptTokensPerSecond: import("zod").ZodOptional<import("zod").ZodNumber>;
                        cacheTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                        promptTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                        generatedTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                        emittedTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                        avgConcurrentSeq: import("zod").ZodOptional<import("zod").ZodNumber>;
                        toolDefinitionsDropped: import("zod").ZodOptional<import("zod").ZodNumber>;
                        draftTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                        draftAcceptedTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                        backendDevice: import("zod").ZodOptional<import("zod").ZodEnum<{
                            cpu: "cpu";
                            gpu: "gpu";
                        }>>;
                    }, import("zod/v4/core").$strip>;
                }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"completionDone">;
                    seq: import("zod").ZodNumber;
                    stopReason: import("zod").ZodLiteral<"error">;
                    error: import("zod").ZodObject<{
                        message: import("zod").ZodString;
                    }, import("zod/v4/core").$strip>;
                    raw: import("zod").ZodOptional<import("zod").ZodObject<{
                        fullText: import("zod").ZodString;
                    }, import("zod/v4/core").$strip>>;
                }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"completionDone">;
                    seq: import("zod").ZodNumber;
                    stopReason: import("zod").ZodOptional<import("zod").ZodEnum<{
                        cancelled: "cancelled";
                        length: "length";
                        eos: "eos";
                        stopSequence: "stopSequence";
                    }>>;
                    raw: import("zod").ZodOptional<import("zod").ZodObject<{
                        fullText: import("zod").ZodString;
                    }, import("zod/v4/core").$strip>>;
                }, import("zod/v4/core").$strict>]>;
            }, import("zod/v4/core").$strict>>;
            stats: import("zod").ZodOptional<import("zod").ZodObject<{
                timeToFirstToken: import("zod").ZodOptional<import("zod").ZodNumber>;
                tokensPerSecond: import("zod").ZodOptional<import("zod").ZodNumber>;
                promptTokensPerSecond: import("zod").ZodOptional<import("zod").ZodNumber>;
                cacheTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                promptTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                generatedTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                emittedTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                avgConcurrentSeq: import("zod").ZodOptional<import("zod").ZodNumber>;
                toolDefinitionsDropped: import("zod").ZodOptional<import("zod").ZodNumber>;
                draftTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                draftAcceptedTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                backendDevice: import("zod").ZodOptional<import("zod").ZodEnum<{
                    cpu: "cpu";
                    gpu: "gpu";
                }>>;
            }, import("zod/v4/core").$strip>>;
        }, import("zod/v4/core").$strict>>;
        completionStream: import("../../../schemas/index.js").PluginHandlerDefinition<import("zod").ZodObject<{
            history: import("zod").ZodArray<import("zod").ZodPipe<import("zod").ZodObject<{
                role: import("zod").ZodString;
                content: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
                attachments: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    path: import("zod").ZodString;
                }, import("zod/v4/core").$strip>>>;
                toolCalls: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                    id: import("zod").ZodOptional<import("zod").ZodString>;
                    name: import("zod").ZodString;
                    arguments: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>;
                }, import("zod/v4/core").$strip>>>;
                toolCallId: import("zod").ZodOptional<import("zod").ZodString>;
                toolName: import("zod").ZodOptional<import("zod").ZodString>;
            }, import("zod/v4/core").$strip>, import("zod").ZodTransform<{
                content: string;
                role: string;
                attachments?: {
                    path: string;
                }[] | undefined;
                toolCalls?: {
                    name: string;
                    arguments: Record<string, unknown>;
                    id?: string | undefined;
                }[] | undefined;
                toolCallId?: string | undefined;
                toolName?: string | undefined;
            }, {
                role: string;
                content?: string | null | undefined;
                attachments?: {
                    path: string;
                }[] | undefined;
                toolCalls?: {
                    name: string;
                    arguments: Record<string, unknown>;
                    id?: string | undefined;
                }[] | undefined;
                toolCallId?: string | undefined;
                toolName?: string | undefined;
            }>>>;
            modelId: import("zod").ZodString;
            prefill: import("zod").ZodOptional<import("zod").ZodBoolean>;
            tools: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"function">;
                name: import("zod").ZodString;
                description: import("zod").ZodString;
                deferLoading: import("zod").ZodOptional<import("zod").ZodBoolean>;
                group: import("zod").ZodOptional<import("zod").ZodString>;
                parameters: import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"object">;
                    properties: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodObject<{
                        type: import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodEnum<{
                            string: "string";
                            number: "number";
                            boolean: "boolean";
                            object: "object";
                            null: "null";
                            array: "array";
                            integer: "integer";
                        }>, import("zod").ZodArray<import("zod").ZodEnum<{
                            string: "string";
                            number: "number";
                            boolean: "boolean";
                            object: "object";
                            null: "null";
                            array: "array";
                            integer: "integer";
                        }>>]>>;
                        description: import("zod").ZodOptional<import("zod").ZodString>;
                        enum: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodNumber, import("zod").ZodBoolean, import("zod").ZodNull]>>>;
                    }, import("zod/v4/core").$loose>>;
                    required: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString>>;
                }, import("zod/v4/core").$loose>;
            }, import("zod/v4/core").$strip>>>;
            stream: import("zod").ZodBoolean;
            kvCache: import("zod").ZodOptional<import("zod").ZodUnion<readonly [import("zod").ZodBoolean, import("zod").ZodString]>>;
            generationParams: import("zod").ZodOptional<import("zod").ZodObject<{
                temp: import("zod").ZodOptional<import("zod").ZodNumber>;
                top_p: import("zod").ZodOptional<import("zod").ZodNumber>;
                top_k: import("zod").ZodOptional<import("zod").ZodNumber>;
                predict: import("zod").ZodOptional<import("zod").ZodNumber>;
                seed: import("zod").ZodOptional<import("zod").ZodNumber>;
                frequency_penalty: import("zod").ZodOptional<import("zod").ZodNumber>;
                presence_penalty: import("zod").ZodOptional<import("zod").ZodNumber>;
                repeat_penalty: import("zod").ZodOptional<import("zod").ZodNumber>;
                reasoning_budget: import("zod").ZodOptional<import("zod").ZodNumber>;
                tool_choice: import("zod").ZodOptional<import("zod").ZodString>;
                parallel_tool_calls: import("zod").ZodOptional<import("zod").ZodBoolean>;
            }, import("zod/v4/core").$strict>>;
            captureThinking: import("zod").ZodOptional<import("zod").ZodBoolean>;
            emitRawDeltas: import("zod").ZodOptional<import("zod").ZodBoolean>;
            toolDialect: import("zod").ZodOptional<import("zod").ZodEnum<{
                json: "json";
                hermes: "hermes";
                pythonic: "pythonic";
                harmony: "harmony";
                qwen35: "qwen35";
                gemma4: "gemma4";
                dsml: "dsml";
            }>>;
            responseFormat: import("zod").ZodOptional<import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"text">;
            }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"json_object">;
            }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"json_schema">;
                json_schema: import("zod").ZodObject<{
                    name: import("zod").ZodString;
                    description: import("zod").ZodOptional<import("zod").ZodString>;
                    schema: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>;
                    strict: import("zod").ZodOptional<import("zod").ZodBoolean>;
                }, import("zod/v4/core").$strict>;
            }, import("zod/v4/core").$strict>], "type">>;
            requestId: import("zod").ZodOptional<import("zod").ZodString>;
            type: import("zod").ZodLiteral<"completionStream">;
        }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
            type: import("zod").ZodLiteral<"completionStream">;
            done: import("zod").ZodOptional<import("zod").ZodBoolean>;
            events: import("zod").ZodArray<import("zod").ZodUnion<readonly [import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"contentDelta">;
                seq: import("zod").ZodNumber;
                text: import("zod").ZodString;
            }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"rawDelta">;
                seq: import("zod").ZodNumber;
                text: import("zod").ZodString;
            }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"thinkingDelta">;
                seq: import("zod").ZodNumber;
                text: import("zod").ZodString;
            }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"toolCall">;
                seq: import("zod").ZodNumber;
                call: import("zod").ZodObject<{
                    id: import("zod").ZodString;
                    name: import("zod").ZodString;
                    arguments: import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>;
                    raw: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>;
            }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"toolError">;
                seq: import("zod").ZodNumber;
                error: import("zod").ZodObject<{
                    code: import("zod").ZodEnum<{
                        PARSE_ERROR: "PARSE_ERROR";
                        VALIDATION_ERROR: "VALIDATION_ERROR";
                        UNKNOWN_TOOL: "UNKNOWN_TOOL";
                    }>;
                    message: import("zod").ZodString;
                    raw: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strip>;
            }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"completionStats">;
                seq: import("zod").ZodNumber;
                stats: import("zod").ZodObject<{
                    timeToFirstToken: import("zod").ZodOptional<import("zod").ZodNumber>;
                    tokensPerSecond: import("zod").ZodOptional<import("zod").ZodNumber>;
                    promptTokensPerSecond: import("zod").ZodOptional<import("zod").ZodNumber>;
                    cacheTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                    promptTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                    generatedTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                    emittedTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                    avgConcurrentSeq: import("zod").ZodOptional<import("zod").ZodNumber>;
                    toolDefinitionsDropped: import("zod").ZodOptional<import("zod").ZodNumber>;
                    draftTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                    draftAcceptedTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                    backendDevice: import("zod").ZodOptional<import("zod").ZodEnum<{
                        cpu: "cpu";
                        gpu: "gpu";
                    }>>;
                }, import("zod/v4/core").$strip>;
            }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"completionDone">;
                seq: import("zod").ZodNumber;
                stopReason: import("zod").ZodLiteral<"error">;
                error: import("zod").ZodObject<{
                    message: import("zod").ZodString;
                }, import("zod/v4/core").$strip>;
                raw: import("zod").ZodOptional<import("zod").ZodObject<{
                    fullText: import("zod").ZodString;
                }, import("zod/v4/core").$strip>>;
            }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                type: import("zod").ZodLiteral<"completionDone">;
                seq: import("zod").ZodNumber;
                stopReason: import("zod").ZodOptional<import("zod").ZodEnum<{
                    cancelled: "cancelled";
                    length: "length";
                    eos: "eos";
                    stopSequence: "stopSequence";
                }>>;
                raw: import("zod").ZodOptional<import("zod").ZodObject<{
                    fullText: import("zod").ZodString;
                }, import("zod/v4/core").$strip>>;
            }, import("zod/v4/core").$strict>]>>;
        }, import("zod/v4/core").$strict>>;
        finetune: import("../../../schemas/index.js").PluginHandlerDefinition<import("zod").ZodUnion<readonly [import("zod").ZodObject<{
            modelId: import("zod").ZodString;
            options: import("zod").ZodObject<{
                trainDatasetDir: import("zod").ZodString;
                validation: import("zod").ZodPipe<import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"none">;
                }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"split">;
                    fraction: import("zod").ZodOptional<import("zod").ZodNumber>;
                }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"dataset">;
                    path: import("zod").ZodString;
                }, import("zod/v4/core").$strict>], "type">, import("zod").ZodTransform<{
                    type: "none";
                } | {
                    type: "dataset";
                    path: string;
                } | {
                    fraction: number;
                    type: "split";
                }, {
                    type: "none";
                } | {
                    type: "split";
                    fraction?: number | undefined;
                } | {
                    type: "dataset";
                    path: string;
                }>>;
                outputParametersDir: import("zod").ZodString;
                numberOfEpochs: import("zod").ZodOptional<import("zod").ZodNumber>;
                learningRate: import("zod").ZodOptional<import("zod").ZodNumber>;
                contextLength: import("zod").ZodOptional<import("zod").ZodNumber>;
                batchSize: import("zod").ZodOptional<import("zod").ZodNumber>;
                microBatchSize: import("zod").ZodOptional<import("zod").ZodNumber>;
                assistantLossOnly: import("zod").ZodOptional<import("zod").ZodBoolean>;
                loraRank: import("zod").ZodOptional<import("zod").ZodNumber>;
                loraAlpha: import("zod").ZodOptional<import("zod").ZodNumber>;
                loraInitStd: import("zod").ZodOptional<import("zod").ZodNumber>;
                loraSeed: import("zod").ZodOptional<import("zod").ZodNumber>;
                loraModules: import("zod").ZodOptional<import("zod").ZodString>;
                checkpointSaveDir: import("zod").ZodOptional<import("zod").ZodString>;
                checkpointSaveSteps: import("zod").ZodOptional<import("zod").ZodNumber>;
                chatTemplatePath: import("zod").ZodOptional<import("zod").ZodString>;
                lrScheduler: import("zod").ZodOptional<import("zod").ZodEnum<{
                    constant: "constant";
                    cosine: "cosine";
                    linear: "linear";
                }>>;
                lrMin: import("zod").ZodOptional<import("zod").ZodNumber>;
                warmupRatio: import("zod").ZodOptional<import("zod").ZodNumber>;
                warmupRatioSet: import("zod").ZodOptional<import("zod").ZodBoolean>;
                warmupSteps: import("zod").ZodOptional<import("zod").ZodNumber>;
                warmupStepsSet: import("zod").ZodOptional<import("zod").ZodBoolean>;
                weightDecay: import("zod").ZodOptional<import("zod").ZodNumber>;
            }, import("zod/v4/core").$strict>;
            type: import("zod").ZodLiteral<"finetune">;
            operation: import("zod").ZodOptional<import("zod").ZodEnum<{
                start: "start";
                resume: "resume";
            }>>;
            withProgress: import("zod").ZodOptional<import("zod").ZodBoolean>;
            requestId: import("zod").ZodOptional<import("zod").ZodString>;
        }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
            modelId: import("zod").ZodString;
            options: import("zod").ZodObject<{
                trainDatasetDir: import("zod").ZodString;
                validation: import("zod").ZodPipe<import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"none">;
                }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"split">;
                    fraction: import("zod").ZodOptional<import("zod").ZodNumber>;
                }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
                    type: import("zod").ZodLiteral<"dataset">;
                    path: import("zod").ZodString;
                }, import("zod/v4/core").$strict>], "type">, import("zod").ZodTransform<{
                    type: "none";
                } | {
                    type: "dataset";
                    path: string;
                } | {
                    fraction: number;
                    type: "split";
                }, {
                    type: "none";
                } | {
                    type: "split";
                    fraction?: number | undefined;
                } | {
                    type: "dataset";
                    path: string;
                }>>;
                outputParametersDir: import("zod").ZodString;
                numberOfEpochs: import("zod").ZodOptional<import("zod").ZodNumber>;
                learningRate: import("zod").ZodOptional<import("zod").ZodNumber>;
                contextLength: import("zod").ZodOptional<import("zod").ZodNumber>;
                batchSize: import("zod").ZodOptional<import("zod").ZodNumber>;
                microBatchSize: import("zod").ZodOptional<import("zod").ZodNumber>;
                assistantLossOnly: import("zod").ZodOptional<import("zod").ZodBoolean>;
                loraRank: import("zod").ZodOptional<import("zod").ZodNumber>;
                loraAlpha: import("zod").ZodOptional<import("zod").ZodNumber>;
                loraInitStd: import("zod").ZodOptional<import("zod").ZodNumber>;
                loraSeed: import("zod").ZodOptional<import("zod").ZodNumber>;
                loraModules: import("zod").ZodOptional<import("zod").ZodString>;
                checkpointSaveDir: import("zod").ZodOptional<import("zod").ZodString>;
                checkpointSaveSteps: import("zod").ZodOptional<import("zod").ZodNumber>;
                chatTemplatePath: import("zod").ZodOptional<import("zod").ZodString>;
                lrScheduler: import("zod").ZodOptional<import("zod").ZodEnum<{
                    constant: "constant";
                    cosine: "cosine";
                    linear: "linear";
                }>>;
                lrMin: import("zod").ZodOptional<import("zod").ZodNumber>;
                warmupRatio: import("zod").ZodOptional<import("zod").ZodNumber>;
                warmupRatioSet: import("zod").ZodOptional<import("zod").ZodBoolean>;
                warmupSteps: import("zod").ZodOptional<import("zod").ZodNumber>;
                warmupStepsSet: import("zod").ZodOptional<import("zod").ZodBoolean>;
                weightDecay: import("zod").ZodOptional<import("zod").ZodNumber>;
            }, import("zod/v4/core").$strict>;
            type: import("zod").ZodLiteral<"finetune">;
            operation: import("zod").ZodLiteral<"getState">;
        }, import("zod/v4/core").$strict>, import("zod").ZodObject<{
            modelId: import("zod").ZodString;
            type: import("zod").ZodLiteral<"finetune">;
            operation: import("zod").ZodEnum<{
                cancel: "cancel";
                pause: "pause";
            }>;
        }, import("zod/v4/core").$strict>]>, import("zod").ZodObject<{
            type: import("zod").ZodLiteral<"finetune">;
            status: import("zod").ZodEnum<{
                IDLE: "IDLE";
                RUNNING: "RUNNING";
                PAUSED: "PAUSED";
                CANCELLED: "CANCELLED";
                COMPLETED: "COMPLETED";
            }>;
            stats: import("zod").ZodOptional<import("zod").ZodObject<{
                train_loss: import("zod").ZodOptional<import("zod").ZodNumber>;
                train_loss_uncertainty: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUnion<readonly [import("zod").ZodNumber, import("zod").ZodNaN]>>>;
                val_loss: import("zod").ZodOptional<import("zod").ZodNumber>;
                val_loss_uncertainty: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUnion<readonly [import("zod").ZodNumber, import("zod").ZodNaN]>>>;
                train_accuracy: import("zod").ZodOptional<import("zod").ZodNumber>;
                train_accuracy_uncertainty: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUnion<readonly [import("zod").ZodNumber, import("zod").ZodNaN]>>>;
                val_accuracy: import("zod").ZodOptional<import("zod").ZodNumber>;
                val_accuracy_uncertainty: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUnion<readonly [import("zod").ZodNumber, import("zod").ZodNaN]>>>;
                learning_rate: import("zod").ZodOptional<import("zod").ZodNumber>;
                global_steps: import("zod").ZodNumber;
                epochs_completed: import("zod").ZodNumber;
            }, import("zod/v4/core").$strict>>;
        }, import("zod/v4/core").$strict>>;
        translate: import("../../../schemas/index.js").PluginHandlerDefinition<import("zod").ZodDiscriminatedUnion<[import("zod").ZodObject<{
            modelId: import("zod").ZodString;
            text: import("zod").ZodUnion<readonly [import("zod").ZodString, import("zod").ZodArray<import("zod").ZodString>]>;
            stream: import("zod").ZodBoolean;
            modelType: import("zod").ZodEnum<{
                "nmtcpp-translation": "nmtcpp-translation";
                nmt: "nmt";
            }>;
            type: import("zod").ZodLiteral<"translate">;
            requestId: import("zod").ZodOptional<import("zod").ZodString>;
        }, import("zod/v4/core").$strip>, import("zod").ZodObject<{
            modelId: import("zod").ZodString;
            text: import("zod").ZodString;
            stream: import("zod").ZodBoolean;
            modelType: import("zod").ZodEnum<{
                "llamacpp-completion": "llamacpp-completion";
                llm: "llm";
            }>;
            from: import("zod").ZodOptional<import("zod").ZodString>;
            to: import("zod").ZodString;
            context: import("zod").ZodOptional<import("zod").ZodString>;
            type: import("zod").ZodLiteral<"translate">;
            requestId: import("zod").ZodOptional<import("zod").ZodString>;
        }, import("zod/v4/core").$strip>], "modelType">, import("zod").ZodObject<{
            type: import("zod").ZodLiteral<"translate">;
            token: import("zod").ZodString;
            done: import("zod").ZodOptional<import("zod").ZodBoolean>;
            stats: import("zod").ZodOptional<import("zod").ZodObject<{
                totalTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                totalTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
                tokensPerSecond: import("zod").ZodOptional<import("zod").ZodNumber>;
                timeToFirstToken: import("zod").ZodOptional<import("zod").ZodNumber>;
                decodeTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                encodeTime: import("zod").ZodOptional<import("zod").ZodNumber>;
                cacheTokens: import("zod").ZodOptional<import("zod").ZodNumber>;
            }, import("zod/v4/core").$strip>>;
            error: import("zod").ZodOptional<import("zod").ZodString>;
        }, import("zod/v4/core").$strip>>;
    };
    logging: {
        module: () => Promise<typeof import("@qvac/llm-llamacpp/addonLogging")>;
        namespace: "llamacpp-completion";
    };
};
