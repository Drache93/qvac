import type { LoggerInterface } from '@qvac/logging';
export declare function instrument<T extends object>(handlers: T, log: LoggerInterface | null): T;
