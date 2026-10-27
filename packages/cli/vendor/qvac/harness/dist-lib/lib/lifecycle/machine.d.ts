import { type SnapshotFrom } from 'xstate';
type Request = 'SUSPEND' | 'RESUME' | 'WAKEUP';
export interface LifecycleEvent {
    type: 'PRESUSPEND' | 'CLOSE' | Request;
}
export interface LifecycleWork {
    suspend(): Promise<void>;
    resume(): Promise<void>;
}
interface LifecycleContext {
    pending: Request | null;
    failureCount: number;
    failureMessage: string | null;
}
export declare const harnessLifecycle: import("xstate").StateMachine<LifecycleContext, LifecycleEvent, {
    [x: string]: import("xstate").ActorRefFromLogic<import("xstate").PromiseActorLogic<void, import("xstate").NonReducibleUnknown, import("xstate").EventObject>> | undefined;
}, {
    src: "resume";
    logic: import("xstate").PromiseActorLogic<void, import("xstate").NonReducibleUnknown, import("xstate").EventObject>;
    id: string | undefined;
} | {
    src: "suspend";
    logic: import("xstate").PromiseActorLogic<void, import("xstate").NonReducibleUnknown, import("xstate").EventObject>;
    id: string | undefined;
}, {
    type: "clear";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "hold";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "recordError";
    params: import("xstate").NonReducibleUnknown;
} | {
    type: "report";
    params: unknown;
}, {
    type: "resumeHeld";
    params: unknown;
} | {
    type: "suspendHeld";
    params: unknown;
} | {
    type: "wakeupHeld";
    params: unknown;
}, never, "presuspended" | "resuming" | "running" | "suspended" | "suspending" | "waking", string, import("xstate").NonReducibleUnknown, import("xstate").NonReducibleUnknown, import("xstate").EventObject, import("xstate").MetaObject, {
    id: "harness";
    states: {
        readonly running: {};
        readonly presuspended: {};
        readonly suspending: {};
        readonly suspended: {};
        readonly resuming: {};
        readonly waking: {};
    };
}, import("xstate").MetaObject>;
export interface HarnessLifecycle {
    readonly suspended: boolean;
    readonly state: SnapshotFrom<typeof harnessLifecycle>['value'];
    send(type: LifecycleEvent['type']): Promise<void>;
    settled(): Promise<SnapshotFrom<typeof harnessLifecycle>>;
    cancelPending(): void;
    stop(): void;
}
export declare function createHarnessLifecycle(work: LifecycleWork): HarnessLifecycle;
export {};
