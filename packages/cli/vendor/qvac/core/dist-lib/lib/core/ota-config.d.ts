import Hyperconf from 'hyperconf';
import type Corestore from 'corestore';
import type { Hypercore } from 'corestore';
import { type ReleaseLane } from './app-build.ts';
import { type ConfConfig } from '../../spec/config/hyperconf/index.js';
export type ConfigChannel = ReleaseLane;
export interface ConfigCore {
    readonly key: string;
    readonly minLength: number;
}
export declare function resolveConfigChannel(channel?: string | null): ConfigChannel | null;
export declare function configCoreFor(channel: ConfigChannel): ConfigCore;
export declare function vendoredMinSupportedVersion(): string;
export declare class OtaConfigReader extends Hyperconf<ConfConfig> {
    constructor(store: Corestore, { key, minLength }: ConfigCore);
    get minSupportedVersion(): string | null;
}
export declare function readOtaConfig(core: Hypercore): Promise<ConfConfig | null>;
export declare function publishOtaConfig(core: Hypercore, config: ConfConfig): Promise<number>;
