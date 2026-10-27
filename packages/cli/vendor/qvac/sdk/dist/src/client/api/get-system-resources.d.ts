import { type GetSystemResourcesInput, type SystemResources } from '@qvac/inference/surface';
/**
 * Read the worker's system capabilities and optional resource sample.
 *
 * @param input - Optional settings; set `sample` to request a current resource sample.
 * @returns System capabilities with availability information and a sample when provided by the worker.
 * @throws {InvalidResponseError} If the worker returns a different response type.
 * @throws {Error} If the RPC request fails.
 */
export declare function getSystemResources(input?: GetSystemResourcesInput): Promise<SystemResources>;
//# sourceMappingURL=get-system-resources.d.ts.map