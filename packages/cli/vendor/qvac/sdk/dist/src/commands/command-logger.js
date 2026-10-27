import { getClientLogger } from '../logging/index.js';
export function createCommandLogger(options) {
    if (options.quiet) {
        return getClientLogger({ level: 'error', enableConsole: false });
    }
    // The client logger keeps console output off unless asked; a command's
    // progress and warnings are meant for the person running it.
    if (options.verbose) {
        return getClientLogger({ level: 'debug', enableConsole: true });
    }
    return getClientLogger({ enableConsole: true });
}
