export type CompletionStats = {
  timeToFirstToken?: number;
  tokensPerSecond?: number;
  promptTokensPerSecond?: number;
  promptTokens?: number;
  generatedTokens?: number;
  emittedTokens?: number;
  backendDevice?: "cpu" | "gpu";
};
export type StopReason = "eos" | "length" | "stopSequence" | "cancelled";
export type CompletionEvent =
  | {
      type: "contentDelta" | "rawDelta" | "thinkingDelta";
      seq: number;
      text: string;
    }
  | { type: "completionStats"; seq: number; stats: CompletionStats }
  | {
      type: "completionDone";
      seq: number;
      stopReason?: StopReason;
      raw?: { fullText: string };
    }
  | {
      type: "completionDone";
      seq: number;
      stopReason: "error";
      error: { message: string };
      raw?: { fullText: string };
    };
export type CompletionFinal = {
  contentText: string;
  thinkingText?: string;
  toolCalls: never[];
  stats?: CompletionStats;
  stopReason?: StopReason;
  raw: { fullText: string };
  cacheableAssistantContent?: string;
};
export type CompletionRun = {
  requestId: string;
  events: AsyncIterable<CompletionEvent>;
  final: Promise<CompletionFinal>;
  tokenStream: AsyncGenerator<string>;
  toolCallStream: AsyncGenerator<never>;
  text: Promise<string>;
  toolCalls: Promise<never[]>;
  stats: Promise<CompletionStats | undefined>;
};
export type BrowserLoadModelOptions = { modelSrc: string; ctxSize?: number };
export type BrowserCompletionParams = {
  modelId: string;
  history: { role: "system" | "user" | "assistant"; content: string }[];
  stream?: boolean;
  generationParams?: { predict?: number; temp?: number; seed?: number };
};
export type BrowserCancelOptions = { requestId: string } | { modelId: string };
export type BrowserClient = {
  loadModel(options: BrowserLoadModelOptions): Promise<string>;
  completion(params: BrowserCompletionParams): CompletionRun;
  cancel(options: BrowserCancelOptions): Promise<void>;
  unloadModel(options: { modelId: string }): Promise<void>;
  close(): void | Promise<void>;
};
export type BrowserProgress = {
  phase?: string;
  downloaded: number;
  total: number;
  percentage: number;
  resumed?: boolean;
  cacheHit?: boolean;
};
export type DiagnosticValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | DiagnosticValue[]
  | { [key: string]: DiagnosticValue };
export type BrowserClientOptions = {
  assetsBaseUrl?: string | URL;
  worker?: Worker;
  wasmUrl?: string;
  onLog?: (message: string) => void;
  onProgress?: (progress: BrowserProgress) => void;
  onDiagnostics?: (diagnostics: { [key: string]: DiagnosticValue }) => void;
};
export declare class InferenceCancelledError extends Error {
  constructor(
    requestId: string,
    partial?: { text?: string; toolCalls?: never[]; stats?: CompletionStats },
  );
  readonly requestId: string;
  readonly partial: {
    text?: string;
    toolCalls?: never[];
    stats?: CompletionStats;
  };
}
/** Experimental text-only API; model acquisition and inference run in its Worker. */
export declare function createBrowserClient(
  options?: BrowserClientOptions,
): BrowserClient;
