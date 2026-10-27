import { isPrivateOrBlocked } from './tools/private-ip.js';
export class BlockedAddressError extends Error {
    code = 'EBLOCKEDADDR';
    constructor(hostname, address) {
        super(`Requests to "${hostname}" resolve to blocked address "${address}".`);
        this.name = 'BlockedAddressError';
    }
}
export function makeValidatingLookup(rawLookup) {
    return (hostname, opts, cb) => {
        rawLookup(hostname, opts, (err, addresses) => {
            if (err || addresses === null) {
                cb(err, addresses);
                return;
            }
            for (const record of addresses) {
                if (isPrivateOrBlocked(record.address)) {
                    cb(new BlockedAddressError(hostname, record.address), null);
                    return;
                }
            }
            cb(null, addresses);
        });
    };
}
