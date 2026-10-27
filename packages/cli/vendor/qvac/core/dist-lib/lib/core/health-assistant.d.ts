import type { QvacAgent, QvacDevice } from '../../spec/mesh/hyperschema/types.d.ts';
export declare const HEALTH_ASSISTANT_ID = "qvac-health-assistant";
export type HealthAssistantHost = Pick<QvacDevice, 'id' | 'platform'>;
export interface HealthAssistantOptions {
    readonly at?: number;
}
export declare function buildHealthAssistant(device: HealthAssistantHost, { at }?: HealthAssistantOptions): QvacAgent;
