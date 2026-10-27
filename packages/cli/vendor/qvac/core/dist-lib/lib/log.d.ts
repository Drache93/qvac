import type { LoggerInterface } from '@qvac/logging';
import { type LogLevel as QvacLogLevel } from '@qvac/logging/constants';
export type LogLevel = Exclude<QvacLogLevel, 'off'>;
export type LogOrigin = 'core' | 'client';
export interface LogRecord {
    readonly seq: number;
    readonly at: number;
    readonly level: LogLevel;
    readonly scope: ReadonlyArray<string>;
    readonly message: string;
    readonly origin: LogOrigin;
    readonly originDeviceId?: Buffer | undefined;
}
export interface LogClientInput {
    readonly level: LogLevel;
    readonly scope: ReadonlyArray<string>;
    readonly message: string;
    readonly at: number;
    readonly originDeviceId?: Buffer;
}
export interface LoggerOptions {
    dev?: boolean;
    verbose?: boolean | undefined;
    logFile?: string | undefined;
    logLevel?: QvacLogLevel | undefined;
    logFileMaxSize?: number;
}
export interface LogFlags {
    logFile?: string | undefined;
    logLevel?: string | undefined;
    logVerbose?: boolean | undefined;
}
export declare function isLogLevel(value: unknown): value is QvacLogLevel;
export declare function toLoggerOptions(flags: LogFlags): LoggerOptions;
export declare class Logger implements LoggerInterface {
    private _muted;
    private _dev;
    private _verbose;
    private _level;
    private _system;
    private _file;
    private _seq;
    private readonly _subscribers;
    private readonly _buffer;
    constructor({ dev, verbose, logFile, logLevel, logFileMaxSize }?: LoggerOptions);
    getLevel(): QvacLogLevel;
    mute(): void;
    unmute(): void;
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    subscribe(listener: (record: LogRecord) => void): void;
    unsubscribe(listener: (record: LogRecord) => void): void;
    backfill(): ReadonlyArray<LogRecord>;
    onRotate(listener: (path: string, archived: string | null) => void): void;
    close(): void;
    appendClient(input: LogClientInput): void;
    _write(level: LogLevel, ...args: unknown[]): void;
    private _sink;
}
