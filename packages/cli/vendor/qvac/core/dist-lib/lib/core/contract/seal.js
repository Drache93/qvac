import { DEVICES } from '../collections.js';
export async function sealed(tx) {
    for await (const row of tx.find(DEVICES)) {
        if (row.deviceSignature)
            return true;
    }
    return false;
}
