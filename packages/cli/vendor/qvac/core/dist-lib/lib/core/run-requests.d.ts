import type { QvacAgent, QvacChunk } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh, MeshDispatcher } from './mesh.ts';
export interface RunnerChoice {
    readonly deviceId: Buffer;
    readonly peers: ReadonlyArray<string>;
    readonly agent: Pick<QvacAgent, 'providerDeviceId'>;
}
export declare function pickRunner(mesh: Mesh, { deviceId, peers, agent }: RunnerChoice): Promise<Buffer | undefined>;
export declare function takeRunRequest(store: Mesh, id: string): Promise<QvacChunk>;
export declare function handedOffRequests(store: Mesh, deviceId: Buffer, chatId: string): Promise<QvacChunk[]>;
export declare function takeBack(requests: ReadonlyArray<QvacChunk>, into: MeshDispatcher): void;
