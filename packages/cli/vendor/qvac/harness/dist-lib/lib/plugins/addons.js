export async function loadAddons(owner, addons = {}) {
    if (typeof globalThis.Bare === 'undefined') {
        return;
    }
    await Promise.all(Object.entries(addons).map(([name, load]) => Promise.resolve()
        .then(load)
        .catch((error) => {
        throw new Error(`${owner} could not load addon '${name}': ${error.message}`, {
            cause: error
        });
    })));
}
