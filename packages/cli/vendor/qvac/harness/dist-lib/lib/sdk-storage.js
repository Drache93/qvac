import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import process from 'process';
import { isBareKit } from 'which-runtime';
import { installSdkConfigLoader } from '#sdk-config-loader';
import { isRecord } from './guards.js';
import { SDK_HOME_ENV } from './storage.js';
export const SDK_CONFIG_PATH_ENV = 'QVAC_CONFIG_PATH';
export const OPENCL_CACHE_DIR_ENV = 'QVAC_OPENCL_CACHE_DIR';
export const SDK_OPTIONS_ENV = 'QVAC_SDK_OPTIONS';
const FIT_STUB_BUDGET_MS = 10_000;
export function configureSdkStorage(storage, channels = {}) {
    const { env = process.env, argv = isBareKit ? Bare.argv : null } = channels;
    installSdkConfigLoader();
    mkdirSync(storage.home, { recursive: true });
    const configPath = join(storage.home, 'qvac.config.json');
    const config = {
        ...hostOptions(env[SDK_OPTIONS_ENV]),
        cacheDirectory: storage.models,
        fitStubBudgetMs: FIT_STUB_BUDGET_MS
    };
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const openclCacheDir = join(storage.home, 'opencl-cache');
    mkdirSync(openclCacheDir, { recursive: true });
    if (argv) {
        argv[0] = storage.home;
    }
    else {
        env[SDK_HOME_ENV] = storage.home;
    }
    env[SDK_CONFIG_PATH_ENV] = configPath;
    env[OPENCL_CACHE_DIR_ENV] = openclCacheDir;
    return configPath;
}
function hostOptions(file) {
    if (!file) {
        return {};
    }
    const options = JSON.parse(readFileSync(file, 'utf8'));
    if (!isRecord(options) || Array.isArray(options)) {
        throw new Error(`${SDK_OPTIONS_ENV} must name a JSON object: ${file}`);
    }
    return options;
}
