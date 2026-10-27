import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import type { LogLevel, LogRecord } from '../log.ts';
export interface LogSource {
    backfill(): ReadonlyArray<LogRecord>;
    subscribe(listener: (record: LogRecord) => void): void;
    unsubscribe(listener: (record: LogRecord) => void): void;
    write(input: {
        level: LogLevel;
        scope: ReadonlyArray<string>;
        message: string;
        at: number;
    }): void;
}
export declare function createLogsApi(source: LogSource): Pick<CapabilityHandlers, 'logsWatch' | 'writeLog'>;
