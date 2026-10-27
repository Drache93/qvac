import type { Capabilities, CapabilityHandlers } from '../../spec/capabilities.d.ts';
export declare const DEVICE_ROUTES: readonly ["listModels", "deleteModel", "loadModel", "unloadModel", "retryModelDownload", "clearModelDownload", "modelCatalogWatch", "modelDownloadsWatch", "customModelsWatch", "previewCustomModel", "addCustomModel", "removeCustomModel", "modelUsers", "modelsWatch", "configGet", "configSet", "configWatch", "setModelPaused"];
export type DeviceRoutes = Pick<CapabilityHandlers, (typeof DEVICE_ROUTES)[number]>;
export interface ForwardingOptions {
    readonly deviceId: Buffer;
    readonly remote: (deviceId: Buffer) => Capabilities;
}
export declare function forwardToDevices(local: Partial<CapabilityHandlers>, opts: ForwardingOptions): DeviceRoutes;
export declare function servedToSiblings(local: Partial<CapabilityHandlers>): DeviceRoutes;
