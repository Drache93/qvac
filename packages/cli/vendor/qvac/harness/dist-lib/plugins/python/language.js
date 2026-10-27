import fs from 'fs';
import path from 'path';
import b4a from 'b4a';
import { unquoteArg } from '../../lib/helpers/model-args.js';
import { isPythonLanguage, isPythonSourceShaped, startsLikePython, unwrapPythonSource } from '../../lib/tools/exec/python-source.js';
import { videoToolError } from '../../lib/tools/exec/shell-guidance.js';
import { namedHosts } from './named-hosts.js';
import { pythonReachesNetwork } from './net-shim.js';
import { checkPythonSource, createPythonAdapter, officeImportError, parseInputs, parseOutputs, parsePackages, parseWorkdir, pinned, sandboxInstallError } from './python-adapter.js';
import { DOWNLOAD_REMEDY, downloaderRedirect, FILES_NEED_PYTHON_ERROR, PACKAGES_NEED_PYTHON_ERROR, pythonRedirectError } from './shell-redirect.js';
const SCRIPT_DESCRIPTION = 'Run a python script bundled with a loaded skill instead of passing source: a scripts/*.py path exactly as the skill instructions name it (e.g. "scripts/extract_text.py").';
const TEXT = {
    runs: 'Python via in-process Pyodide',
    guide: 'For Python: pass language="python" with the bare Python source in command — the first line of ' +
        'command is the first line of the program, there is no shell or interpreter to invoke, and ' +
        'packages are declared in packages rather than installed. ' +
        'When a loaded skill names a bundled script, run it by passing skill and script (with scriptArgs) ' +
        'instead of command — never retype a script as source.',
    command: '— when language is python — the Python source itself, ' +
        'whose first line is the first line of the program (no shell, no interpreter, no quoting)',
    language: '"python" runs command as Python via in-process Pyodide.',
    workdir: 'a bare directory name inside the in-memory Python filesystem with language "python"',
    download: DOWNLOAD_REMEDY,
    properties: {
        packages: {
            type: 'array',
            description: 'Optional array of PyPI package names (strings) to install (via micropip) before the code runs. Only with language "python".'
        },
        inputs: {
            type: 'array',
            description: 'Optional chat attachments to place in the working directory before the code runs, as objects {attachmentId, path}. path is a bare file name (no directories). Omit attachmentId to stage the image the user attached to their latest message. Any other uploaded file — PDF, .docx, .xlsx, .pptx — is staged by attachmentId, copied verbatim from the [Attached file "…"] line on the user\'s message; ids also come from earlier tool results. Only with language "python".'
        },
        outputs: {
            type: 'array',
            description: 'Optional bare file names (strings) the code writes in the working directory; each is attached to the chat when the run succeeds. Only with language "python".'
        },
        script: {
            type: 'string',
            description: `${SCRIPT_DESCRIPTION} Requires skill; leave command unset; pass arguments in scriptArgs and stage files via inputs/outputs as the instructions show.`
        },
        skill: {
            type: 'string',
            description: 'With script: the name of the skill that bundles the script (e.g. "pdf").'
        },
        scriptArgs: {
            type: 'array',
            description: 'With script: string arguments handed to the script as its command line, in order.'
        }
    },
    prompt: {
        runs: 'Python source in `command` with language="python"',
        guide: 'Run a script bundled with a loaded skill via `skill`+`script`+`scriptArgs`, never as retyped source.',
        command: 'bare Python source when language="python"',
        language: '"python" runs `command` as Python',
        properties: {
            packages: { type: 'array', description: 'python only: PyPI packages to install.' },
            inputs: {
                type: 'array',
                description: 'python only: attachments to stage as {attachmentId, path}, path a bare file name; ' +
                    'omit attachmentId for the latest attached image.'
            },
            outputs: {
                type: 'array',
                description: 'Only with language "python": bare file names the code writes; attached on success.'
            },
            script: {
                type: 'string',
                description: `${SCRIPT_DESCRIPTION} Requires \`skill\`; leave \`command\` unset. Never a command line — shell commands go in \`command\`.`
            },
            skill: {
                type: 'string',
                description: 'With script: the name of the skill that bundles it (e.g. "pdf").'
            },
            scriptArgs: { type: 'array', description: 'With script: string arguments in order.' }
        }
    }
};
function isPresent(value) {
    return value !== undefined && value !== null;
}
function stringList(value) {
    if (!Array.isArray(value))
        return undefined;
    return value.filter((v) => typeof v === 'string');
}
function truncateLabel(text) {
    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}
