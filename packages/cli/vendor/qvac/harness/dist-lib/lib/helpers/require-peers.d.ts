export type PeerResolvers = Readonly<Record<string, () => unknown>>;
export declare function missingPeers(peers: PeerResolvers): string[];
export declare function requirePeers(subject: string, peers: PeerResolvers): void;
