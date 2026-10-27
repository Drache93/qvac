import { pipInstallTargets, unwrapPythonSource, withoutProgramDir } from './python-source.js';
import { bareBin } from './scope.js';
import { ShellLine } from './shell-line.js';
import { isTranscoder, TRANSCODE_ERROR, VIDEO_TOOLS_ERROR, videoTool } from './video-tools.js';
const INTERPRETER = /^(python[\d.]*|py)$/;
const PIP = /^pip[\d.]*$/;
export const PYTHON_UNAVAILABLE_ERROR = 'Python is not available here, and no exec call runs it. Use a shell command, or tell the ' +
    'user it cannot be done.';
export const LANGUAGE_UNAVAILABLE_ERROR = 'That language is not available here, and no exec call runs it. Use a shell command, or tell ' +
    'the user it cannot be done.';
export const PIP_UNAVAILABLE_ERROR = 'pip is not available here, and no exec call installs Python packages. Use a shell command, ' +
    'or tell the user it cannot be done.';
export function commandBin(command) {
    return (bareBin((ShellLine.parse(command).commands[0]?.argv[0] ?? '').replace(/^.*[/\\]/, '')) ?? '');
}
export function dashModule(command) {
    return /^\s*(?:python[\d.]*|py)\s+-m\s+([\w.-]+)/.exec(withoutProgramDir(command))?.[1] ?? null;
}
export function runsPip(command) {
    return PIP.test(commandBin(command)) || dashModule(command) === 'pip';
}
export function runsInterpreter(command) {
    return INTERPRETER.test(commandBin(command));
}
function importedModules(source) {
    const modules = [];
    for (const line of source.split('\n')) {
        const from = /^\s*from\s+([\w.]+)\s+import\b/.exec(line)?.[1];
        if (from) {
            modules.push(from);
            continue;
        }
        const imported = /^\s*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/.exec(line)?.[1];
        if (imported) {
            modules.push(...imported.split(',').map((m) => m.trim()));
        }
    }
    return modules.map((m) => m.split('.')[0] ?? '');
}
export function videoToolError(command, { packages, python, network = false }) {
    const names = [
        dashModule(command) ?? '',
        ...(pipInstallTargets(command) ?? []),
        ...(packages ?? []),
        ...(python ? importedModules(unwrapPythonSource(command) ?? command) : [commandBin(command)])
    ];
    const tools = names.map(videoTool).filter((tool) => tool !== null);
    if (tools.length === 0) {
        return null;
    }
    if (!network) {
        return VIDEO_TOOLS_ERROR;
    }
    return tools.some(isTranscoder) ? TRANSCODE_ERROR : null;
}
export function shellDownloader(command) {
    return videoTool(commandBin(command)) ?? videoTool(dashModule(command) ?? '');
}
export const SHELL_DOWNLOAD_NOTE = "The file was saved on this device's disk, not in the chat, so the user cannot see it.";
const CURL_VALUED = new Set('AbcCdDeEFHKmoPQrTuUwxXyYz'.split(''));
const WGET_VALUED = new Set('aABDeIilOoPQRtTUwX'.split(''));
function writesFile(words, curl) {
    const valued = curl ? CURL_VALUED : WGET_VALUED;
    const output = curl ? 'o' : 'O';
    const long = curl ? '--output' : '--output-document';
    let saves = !curl;
    for (let i = 1; i < words.length; i++) {
        const word = words[i] ?? '';
        if (curl && /^--remote-name(-all)?$/.test(word)) {
            saves = true;
        }
        if (word === long || word.startsWith(`${long}=`)) {
            const value = word === long ? words[++i] : word.slice(long.length + 1);
            saves = value !== '-';
            continue;
        }
        if (!/^-[A-Za-z]/.test(word)) {
            continue;
        }
        for (let j = 1; j < word.length; j++) {
            const flag = word.charAt(j);
            if (curl && flag === 'O') {
                saves = true;
            }
            if (!valued.has(flag)) {
                continue;
            }
            const value = j + 1 < word.length ? word.slice(j + 1) : words[++i];
            if (flag === output) {
                saves = value !== '-';
            }
            break;
        }
    }
    return saves;
}
export function savesDownload(command) {
    const bin = commandBin(command);
    if (bin !== 'curl' && bin !== 'wget') {
        return false;
    }
    return writesFile(ShellLine.parse(command).commands[0]?.argv ?? [], bin === 'curl');
}
export function shellOnlyError(command) {
    if (runsPip(command)) {
        return PIP_UNAVAILABLE_ERROR;
    }
    return runsInterpreter(command) ? PYTHON_UNAVAILABLE_ERROR : null;
}
