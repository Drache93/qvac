import type { ImageModelChoice } from '@qvac/harness/model-catalog';
export interface Attachment {
    readonly id: string;
    readonly messageId: string;
    readonly fileName: string;
    readonly mimeType: string;
    readonly byteLength: number;
    readonly blobId: string;
    readonly createdAt: number;
}
export interface DelegationCapabilities {
    chat: boolean;
    transcription: boolean;
    tts: boolean;
    embeddings: boolean;
    knowledge: boolean;
}
export interface DelegationConfig {
    enabled: boolean;
    targetDeviceId: string | null;
    targetAgentId: string | null;
    capabilities: DelegationCapabilities;
}
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | ReadonlyArray<JsonValue>;
export interface JsonObject {
    readonly [key: string]: JsonValue;
}
export interface ToolCallData {
    readonly id: string;
    readonly name: string;
    readonly arguments: JsonObject;
}
export interface ToolCallErrorData {
    readonly code: string;
    readonly message: string;
}
export interface InferenceMetrics {
    readonly ttft: number;
    readonly tps: number;
    readonly totalTokens: number;
    readonly durationMs: number;
    readonly promptTokens: number | null;
    readonly cacheTokens: number | null;
}
export interface RagSourceData {
    readonly label: string;
    readonly fileName: string;
    readonly chunkIndex: number;
    readonly excerpt: string;
    readonly attachmentId: string | null;
    readonly artifactId: string | null;
    readonly documentId: string | null;
    readonly score: number;
}
export interface ToolApprovalRequest {
    readonly id: string;
    readonly toolCallId?: string | undefined;
    readonly runId?: string | null | undefined;
    readonly toolName: string;
    readonly action?: string | undefined;
    readonly args: JsonObject;
}
export type StreamEvent = {
    readonly type: 'thinking';
    readonly token: string;
} | {
    readonly type: 'content';
    readonly token: string;
} | {
    readonly type: 'tool-call';
    readonly call: ToolCallData;
} | {
    readonly type: 'tool-call-error';
    readonly error: ToolCallErrorData;
} | {
    readonly type: 'metrics';
    readonly metrics: InferenceMetrics;
} | {
    readonly type: 'tool-approval-request';
    readonly request: ToolApprovalRequest;
} | {
    readonly type: 'tool-exec-start';
    readonly id: string;
    readonly command: string;
} | {
    readonly type: 'tool-exec-output';
    readonly id: string;
    readonly data: string;
} | {
    readonly type: 'tool-exec-done';
    readonly id: string;
    readonly exitCode: number;
    readonly durationMs: number;
} | {
    readonly type: 'tool-result';
    readonly id: string;
    readonly name: string;
    readonly data: JsonObject;
} | {
    readonly type: 'turn-start';
} | {
    readonly type: 'model-loading';
    readonly modelName: string;
} | {
    readonly type: 'model-loaded';
    readonly modelName: string;
} | {
    readonly type: 'image-model-loading';
    readonly choice: ImageModelChoice;
} | {
    readonly type: 'image-model-load-progress';
    readonly choice: ImageModelChoice;
    readonly downloaded: number;
    readonly total: number;
    readonly percentage: number;
} | {
    readonly type: 'image-model-loaded';
    readonly choice: ImageModelChoice;
    readonly ok: boolean;
} | {
    readonly type: 'image-generation-progress';
    readonly id: string;
    readonly percentage: number;
} | {
    readonly type: 'vision-processing';
    readonly fileName: string;
} | {
    readonly type: 'vision-done';
} | {
    readonly type: 'vision-error';
    readonly fileName: string;
    readonly reason: string;
} | {
    readonly type: 'audio-transcribing';
    readonly fileName: string;
} | {
    readonly type: 'audio-done';
} | {
    readonly type: 'ocr-processing';
    readonly fileName: string;
} | {
    readonly type: 'ocr-done';
    readonly fileName: string;
    readonly blockCount: number;
} | {
    readonly type: 'rag-sources';
    readonly sources: ReadonlyArray<RagSourceData>;
} | {
    readonly type: 'rag-notice';
    readonly message: string;
} | {
    readonly type: 'web-search-start';
    readonly id: string;
    readonly query: string;
} | {
    readonly type: 'web-search-done';
    readonly id: string;
    readonly resultCount: number;
    readonly engineSummary: ReadonlyArray<{
        readonly engine: string;
        readonly status: 'ok' | 'timeout' | 'error';
        readonly resultCount: number;
    }>;
};
export interface LocalStreamEvent {
    readonly runId: string;
    readonly chatId: string;
    readonly event: StreamEvent;
}
export interface RemoteStreamEvent {
    readonly taskId: string;
    readonly chatId: string;
    readonly event: StreamEvent | {
        readonly type: 'done';
    };
    readonly targetDeviceId?: string | undefined;
}
export interface NetworkAddress {
    readonly host: string;
    readonly port: number;
}
export interface DhtConnectionStat {
    readonly host: string | null;
    readonly port: number | null;
    readonly online: boolean | null;
    readonly degraded: boolean | null;
    readonly connections: number;
    readonly peers: ReadonlyArray<string>;
}
export interface DhtHealthStat {
    readonly online: boolean;
    readonly degraded: boolean;
    readonly cold: boolean;
    readonly idle: boolean;
    readonly responses: number;
    readonly timeouts: number;
    readonly timeoutsRate: number;
}
export interface DhtConfigStat {
    readonly concurrency: number;
    readonly maxWindow: number;
    readonly randomPunchInterval: number;
    readonly connectionKeepAlive: number;
    readonly sendDownHints: boolean;
    readonly downHintsRateLimit: number;
}
export interface NetworkStat {
    readonly tick: number;
    readonly localAddress: NetworkAddress | null;
    readonly remoteAddress: NetworkAddress | null;
    readonly connection: DhtConnectionStat;
    readonly stats: Record<string, unknown>;
    readonly health: DhtHealthStat;
    readonly nodes: number;
    readonly config: DhtConfigStat;
}
export interface ProcessMemoryStat {
    readonly percent: number;
    readonly rss: number;
    readonly total: number;
    readonly heapPercent: number;
    readonly heapUsed: number;
    readonly heapTotal: number;
    readonly external: number;
}
export interface ProcessStat {
    readonly timestamp: string;
    readonly cpu: number;
    readonly cpuThread: number;
    readonly cpus: number;
    readonly memory: ProcessMemoryStat;
    readonly delay: number;
    readonly runtime: number;
}
export interface MeshStat {
    readonly head: {
        readonly key: string;
        readonly length: number;
    };
    readonly system?: {
        readonly key: string | null;
        readonly length: number;
    };
    readonly flushes?: number;
    readonly writable: boolean;
}
export interface MemoryBudgetStat {
    readonly totalBytes: number;
    readonly availableBytes: number;
    readonly source: string;
}
export type ModelEvictionPolicyId = 'single-active' | 'lru' | 'keep-during-turn';
export interface ModelLifecycleConfig {
    readonly policy: ModelEvictionPolicyId;
    readonly cap: number;
    readonly unloadTimeoutMs?: number;
}
