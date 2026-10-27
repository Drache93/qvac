export function installSdkConfigLoader() {
    if ('require' in globalThis)
        return;
    const module = Reflect.get(import.meta, 'cache')[import.meta.url];
    Object.defineProperty(globalThis, 'require', {
        configurable: true,
        value: Reflect.get(module, 'constructor').createRequire(import.meta.url, { module })
    });
}
