import type { Router } from '../../../spec/mesh/hyperdispatch/index.js';
import type { QvacDevice, QvacWriterClaim } from '../../../spec/mesh/hyperschema/types.d.ts';
import type { RouterContext } from './types.ts';
type Admission = 'admitted' | 'refused' | 'writer-only';
type Claim = Pick<QvacWriterClaim, 'claimedMemberId' | 'inviteToken'> & {
    readonly deviceSignature?: Buffer | null;
};
interface WriterCandidate {
    readonly id: Buffer;
    readonly writerKey: Buffer;
    readonly claim?: Claim;
}
export declare function admitDevice({ tx, node, host, meshPublicKey, log }: RouterContext, device: QvacDevice | null | undefined, { id, writerKey, claim }: WriterCandidate): Promise<Admission>;
export declare function registerWriterRoutes(router: Router): void;
export {};
