import type { Mesh } from './mesh.ts';
export type ChatActivityState = 'queued' | 'running' | 'generating-image' | 'generating-audio' | 'transcribing-audio' | 'awaiting-approval' | 'awaiting-download' | 'paused' | 'recovery-required';
export interface ChatActivityRow {
    readonly id: string;
    readonly activityState: ChatActivityState;
}
export declare function listChatActivity(store: Mesh, chatIds?: ReadonlyArray<string>): Promise<ChatActivityRow[]>;
