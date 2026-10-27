import { pipInstallTargets } from '../../lib/tools/exec/python-source.js';
import { runsInterpreter, runsPip, shellDownloader } from '../../lib/tools/exec/shell-guidance.js';
import { pipMessage } from './python-adapter.js';
export const PYTHON_BIN_ERROR = 'python is not a shell command here. Call exec with language "python" and command set to the ' +
    'Python source itself: drop "python -c" and the quotes around the code. PyPI names go in packages.';
export const PACKAGES_NEED_PYTHON_ERROR = 'packages only work with language "python". Call exec with language "python", the same packages ' +
    'and the Python source in command.';
export const FILES_NEED_PYTHON_ERROR = 'inputs and outputs only work with language "python". Call exec with language "python" and the ' +
    'Python source in command.';
export const DOWNLOAD_REMEDY = 'To give the user a downloaded file, fetch it in exec with language "python" and declare it in outputs.';
export function downloaderShellError(tool) {
    return (`${tool} is not a program here: it is a Python package. Call exec with language "python", ` +
        `packages: ["${tool}"] and Python source that imports it, and declare the file it saves ` +
        'in outputs so it reaches the user.');
}
export function pipError(command, sandbox = false) {
    return runsPip(command) ? pipMessage(pipInstallTargets(command), { sandbox }) : null;
}
export function pythonRedirectError(command, sandbox = false) {
    return pipError(command, sandbox) ?? (runsInterpreter(command) ? PYTHON_BIN_ERROR : null);
}
export function downloaderRedirect(command) {
    const program = shellDownloader(command);
    return program ? downloaderShellError(program) : null;
}
