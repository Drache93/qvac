import type Hyperschema from 'hyperschema';
interface HrpcRoute {
    name: string;
    stream: boolean;
}
interface HrpcNamespace {
    register(description: {
        name: string;
        request: HrpcRoute;
        response: HrpcRoute;
    }): void;
}
export declare function registerHarnessTypes(ns: Hyperschema.Namespace): void;
export declare function registerHarnessApi(api: HrpcNamespace): void;
export {};
