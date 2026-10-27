import Suspendify from 'suspendify';
export declare const ASSISTANT_WAKEUP_LINGER_MS = 6000;
interface LifecycleSupervisor {
    readonly opened: boolean;
    ready(): Promise<void>;
    presuspend(): Promise<void>;
    suspend(): Promise<void>;
    wakeup(): Promise<void>;
    resume(): Promise<void>;
}
export interface AssistantSuspendLifecycleOptions {
    readonly wakeupLinger?: number;
    readonly pollLinger?: () => Promise<number> | number;
    readonly onSuspended?: () => void;
}
export declare function createAssistantSuspendLifecycle(supervisor: LifecycleSupervisor, options?: AssistantSuspendLifecycleOptions): Suspendify;
export {};
