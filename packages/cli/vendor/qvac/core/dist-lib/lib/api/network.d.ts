import type { LoggerInterface } from '@qvac/logging';
import type { AssistantBlindPeering, AssistantNetworkStatus } from '../../spec/hyperschema/types.d.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
export interface NetworkSource {
    watch(listener: () => void): void;
    unwatch(listener: () => void): void;
    snapshot(): AssistantNetworkStatus;
    readonly sampled: true;
}
export interface BlindPeeringSource {
    watch(listener: () => void): void;
    unwatch(listener: () => void): void;
    snapshot(): AssistantBlindPeering;
    set(enabled: boolean): Promise<AssistantBlindPeering>;
}
export declare function createNetworkApi(source: NetworkSource, log: LoggerInterface | null): Pick<CapabilityHandlers, 'networkWatch'>;
export declare function createBlindPeeringApi(source: BlindPeeringSource, log: LoggerInterface | null): Pick<CapabilityHandlers, 'setBlindPeering' | 'blindPeeringWatch'>;
