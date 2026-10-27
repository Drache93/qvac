import * as dns from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import { isRecord } from './guards.js';
import { isPrivateOrBlocked } from './tools/private-ip.js';
import { runNoRedirectFetch } from './no-redirect-fetch-impl.js';
export function noRedirectFetch(url, init = {}) {
    const request = (target, options, onresponse) => {
        const common = {
            method: options.method,
            headers: options.headers,
            lookup: createLookup(options.validatedAddresses)
        };
        const forward = (res) => onresponse(res);
        return (target.protocol === 'https:' ? https : http).request(target.href, common, forward);
    };
    return runNoRedirectFetch(request, url, init);
}
export function createLookup(validatedAddresses) {
    return (hostname, options, callback) => {
        const wantsAll = isRecord(options) && options.all === true;
        const fail = () => {
            callback(new Error(`Requests to "${hostname}" resolve to a blocked address.`), '', 0);
        };
        const respond = (records) => {
            const [first] = records;
            if (!first || records.some((record) => isPrivateOrBlocked(record.address))) {
                fail();
                return;
            }
            if (wantsAll) {
                callback(null, records);
                return;
            }
            callback(null, first.address, first.family);
        };
        if (validatedAddresses !== undefined) {
            respond(validatedAddresses.map((address) => ({
                address,
                family: address.includes(':') ? 6 : 4
            })));
            return;
        }
        dns.lookup(hostname, { all: true }, (err, records) => {
            if (err) {
                callback(err, '', 0);
                return;
            }
            respond(records);
        });
    };
}
