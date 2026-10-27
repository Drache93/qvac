import { bindApi } from '../spec/bind.js';
import { engineClient } from '../spec/calls.js';
import DefaultHRPC from '../spec/hrpc/index.js';
export async function openLocalSpec() {
    return { bindApi, HRPC: DefaultHRPC };
}
export async function openLocalEngineSpec() {
    return { engineClient, bindApi, HRPC: DefaultHRPC };
}
