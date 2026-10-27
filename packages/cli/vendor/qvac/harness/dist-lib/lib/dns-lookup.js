import * as dns from '#dns';
export function lookupHost(hostname) {
    return new Promise((resolve, reject) => {
        const callback = (err, addresses) => {
            if (err) {
                reject(err);
                return;
            }
            resolve((addresses ?? []).map((entry) => entry.address));
        };
        dns.lookup(hostname, { all: true }, callback);
    });
}
