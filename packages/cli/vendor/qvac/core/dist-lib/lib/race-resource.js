export function raceResource(resource, operation, name) {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            resource.off('close', onClose);
            resource.off('error', onError);
        };
        const onClose = () => {
            cleanup();
            reject(new Error(`${name} closed during open`));
        };
        const onError = (...args) => {
            cleanup();
            reject(args[0]);
        };
        resource.on('close', onClose);
        resource.on('error', onError);
        operation.then((value) => {
            cleanup();
            resolve(value);
        }, (err) => {
            cleanup();
            reject(err);
        });
    });
}
