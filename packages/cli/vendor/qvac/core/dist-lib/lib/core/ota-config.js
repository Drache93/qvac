import b4a from 'b4a';
import { Range } from 'bare-semver';
import c from 'compact-encoding';
import Hyperconf from 'hyperconf';
import HypercoreId from 'hypercore-id-encoding';
import { RELEASE_LANES } from './app-build.js';
import spec, {} from '../../spec/config/hyperconf/index.js';
const CONFIG_CORES = {
    dev: { key: 'e5g337qdk4qachns5nsnu63wjp96twyc34ainucherhq1zodanmy', minLength: 1 },
    staging: { key: '89mz9t33g1c8e4nsjuzafjcbsdht74akzouw3ptfzewnuathpkcy', minLength: 1 },
    prod: { key: 'enuaa7ybdsp3ons73yrazrno9gwrejx4tum3kdws6rps1p1bekgo', minLength: 1 }
};
export function resolveConfigChannel(channel) {
    return RELEASE_LANES.find((lane) => lane === channel) ?? null;
}
export function configCoreFor(channel) {
    return CONFIG_CORES[channel];
}
export function vendoredMinSupportedVersion() {
    return spec.production.minSupportedVersion;
}
export class OtaConfigReader extends Hyperconf {
    constructor(store, { key, minLength }) {
        super(spec, store.get(HypercoreId.decode(key)), { minLength, production: true });
    }
    get minSupportedVersion() {
        const range = this.current?.minSupportedVersion;
        return typeof range === 'string' && range.length > 0 ? range : null;
    }
}
export async function readOtaConfig(core) {
    await core.ready();
    if (!core.length) {
        return null;
    }
    const block = await core.get(core.length - 1);
    return block ? c.decode(spec.productionEncoding, block) : null;
}
export async function publishOtaConfig(core, config) {
    Range.parse(config.minSupportedVersion);
    await core.ready();
    await core.append(c.encode(spec.productionEncoding, config));
    await core.setUserData('hyperconf', b4a.from(String(core.length)));
    return core.length;
}
