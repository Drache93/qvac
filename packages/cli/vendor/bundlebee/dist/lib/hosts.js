"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hostModules = hostModules;
const bare_semver_1 = __importDefault(require("bare-semver"));
const errors_1 = require("./errors");
function hostModules(requirements, providers) {
    const builtins = Object.create(null);
    for (const required of requirements) {
        const provider = providers[required.specifier];
        if (!provider ||
            !bare_semver_1.default.Range.parse(required.version).test(bare_semver_1.default.Version.parse(provider.version)) ||
            (required.abi && provider.abi !== required.abi) ||
            (required.platform && provider.platform !== required.platform) ||
            (required.arch && provider.arch !== required.arch)) {
            throw new errors_1.ReleaseError('ERR_HOST_INCOMPATIBLE', 'Missing or incompatible host provider: ' + required.specifier);
        }
        builtins[required.specifier] = provider.exports;
    }
    return builtins;
}
