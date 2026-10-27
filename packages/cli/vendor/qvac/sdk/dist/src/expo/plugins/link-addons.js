import { promises as fsp } from 'node:fs';
import path from 'node:path';
import link from 'bare-link';
import { findInAncestorNodeModules } from './find-in-ancestor-node-modules.js';
import { AddonLinkFailedError } from '../../utils/errors-client.js';
/** Where react-native-bare-kit builds each platform's linked addons from. */
const PLATFORMS = [
    { prefix: 'android-', out: ['android', 'src', 'main', 'addons'] },
    { prefix: 'ios-', out: ['ios', 'addons'] }
];
/**
 * Links the native addons the worker entry loads into react-native-bare-kit
 * for each phone platform in `hosts`, replacing what the platform had.
 */
export async function linkAddons(options) {
    const { projectRoot, entryPath, hosts, logger } = options;
    const bareKitDir = findInAncestorNodeModules(projectRoot, 'react-native-bare-kit');
    if (bareKitDir === null) {
        logger.warn('react-native-bare-kit is not installed; the native addons were not linked.');
        return [];
    }
    const written = [];
    for (const platform of PLATFORMS) {
        const platformHosts = hosts.filter((host) => host.startsWith(platform.prefix));
        if (platformHosts.length === 0)
            continue;
        // bare-link signs Apple frameworks with codesign.
        if (platform.prefix === 'ios-' && process.platform !== 'darwin') {
            logger.warn(`Linking iOS addons needs macOS; skipped ${platformHosts.join(', ')}.`);
            continue;
        }
        const out = path.join(bareKitDir, ...platform.out);
        await fsp.rm(out, { recursive: true, force: true });
        const platformWritten = [];
        try {
            for await (const resource of link(entryPath, { hosts: platformHosts, out })) {
                logger.debug(`Linked ${path.relative(projectRoot, resource)}`);
                platformWritten.push(resource);
            }
        }
        catch (error) {
            throw new AddonLinkFailedError(platformHosts, error);
        }
        warnOverwritten(platformWritten, out, logger);
        written.push(...platformWritten);
    }
    return written;
}
/**
 * Addons that ship a library under the same name write it to the same path,
 * and the copy linked last is the one the app loads.
 */
export function warnOverwritten(written, out, logger) {
    const seen = new Set();
    const overwritten = new Set();
    for (const file of written) {
        if (seen.has(file))
            overwritten.add(file);
        seen.add(file);
    }
    if (overwritten.size === 0)
        return;
    const files = [...overwritten].map((file) => path.relative(out, file)).sort();
    logger.warn(`Several native addons ship ${files.join(', ')}; only the copy linked last is kept.`);
}
