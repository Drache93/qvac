import type { ApprovalCall, CompletionContext, DownloadContext, HarnessEvent, HostContext, HostSignal, ListModelsOptions, ModelInfo } from '../contract-types.ts';
import type { Transport } from '../rpc-session.ts';
export type ClientCompletionContext = Pick<CompletionContext, 'model' | 'messages' | 'cacheKey' | 'thinkingDefault' | 'toolConfigs' | 'generationParams' | 'responseFormat' | 'maxToolRounds' | 'progress' | 'askUser'> & {
    agent?: CompletionContext['agent'];
    signal?: HostSignal;
    approve?: (call: ApprovalCall) => boolean | Promise<boolean>;
};
export declare class HarnessClient {
    private readonly _transport;
    private _opening;
    private _closed;
    constructor(transport: Transport);
    completion(context: ClientCompletionContext): AsyncIterable<HarnessEvent>;
    download(context: HostContext<DownloadContext>): AsyncIterable<HarnessEvent>;
    list(options?: ListModelsOptions): Promise<ModelInfo[]>;
    close(): void;
    private _open;
    private _connect;
}
