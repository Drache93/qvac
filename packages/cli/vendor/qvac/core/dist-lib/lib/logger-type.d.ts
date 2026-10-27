import type { LoggerInterface } from '@qvac/logging';
import type { LogClientInput, LogRecord } from './log.ts';
export interface Logger extends LoggerInterface {
    mute(): void;
    unmute(): void;
    subscribe(listener: (record: LogRecord) => void): void;
    unsubscribe(listener: (record: LogRecord) => void): void;
    backfill(): ReadonlyArray<LogRecord>;
    appendClient(input: LogClientInput): void;
}
