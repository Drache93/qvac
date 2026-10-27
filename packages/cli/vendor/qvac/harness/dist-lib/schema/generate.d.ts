interface HRPCHandler {
    name: string;
    request?: {
        name: string;
        send?: boolean;
        stream?: boolean;
    };
    response?: {
        name: string;
        stream?: boolean;
    };
}
interface HRPCBuilderLike {
    handlers: ReadonlyArray<HRPCHandler>;
}
interface CallSiteOptions {
    readonly optionalRequests?: ReadonlySet<string>;
    readonly exportName?: string;
}
export declare function writeBind(builder: HRPCBuilderLike, outFile: string): void;
export declare function writeClient(builder: HRPCBuilderLike, outFile: string, options?: CallSiteOptions | string): void;
export declare function writeCapabilities(builder: HRPCBuilderLike, outFile: string, options?: CallSiteOptions): void;
export declare function writeConfigTypes(outFile: string): void;
export {};
