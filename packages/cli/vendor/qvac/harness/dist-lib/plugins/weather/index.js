import { PluginRegistry } from '../../lib/plugins/index.js';
import { createWeatherLookupTool } from './lookup.js';
export { weatherLookupTool } from './lookup.js';
export { checkQualifier, cityMatches, fold, qualifierOf } from './place.js';
export class Weather {
    name = 'weather';
    api = PluginRegistry.API_VERSION;
    read;
    _geocodeTimeoutMs;
    constructor({ read, geocodeTimeoutMs } = {}) {
        this.read = read;
        this._geocodeTimeoutMs = geocodeTimeoutMs;
    }
    setup() {
        return { tools: [createWeatherLookupTool({ geocodeTimeoutMs: this._geocodeTimeoutMs })] };
    }
}
