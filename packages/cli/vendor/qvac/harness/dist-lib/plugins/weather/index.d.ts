import type { HarnessPlugin, PluginSetup } from '../../lib/plugins/index.ts';
export { weatherLookupTool } from './lookup.ts';
export { checkQualifier, cityMatches, fold, qualifierOf } from './place.ts';
export interface WeatherOptions {
    readonly read?: readonly string[];
    readonly geocodeTimeoutMs?: number;
}
export declare class Weather implements HarnessPlugin {
    readonly name = "weather";
    readonly api = 1;
    readonly read: readonly string[] | undefined;
    private readonly _geocodeTimeoutMs;
    constructor({ read, geocodeTimeoutMs }?: WeatherOptions);
    setup(): PluginSetup;
}
