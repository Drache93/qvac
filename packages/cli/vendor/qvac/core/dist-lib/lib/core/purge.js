export async function purgeCores(store, storage, discoveryKeys) {
    for (const discoveryKey of discoveryKeys) {
        if (!(await storage.hasCore(discoveryKey)))
            continue;
        await store.get({ discoveryKey, active: false }).purge();
    }
}
