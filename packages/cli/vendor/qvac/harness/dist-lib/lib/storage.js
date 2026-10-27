import { homedir } from 'os';
import { join } from 'path';
import process from 'process';
import { persistent } from 'bare-storage';
import { isAndroid, isIOS } from 'which-runtime';
export const MODEL_CACHE_PATH_ENV = 'QVAC_MODEL_CACHE_PATH';
export const SDK_HOME_ENV = 'SNAP_USER_COMMON';
export function releaseChannel(environment) {
    if (environment === 'production' || environment === 'prod')
        return 'prod';
    if (environment === 'staging')
        return 'staging';
    return 'dev';
}
export function resolveStorage(channel, overrides = {}, env = process.env) {
    const snapCommon = env[SDK_HOME_ENV];
    const root = overrides.root ?? join(snapCommon ?? persistent(), 'qvac', channel);
    const onMobile = isAndroid || isIOS;
    const canonicalSdkHome = snapCommon ?? (onMobile ? persistent() : (env['HOME'] ?? env['USERPROFILE'] ?? homedir()));
    return {
        root,
        assistant: join(root, 'assistant'),
        sdk: {
            home: join(root, 'sdk-home'),
            models: overrides.models ?? join(canonicalSdkHome, '.qvac', 'models')
        }
    };
}
