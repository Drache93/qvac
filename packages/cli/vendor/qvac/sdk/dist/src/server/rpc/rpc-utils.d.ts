import { type AbortSignal } from 'bare-abort-controller';
export declare function getNextCommandId(): number;
export declare function isTerminalChunk<T>(value: T): value is T & {
    done: true;
};
/** Aborts when the client destroys its end of `wire` (and after a normal end). */
export declare function signalOnWireClose(wire: {
    on(event: 'close', listener: () => void): unknown;
}): AbortSignal;
//# sourceMappingURL=rpc-utils.d.ts.map