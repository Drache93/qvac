import { bindApi } from '../spec/bind.js';
import { engineClient } from '../spec/calls.js';
import DefaultHRPC from '../spec/hrpc/index.js';
export interface CoreSpec {
    bindApi: typeof bindApi;
    HRPC: typeof DefaultHRPC;
}
export interface EngineSpec {
    engineClient: typeof engineClient;
    bindApi: typeof bindApi;
    HRPC: typeof DefaultHRPC;
}
export declare function openLocalSpec(): Promise<CoreSpec>;
export declare function openLocalEngineSpec(): Promise<EngineSpec>;
