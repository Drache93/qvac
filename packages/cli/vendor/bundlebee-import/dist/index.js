"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const link_1 = require("./lib/link");
const network_1 = require("./lib/network");
const errors_1 = require("./lib/errors");
async function importRelease(store, pin, options = {}) {
    (0, errors_1.cancelled)(options.signal);
    const { default: Bundlebee } = await import('bundlebee');
    const bundle = new Bundlebee(store.session(), { key: pin.key, offline: true });
    try {
        await bundle.ready();
        const module = await bundle.loadRelease(pin, { ...options, offline: true });
        return module.exports;
    }
    catch (error) {
        throw (0, errors_1.importFailure)(error, { signal: options.signal });
    }
    finally {
        await bundle.close();
    }
}
async function resolve(store, link, options = {}) {
    (0, errors_1.cancelled)(options.signal);
    const parsed = (0, link_1.parseLink)(link, options);
    const { default: Bundlebee } = await import('bundlebee');
    const session = store.session();
    const bundle = new Bundlebee(session, { key: parsed.key, offline: options.offline === true });
    const network = new network_1.Network(session, bundle, options);
    let pin;
    try {
        await bundle.ready();
        if (options.offline) {
            pin = await bundle.resolve({ ...parsed.selector, offline: true, signal: options.signal });
        }
        else {
            pin = await resolveOnline(bundle, network, parsed.selector);
        }
        if ((parsed.length !== null && parsed.length !== pin.length) ||
            (parsed.entry && parsed.entry !== pin.entry)) {
            throw new errors_1.ImportError('Release does not match the link snapshot or entry', {
                code: 'ERR_INVALID_RELEASE_LINK'
            });
        }
        return pin;
    }
    catch (error) {
        throw (0, errors_1.importFailure)(error, { signal: options.signal, deadline: network.signal });
    }
    finally {
        try {
            await network.close();
        }
        finally {
            await bundle.close();
        }
    }
}
async function resolveOnline(bundle, network, selector) {
    if (network.options.blindPeers?.length) {
        const signal = network.connectMirrors();
        try {
            await bundle.update({ signal });
            return await bundle.resolve({ ...selector, signal });
        }
        catch (error) {
            if (!(0, errors_1.unavailable)(error, signal) || network.options.fallback === false) {
                throw (0, errors_1.importFailure)(error, { signal: network.options.signal, deadline: signal });
            }
        }
    }
    if (network.options.fallback === false) {
        throw new errors_1.ImportError('No mirrors configured and discovery is disabled', {
            code: 'ERR_IMPORT_UNAVAILABLE'
        });
    }
    await network.discover();
    await bundle.update({ signal: network.signal });
    return bundle.resolve({ ...selector, signal: network.signal });
}
async function prepare(store, pin, options = {}) {
    (0, errors_1.cancelled)(options.signal);
    const { default: Bundlebee } = await import('bundlebee');
    const session = store.session();
    const bundle = new Bundlebee(session, { key: pin.key, offline: true });
    const network = new network_1.Network(session, bundle, options);
    try {
        await bundle.ready();
        try {
            return await bundle.prefetch(pin, { offline: true, signal: options.signal });
        }
        catch (error) {
            if (options.offline ||
                !(error instanceof Error) ||
                !('code' in error) ||
                error.code !== 'ERR_RELEASE_NOT_CACHED') {
                throw error;
            }
        }
        if (options.blindPeers?.length) {
            const signal = network.connectMirrors();
            try {
                return await bundle.prefetch(pin, { offline: false, signal });
            }
            catch (error) {
                if (!(0, errors_1.unavailable)(error, signal) || options.fallback === false) {
                    throw (0, errors_1.importFailure)(error, { signal: options.signal, deadline: signal });
                }
            }
        }
        if (options.fallback === false) {
            throw new errors_1.ImportError('No mirrors configured and discovery is disabled', {
                code: 'ERR_IMPORT_UNAVAILABLE'
            });
        }
        await network.discover();
        return await bundle.prefetch(pin, { offline: false, signal: network.signal });
    }
    catch (error) {
        throw (0, errors_1.importFailure)(error, { signal: options.signal, deadline: network.signal });
    }
    finally {
        try {
            await network.close();
        }
        finally {
            await bundle.close();
        }
    }
}
exports.default = Object.assign(importRelease, { resolve, prepare });
