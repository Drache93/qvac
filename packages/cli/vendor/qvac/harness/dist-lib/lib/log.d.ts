import { type LogLevel } from '@qvac/logging';
export type { LogLevel };
export type LineLevel = Exclude<LogLevel, 'off'>;
export type Sink = (line: string, level: LineLevel) => void;
export interface HostLogger {
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error?(...args: unknown[]): void;
    debug?(...args: unknown[]): void;
    getLevel?(): string;
}
export declare class HarnessLog {
    static error(message: string, data?: Record<string, unknown>): void;
    static warn(message: string, data?: Record<string, unknown>): void;
    static info(message: string, data?: Record<string, unknown>): void;
    static debug(message: string, data?: Record<string, unknown>): void;
    static diag(message: string, data?: Record<string, unknown>): void;
    static enable(on: boolean): void;
    static setLevel(level: LogLevel): void;
    static level(): LogLevel;
    static followHost(level: unknown): void;
    static toHost(next: HostLogger | null): void;
    static isLevel(value: unknown): value is LogLevel;
    static enabled(level: LineLevel): boolean;
    static setSink(next: Sink | null): void;
}
