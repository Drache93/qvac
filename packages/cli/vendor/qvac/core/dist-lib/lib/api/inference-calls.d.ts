import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import type { InferenceCallEntry } from '../inference-calls.ts';
export interface InferenceCallSource {
    list(chatId: string): {
        calls: ReadonlyArray<InferenceCallEntry>;
        truncated: boolean;
    };
    forget(chatId: string): Promise<void>;
}
export interface InferenceCallAnswer {
    calls: ReadonlyArray<InferenceCallEntry>;
    truncated: boolean;
}
export interface InferenceCallReader {
    list(meshId: string, chatId: string): Promise<InferenceCallAnswer>;
    forget(chatId: string): Promise<void>;
}
export declare function createInferenceCallsApi(reader: InferenceCallReader): Pick<CapabilityHandlers, 'inferenceCalls'>;
