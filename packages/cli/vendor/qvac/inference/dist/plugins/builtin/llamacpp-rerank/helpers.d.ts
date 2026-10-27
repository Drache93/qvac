import type { RerankConfig as NativeRerankConfig } from '@qvac/embed-llamacpp';
import type { RerankConfig } from '../../../schemas/index.js';
export declare function transformRerankConfig(config: RerankConfig): NativeRerankConfig;
