import { persistent } from 'bare-storage';
import { join } from 'path';
import { underTest } from './test-env.js';
export function persistentDir(name) {
    if (underTest()) {
        throw new Error(`${name} would land in the device's persistent dir; pass its dir option`);
    }
    return join(persistent(), 'qvac', name);
}
