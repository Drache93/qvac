import type { RpcDevice, RpcServerCandidate } from '../schemas/rpc-server.js';
export type RpcDeviceMapping = RpcDevice & {
    url: string;
    alias: string;
};
/**
 * Pass exactly this load's rpc-servers endpoints in the same order, even on
 * reused workers. Aliases enumerate every device in that order, starting at RPC0
 * for each load. Use the aliases to select devices; tensor-split weights follow
 * the selected devices order. Repeated endpoints are skipped by this helper,
 * but rpc-servers must contain unique endpoints. Discovery does not register devices.
 */
export declare function getRpcDeviceMap(servers: readonly RpcServerCandidate[]): RpcDeviceMapping[];
