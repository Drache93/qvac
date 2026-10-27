import type { ToolDefinition } from '../../lib/contract/index.ts';
export interface WeatherLookupToolOptions {
    readonly geocodeTimeoutMs?: number | undefined;
}
export declare function createWeatherLookupTool({ geocodeTimeoutMs }?: WeatherLookupToolOptions): ToolDefinition;
export declare const weatherLookupTool: ToolDefinition;
