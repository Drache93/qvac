import type { Drive } from './drive.ts';
export interface WriteTextOptions {
    executable?: boolean;
}
export declare function writeText(drive: Drive, key: string, text: string, opts?: WriteTextOptions): Promise<void>;
