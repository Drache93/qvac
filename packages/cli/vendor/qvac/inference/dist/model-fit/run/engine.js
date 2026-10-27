/** Calls one engine's fitter, taken from the plugin that owns its addon. */
export async function callEngineFit(probe) {
    const { getAllPlugins } = await import('../../plugins/registry.js');
    const addonPackage = `@qvac/${probe.engine}`;
    const plugin = getAllPlugins().find((candidate) => candidate.addonPackage === addonPackage);
    if (plugin?.assessFit === undefined) {
        throw new TypeError(`no registered plugin exposes assessFit for ${addonPackage}`);
    }
    return {
        engine: probe.engine,
        result: await plugin.assessFit(probe.request)
    };
}