function networkPrefix(source) {
    const hosts = namedHosts(source);
    if (hosts.length === 0) {
        return ' · network: no host named in the code';
    }
    return ` · network: ${hosts.join(', ')}`;
}
function packageSuffix(args) {
    if (!Array.isArray(args.packages) || args.packages.length === 0)
        return '';
    const count = args.packages.length;
    return ` (+${count} pkg${count === 1 ? '' : 's'}: ${truncateLabel(args.packages.join(', '))})`;
}
function uploadOrdinal(inputs, index) {
    return inputs.slice(0, index + 1).filter((i) => i.attachmentId === undefined).length;
}
function fileSuffix(args) {
    const inputs = parseInputs(args.inputs);
    const outputs = parseOutputs(args.outputs);
    const from = Array.isArray(inputs) && inputs.length > 0
        ? ` ← ${inputs.length} file${inputs.length === 1 ? '' : 's'} (${truncateLabel(inputs
            .map((i, n) => `${i.attachmentId ?? `upload-${uploadOrdinal(inputs, n)}`}→${i.path}`)
            .join(', '))})`
        : '';
    const to = Array.isArray(outputs) && outputs.length > 0 ? ` → ${truncateLabel(outputs.join(', '))}` : '';
    return `${from}${to}`;
}
function commandRequiredError(args, network) {
    const staged = Array.isArray(args.inputs) || Array.isArray(args.outputs);
    if (staged) {
        return ('command is required: keep these same inputs/outputs and add either command (the bare ' +
            'python source) or script + scriptArgs exactly as the loaded skill reference shows');
    }
    const packages = stringList(args.packages);
    const impossible = videoToolError('', { packages, python: true, network });
    if (impossible) {
        return impossible;
    }
    if (packages?.length) {
        return `command is required: call exec again with language "python", packages: ${JSON.stringify(packages.map(pinned))} and the Python source that uses them in command. Installing and running are the same one call.`;
    }
    return null;
}
function parseScriptArgs(value) {
    if (Array.isArray(value)) {
        return value.map(String);
    }
    if (typeof value === 'string' && value.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map(String);
            }
        }
        catch {
        }
    }
    return [];
}
function normalizeScriptCall(rawArgs) {
    let script = typeof rawArgs.script === 'string' ? unquoteArg(rawArgs.script) : '';
    let scriptArgs = parseScriptArgs(rawArgs.scriptArgs);
    if (!script || script.includes('\n')) {
        return { script, scriptArgs };
    }
    if (script.includes(' ')) {
        const tokens = script.split(/\s+/).filter(Boolean);
        script = tokens[0] ?? '';
        if (!scriptArgs.length) {
            scriptArgs = tokens.slice(1);
        }
    }
    if (!script.startsWith('scripts/') && !script.includes('/')) {
        script = `scripts/${script}`;
    }
    return { script, scriptArgs };
}
function withInferredLanguage(args) {
    if (isPythonLanguage(args.language))
        return args;
    const command = String(args.command ?? '').trim();
    const declared = (stringList(args.packages) ?? []).length > 0 && startsLikePython(command);
    const wrapped = unwrapPythonSource(command) !== null;
    return isPythonSourceShaped(command) || declared || wrapped
        ? { ...args, language: 'python' }
        : args;
}
function readCall(rawArgs) {
    const { script, scriptArgs } = normalizeScriptCall(rawArgs);
    if (!script) {
        if (scriptArgs.length) {
            return {
                error: 'scriptArgs need `script`: pass the scripts/*.py path exactly as the skill instructions name it'
            };
        }
        const args = withInferredLanguage(rawArgs);
        return isPythonLanguage(args.language) ? { args } : null;
    }
    if (String(rawArgs.command ?? '').trim()) {
        return { error: 'pass either command or script, never both' };
    }
    if (script.includes('\n')) {
        return { args: { ...rawArgs, language: 'python', command: script, script: undefined } };
    }
    if (!script.startsWith('scripts/') || !script.endsWith('.py')) {
        return {
            error: 'script takes a scripts/*.py path bundled with a skill, not a command line — ' +
                `run a shell command by passing it in \`command\` instead. Got: ${String(rawArgs.script)}`
        };
    }
    const skill = typeof rawArgs.skill === 'string' ? unquoteArg(rawArgs.skill) : '';
    if (!skill) {
        return { error: 'script runs need the owning skill name in `skill`' };
    }
    const call = { args: rawArgs, skill, script, scriptArgs };
    return {
        args: rawArgs,
        bundled: { label: scriptLabel(call), load: (skillsDir) => loadCall(call, skillsDir) }
    };
}
export function resolveScriptRun(rawArgs, skillsDir) {
    const call = readCall(rawArgs) ?? { args: rawArgs };
    if ('error' in call) {
        return call;
    }
    return call.bundled ? call.bundled.load(skillsDir) : { args: call.args, trusted: false };
}
function loadCall({ args: rawArgs, skill, script, scriptArgs }, skillsDir) {
    if (!skillsDir) {
        return { error: 'script execution is not available on this device' };
    }
    const segments = [...skill.split('/'), ...script.split('/')];
    if (segments.some((segment) => segment === '' || segment === '..' || segment.includes('\\'))) {
        return { error: `script not found in skill ${skill}: ${script}` };
    }
    let source;
    try {
        const scriptPath = path.join(skillsDir, skill, script);
        const regularPath = () => {
            let current = skillsDir;
            for (const segment of segments) {
                current = path.join(current, segment);
                if (fs.lstatSync(current).isSymbolicLink()) {
                    return false;
                }
            }
            return true;
        };
        if (!regularPath()) {
            return { error: `script not found in skill ${skill}: ${script}` };
        }
        const before = fs.statSync(scriptPath);
        if (!before.isFile()) {
            return { error: `script not found in skill ${skill}: ${script}` };
        }
        const fd = fs.openSync(scriptPath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
        try {
            const opened = fs.fstatSync(fd);
            if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
                return { error: `script not found in skill ${skill}: ${script}` };
            }
            source = readScriptSource(fd);
            const current = fs.statSync(scriptPath);
            if (!regularPath() || current.dev !== opened.dev || current.ino !== opened.ino) {
                return { error: `script not found in skill ${skill}: ${script}` };
            }
        }
        finally {
            fs.closeSync(fd);
        }
    }
    catch {
        return { error: `script not found in skill ${skill}: ${script}` };
    }
    const staged = stagingGap(rawArgs, scriptArgs);
    if (staged) {
        return { error: staged };
    }
    const argv = JSON.stringify([script.slice('scripts/'.length), ...scriptArgs]);
    const command = `import sys\nsys.argv = ${argv}\n${source}`;
    return { args: { ...rawArgs, language: 'python', command, scriptArgs }, trusted: true };
}
function readScriptSource(fd) {
    const chunks = [];
    while (true) {
        const buffer = b4a.allocUnsafe(8192);
        const length = fs.readSync(fd, buffer);
        if (length === 0) {
            break;
        }
        chunks.push(buffer.subarray(0, length));
    }
    return b4a.toString(b4a.concat(chunks), 'utf8');
}
const SCRIPT_FILE_ARG = /^[\w][\w.-]*\.(pdf|txt|md|csv|docx|xlsx|pptx|png|jpe?g)$/i;
function stagingGap(rawArgs, scriptArgs) {
    const inputs = parseInputs(rawArgs.inputs);
    const outputs = parseOutputs(rawArgs.outputs);
    const known = new Set([
        ...(Array.isArray(inputs) ? inputs.map((input) => input.path) : []),
        ...(Array.isArray(outputs) ? outputs : [])
    ]);
    const missing = scriptArgs.filter((arg) => SCRIPT_FILE_ARG.test(arg) && !known.has(arg));
    if (!missing.length) {
        return null;
    }
    return (`scriptArgs name ${missing.map((name) => `"${name}"`).join(', ')} but the working directory ` +
        'starts empty: stage each existing file in inputs [{ attachmentId, path }] and declare each ' +
        'produced file in outputs');
}
function scriptLabel({ skill, script, scriptArgs }) {
    const argsSuffix = scriptArgs.length ? ` ${scriptArgs.join(' ')}` : '';
    return `python script ${skill}/${script}${argsSuffix}`;
}
export function createPythonLanguage({ loadPyodide, network = pythonReachesNetwork() } = {}) {
    const adapter = createPythonAdapter(loadPyodide, network);
    const online = ({ sandbox }) => network && !sandbox;
    return {
        name: 'python',
        text: TEXT,
        call: readCall,
        resolve: (args, ctx) => adapter.resolve(args, ctx),
        effect: () => 'write',
        online,
        scope(args, scope) {
            return videoToolError(String(args.command ?? '').trim(), {
                packages: stringList(args.packages),
                python: true,
                network: online(scope)
            });
        },
        validate(args, { sandbox, trusted, toolNames }) {
            const command = String(args.command ?? '').trim();
            const outputs = parseOutputs(args.outputs);
            if (outputs && 'error' in outputs) {
                return outputs.error;
            }
            const packages = parsePackages(args.packages);
            if (packages && 'error' in packages) {
                return packages.error;
            }
            const office = officeImportError(unwrapPythonSource(command) ?? command, {
                packages,
                toolNames
            });
            if (office) {
                return office;
            }
            const refusal = sandbox ? sandboxInstallError(command, packages) : null;
            if (refusal) {
                return refusal;
            }
            const lint = trusted ? null : checkPythonSource(command);
            if (lint) {
                return lint;
            }
            const inputs = parseInputs(args.inputs);
            if (inputs && 'error' in inputs) {
                return inputs.error;
            }
            const workdir = parseWorkdir(args.workdir);
            return workdir && typeof workdir === 'object' ? workdir.error : null;
        },
        label(args, scope) {
            const command = String(args.command ?? '').trim();
            const source = unwrapPythonSource(command) ?? command;
            const reach = online(scope) ? networkPrefix(source) : '';
            return `python${reach}${packageSuffix(args)}${fileSuffix(args)}: ${source.slice(0, 120)}`;
        },
        redirect(args, scope) {
            const command = String(args.command ?? '').trim();
            if (!command) {
                return commandRequiredError(args, online(scope));
            }
            return ((online(scope) ? downloaderRedirect(command) : null) ??
                pythonRedirectError(command, scope.sandbox));
        },
        strays(args) {
            const packages = parsePackages(args.packages);
            if (packages && 'error' in packages) {
                return packages.error;
            }
            if (packages) {
                return PACKAGES_NEED_PYTHON_ERROR;
            }
            return isPresent(args.inputs) || isPresent(args.outputs) ? FILES_NEED_PYTHON_ERROR : null;
        }
    };
}
