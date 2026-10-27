import b4a from 'b4a';
import { Policy } from '../../lib/policy/index.js';
import { attachOutputs, stageInputs } from '../../lib/tools/attachments/staging.js';
import { checkFileName, checkOutputName, MAX_INPUTS, MAX_OUTPUTS } from '../../lib/tools/attachments/output-policy.js';
import { runPython } from './pyodide.js';
import { isTranscoder, TRANSCODE_ERROR, VIDEO_TOOLS_ERROR, videoTool } from '../../lib/tools/exec/video-tools.js';
import { moduleDistribution } from './distributions.js';
import { namedHosts } from './named-hosts.js';
import { normalizeDistribution, planVendoredInstall, vendoredSpec } from './wheels.js';
import { isPythonLanguage, pipInstallTargets, unwrapPythonSource } from '../../lib/tools/exec/python-source.js';
const SHELL_WRAPPER = /^(python3?|py|pip3?)(\s*$|\s+(-[A-Za-z]|['"]|[\w./]))/;
const SANDBOX_NO_INSTALL = 'and sandbox mode installs only the packages bundled with this app, which do not include it. Use only what is already installed, or tell the user it is unavailable while sandbox mode is on.';
const specName = (spec) => normalizeDistribution(spec.split(/[=<>!~[]/)[0] ?? '');
export function pinned(spec) {
    return /[=<>!~]/.test(spec) ? spec : (vendoredSpec(spec) ?? spec);
}
export function pipMessage(targets, { sandbox = false } = {}) {
    const specs = targets?.map(pinned) ?? null;
    if (sandbox && !(specs?.length && planVendoredInstall(specs))) {
        return `pip is not available, ${SANDBOX_NO_INSTALL}`;
    }
    const declare = specs ? `packages: ${JSON.stringify(specs)}` : 'the PyPI names in packages';
    return `pip is not available. Call exec with language "python", ${declare} and the Python source in command. Installing and running are the same one call.`;
}
export function sandboxInstallError(command, declared) {
    const install = pipInstallTargets(command)?.map(pinned) ?? null;
    const packages = [...new Set([...(declared ?? []), ...(install ?? [])])];
    if (packages.length === 0 || planVendoredInstall(packages)) {
        return null;
    }
    return install
        ? pipMessage(install, { sandbox: true })
        : 'sandbox mode: installing packages reaches the network';
}
const PIP_CALL = /\b(?:subprocess\.\w+|os\.(?:system|popen)|Popen|check_(?:output|call))\s*\(/;
const STRING_LITERAL = /"([^"\n]*)"|'([^'\n]*)'/g;
function pipLineTargets(line) {
    const words = [...line.matchAll(STRING_LITERAL)].map((match) => match[1] ?? match[2] ?? '');
    const whole = words.find((word) => /\bpip3?\b[^]*\binstall\b/.test(word));
    if (whole !== undefined) {
        return pipInstallTargets(whole.trim());
    }
    const at = words.findIndex((word) => /^pip3?$/.test(word));
    if (at === -1) {
        return undefined;
    }
    return pipInstallTargets(words.slice(at).join(' '));
}
export function pipFromSourceHint(stderr, source, { packages, sandbox = false } = {}) {
    if (!/emscripten does not support processes/.test(stderr))
        return null;
    for (const line of source.split('\n')) {
        if (!PIP_CALL.test(line))
            continue;
        const targets = pipLineTargets(line);
        if (targets === undefined) {
            continue;
        }
        const declared = packages ?? [];
        const has = new Set(declared.map(specName));
        const missing = (targets ?? []).filter((t) => !has.has(specName(t))).map(pinned);
        if (sandbox && (targets === null || !planVendoredInstall([...declared, ...missing]))) {
            return `pip cannot run here: this Python cannot start processes, so that line failed, ${SANDBOX_NO_INSTALL} Delete the pip line.`;
        }
        if (targets === null) {
            return 'pip cannot run here: this Python cannot start processes, so that line failed. Delete it and declare the PyPI names in packages on this same call.';
        }
        if (missing.length) {
            return `pip cannot run here: this Python cannot start processes, so that line failed. Delete it and send the same source with packages: ${JSON.stringify([...declared, ...missing])} on this one call. Installing and running are the same call.`;
        }
        if (declared.length) {
            return `pip cannot run here: this Python cannot start processes, so that line failed. packages: ${JSON.stringify(declared)} already installs before your code runs, so delete the pip line and send the rest.`;
        }
        return 'pip cannot run here: this Python cannot start processes, so that line failed. Delete it and declare the PyPI names in packages on this same call.';
    }
    return null;
}
export function stringLiteralProgramHint(source) {
    const first = source.trimStart()[0];
    if (first !== '"' && first !== "'") {
        return null;
    }
    if (!source.trimEnd().endsWith(first)) {
        return null;
    }
    if (!/\bimport\b/.test(source)) {
        return null;
    }
    return ('command is wrapped in a string literal, so Python evaluates it as text and runs ' +
        'nothing: remove the wrapping quotes (and any escaped \\" quotes) so the first line ' +
        'of command is the first line of the program, e.g. import json.');
}
const COLLAPSED_COMPOUND = /;\s*(?:async\s+)?(?:for|if|while|with|def|class|try|match)\b/;
export function checkCollapsedCompound(source) {
    if (source.includes('\n'))
        return null;
    if (!COLLAPSED_COMPOUND.test(source))
        return null;
    return ('command must keep real newlines: a compound statement (for/if/while/with/def/…) ' +
        'cannot follow a semicolon. Pass multi-line Python source with newline characters, ' +
        'not a single-line semicolon chain.');
}
export function checkPythonSource(command) {
    const source = unwrapPythonSource(command) ?? command;
    const literal = stringLiteralProgramHint(source);
    if (literal) {
        return literal;
    }
    const collapsed = checkCollapsedCompound(source);
    if (collapsed) {
        return collapsed;
    }
    const first = command.trimStart().split('\n')[0] ?? '';
    if (!SHELL_WRAPPER.test(first)) {
        return null;
    }
    if (pipInstallTargets(command)) {
        return null;
    }
    if (/^pip3?\b/.test(first) || /^(python3?|py)\s+-m\s+pip\b/.test(first)) {
        return 'language "python" does not run shell commands: install packages via the packages argument (e.g. packages: ["requests"]), not pip';
    }
    if (unwrapPythonSource(command)) {
        return null;
    }
    return 'language "python" runs command as Python source: its first line is the first line of the program, so command must start with the code itself. There is no shell, no interpreter, and no script file to name.';
}
export function syntaxErrorHint(stderr, source) {
    if (!/SyntaxError/.test(stderr))
        return null;
    return (checkCollapsedCompound(source) ??
        'SyntaxError means the Python source is invalid as written — keep real newlines for for/if/with/def bodies; do not collapse a multi-line program into one semicolon-separated line.');
}
const ATTACHMENT_ID = /^[0-9a-f]{32}$/i;
export function missingFileHint(stderr) {
    const name = /FileNotFoundError: \[Errno \d+\] No such file or directory: '([^']+)'/.exec(stderr)?.[1];
    if (!name) {
        return null;
    }
    if (ATTACHMENT_ID.test(name)) {
        return (`"${name}" is an attachment id, not a file name, and nothing is on disk under it. ` +
            'An id belongs in `attachmentId`; `path` is a bare file name you choose, and the code ' +
            `opens that name. Stage it as inputs [{ "attachmentId": "${name}", "path": "photo.png" }] ` +
            'and open "photo.png".');
    }
    return (`the working directory starts empty on every call — ${name} from an earlier run is gone. ` +
        `Stage the chat attachment via inputs [{ "attachmentId": "<id from the tool result that ` +
        `produced it, or from the [Attached file …] line if the user uploaded it>", ` +
        `"path": "${name}" }] and open it by that bare name; if no id for it appears anywhere ` +
        'in the chat, ask the user to attach the file.');
}
export function parsePackages(value) {
    if (value === undefined || value === null)
        return undefined;
    if (!Array.isArray(value) || value.some((p) => typeof p !== 'string' || !p.trim())) {
        return { error: 'packages must be an array of non-empty strings' };
    }
    const trimmed = value.map((p) => p.trim());
    if (trimmed.some((p) => p.includes(':'))) {
        return { error: 'packages must be PyPI names, not URLs' };
    }
    return trimmed;
}
function inputEntry(value) {
    if (typeof value !== 'object' || value === null)
        return null;
    return {
        attachmentId: 'attachmentId' in value ? value.attachmentId : undefined,
        path: 'path' in value ? value.path : undefined
    };
}
export function parseInputs(value) {
    if (value === undefined || value === null)
        return undefined;
    if (!Array.isArray(value)) {
        return { error: 'inputs must be an array' };
    }
    if (value.length > MAX_INPUTS) {
        return { error: `inputs must declare at most ${MAX_INPUTS} files` };
    }
    const parsed = [];
    const paths = new Set();
    for (const raw of value) {
        const entry = inputEntry(raw);
        if (!entry) {
            return { error: 'each input must be an { attachmentId, path } object' };
        }
        const attachmentId = attachmentIdOf(entry.attachmentId);
        if (attachmentId === '') {
            return { error: 'attachmentId must be a non-empty string, or omitted for a user upload' };
        }
        const path = typeof entry.path === 'string' ? entry.path.trim() : '';
        const nameError = checkFileName(path);
        if (nameError) {
            return { error: `input path: ${nameError}` };
        }
        if (paths.has(path)) {
            return { error: 'input paths must be unique' };
        }
        paths.add(path);
        parsed.push({ attachmentId, path });
    }
    return parsed;
}
export function parseOutputs(value) {
    if (value === undefined || value === null)
        return undefined;
    if (!Array.isArray(value) || value.some((o) => typeof o !== 'string')) {
        return { error: 'outputs must be an array of file names' };
    }
    if (value.length > MAX_OUTPUTS) {
        return { error: `outputs must declare at most ${MAX_OUTPUTS} files` };
    }
    const trimmed = [...new Set(value.map((o) => o.trim()))];
    for (const name of trimmed) {
        const nameError = checkOutputName(name);
        if (nameError) {
            return { error: `output name: ${nameError}` };
        }
    }
    return trimmed;
}
export function parseWorkdir(value) {
    if (value === undefined || value === null)
        return undefined;
    if (typeof value !== 'string') {
        return { error: 'workdir must be a string' };
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    const nameError = checkFileName(trimmed);
    if (nameError) {
        return { error: `workdir: ${nameError}` };
    }
    return trimmed;
}
function prepare(args, cwd) {
    const packages = parsePackages(args.packages);
    if (packages && 'error' in packages) {
        return packages;
    }
    const inputs = parseInputs(args.inputs);
    if (inputs && 'error' in inputs) {
        return inputs;
    }
    const outputs = parseOutputs(args.outputs);
    if (outputs && 'error' in outputs) {
        return outputs;
    }
    const workdir = parseWorkdir(cwd);
    if (workdir && typeof workdir === 'object') {
        return workdir;
    }
    return { packages, inputs, outputs, workdir };
}
const OFFICE_MODULES = {
    pptx: { tool: 'pptx', skill: 'presentations' },
    docx: { tool: 'docx', skill: 'word' },
    openpyxl: { tool: 'xlsx', skill: 'excel' }
};
const OFFICE_PACKAGES = {
    'python-pptx': 'pptx',
    'python-docx': 'docx',
    openpyxl: 'openpyxl'
};
const OFFICE_IMPORT = /^\s*(?:from\s+(pptx|docx|openpyxl)\b|import\s+(?:[\w.]+\s*(?:as\s+\w+\s*)?,\s*)*(pptx|docx|openpyxl)\b)/m;
function officeAnswer(module, toolNames) {
    const office = OFFICE_MODULES[module];
    if (!office) {
        return null;
    }
    const call = toolNames?.includes(office.tool)
        ? `call the ${office.tool} tool`
        : `load the "${office.skill}" skill and call the ${office.tool} tool it grants`;
    return `module "${module}" is not installed: Office files are read and edited without Python here. Do not retry in Python; ${call} with the same content.`;
}
export function officeModuleHint(stderr, toolNames) {
    const module = /ModuleNotFoundError: No module named '([^'.]+)/.exec(stderr)?.[1];
    return module ? officeAnswer(module, toolNames) : null;
}
export function officeImportError(source, { packages, toolNames }) {
    const imported = OFFICE_IMPORT.exec(source);
    const declared = (packages ?? [])
        .map((spec) => OFFICE_PACKAGES[spec.split(/[=<>!~[ ]/)[0]?.toLowerCase() ?? ''])
        .find(Boolean);
    const module = imported?.[1] ?? imported?.[2] ?? declared;
    return module ? officeAnswer(module, toolNames) : null;
}
export function missingModuleHint(stderr, { packages, sandbox = false, network = false } = {}) {
    const module = /ModuleNotFoundError: No module named '([^']+)'/.exec(stderr)?.[1];
    if (!module) {
        return null;
    }
    const root = module.split('.')[0] ?? '';
    const tool = videoTool(root);
    if (tool && (!network || isTranscoder(tool))) {
        return network ? TRANSCODE_ERROR : VIDEO_TOOLS_ERROR;
    }
    if (module !== root) {
        const then = sandbox
            ? 'If the path is right it ships as its own distribution under a shared namespace, which sandbox mode cannot install: tell the user.'
            : 'If the path is right it ships as its own distribution under a shared namespace, as google.* does: declare that distribution in packages.';
        return `"${module}" failed to import although "${root}" loaded. Check the import path first. ${then}`;
    }
    const distribution = moduleDistribution(root);
    const provider = distribution ?? root;
    const vendored = vendoredSpec(provider);
    if (sandbox && !vendored) {
        return `module "${root}" is not installed, ${SANDBOX_NO_INSTALL}`;
    }
    const spec = vendored ?? provider;
    const renamed = distribution !== null && distribution.toLowerCase() !== root.toLowerCase();
    const declared = (packages ?? []).map(specName);
    if (declared.includes(root.toLowerCase()) && renamed) {
        return `"${root}" was declared in packages but does not provide that module; the distribution that does is "${spec}": put that in packages instead. There is no pip.`;
    }
    if (declared.includes(root.toLowerCase()) || declared.includes(provider.toLowerCase())) {
        return `"${provider}" is already declared in packages and still does not provide "${root}", so declaring it again cannot help. Import the module name the library really exports, or tell the user it is unavailable on this device.`;
    }
    return `module "${root}" is not installed: add "${spec}" to packages (packages: ["${spec}"]) and run the same source again. There is no pip.`;
}
export function shellNameHint(stderr) {
    const name = /NameError: name '(python3?|py|pip3?)' is not defined/.exec(stderr)?.[1];
    if (!name) {
        return null;
    }
    return `"${name}" is not defined because command already runs as Python source — remove the ${name} invocation and pass only the Python code itself`;
}
export function noProcessHint(stderr, sandbox = false) {
    if (!/emscripten does not support processes/.test(stderr))
        return null;
    const packages = sandbox
        ? ' In sandbox mode only the packages bundled with this app install;'
        : ' Declare PyPI packages in packages;';
    return `Python here cannot start processes: there is no shell and no pip from the source.${packages} run a shell command as its own exec call without language.`;
}
const FETCH_TOOLS = ['http_request', 'web_fetch'];
export function noNetworkHint(stderr, tools, network = false) {
    if (network)
        return null;
    if (!/Host is unreachable|Network is unreachable|socket\.gaierror|URLError|Temporary failure in name resolution|NewConnectionError|XMLHttpRequest is not defined/.test(stderr)) {
        return null;
    }
    const failed = 'Python here cannot open network connections (requests, urllib and sockets fail), and retrying will not change that.';
    const fetchers = FETCH_TOOLS.filter((name) => !tools || tools.includes(name));
    return fetchers.length
        ? `${failed} Fetch the URL with the ${fetchers.join(' or ')} tool and pass the data into the source.`
        : `${failed} No tool that fetches a URL is available to you, so tell the user.`;
}
export function nativeWheelHint(stderr) {
    const name = /Can't find a pure Python 3 wheel for '([^']+)'/.exec(stderr)?.[1];
    if (!name) {
        return null;
    }
    return `"${name}" is built from compiled code, and this device installs only pure-Python packages plus the set already built into its Python. Nothing about this call can install it: use a pure-Python library instead, or tell the user it is not available here.`;
}
export function packageFetchFailedHint(stderr) {
    const name = /Can't fetch metadata for '([^']+)'/.exec(stderr)?.[1];
    if (!name) {
        return null;
    }
    return `"${name}" could not be fetched: either it is not a PyPI distribution name or this device has no network. Where a skill documents an exact spec for that library, send that spec verbatim; otherwise the package cannot be installed here — tell the user and stop. Do not try other names.`;
}
function fail(stderr) {
    return { stdout: '', stderr, exitCode: 1 };
}
async function stage(inputs, fetchAttachment, opts = {}) {
    if (!inputs?.length)
        return undefined;
    if (!fetchAttachment) {
        return { error: 'this device cannot read chat attachments' };
    }
    return stageInputs(fetchAttachment, inputs, opts);
}
async function collect(result, { declared, attach, runBudget, source }) {
    const base = {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode
    };
    if (!declared?.length || !attach) {
        return base;
    }
    const { attachments, missingOutputs, rejectedOutputs } = await attachOutputs(attach, (result.exitCode === 0 && result.files) || new Map(), { declared, runBudget });
    const rejected = [...(result.rejected ?? []), ...rejectedOutputs];
    return {
        ...base,
        attachments: attachments.length > 0 ? attachments : undefined,
        missingOutputs: missingOutputs.length > 0 ? missingOutputs : undefined,
        rejectedOutputs: rejected.length > 0 ? rejected : undefined
    };
}
const CONNECT_ANSWER_MS = 60_000;
function connectAsker(askUser) {
    return async (host) => {
        let timer;
        const late = new Promise((resolve) => {
            timer = setTimeout(() => resolve(null), CONNECT_ANSWER_MS);
        });
        try {
            const answer = await Promise.race([
                askUser({
                    question: `This Python run wants to connect to ${host}, which its approved code does not name. Allow it for this run?`,
                    options: ['Allow', 'Deny']
                }),
                late
            ]);
            return /^allow/i.test((answer ?? '').trim());
        }
        finally {
            clearTimeout(timer);
        }
    };
}
export function createPythonAdapter(loadPyodide, network = false) {
    return {
        resolve(args, ctx) {
            if (!isPythonLanguage(args.language))
                return null;
            const command = String(args.command ?? '').trim();
            const attach = ctx?.attach;
            const fetchAttachment = ctx?.fetchAttachment;
            const turnImages = ctx?.turnImages;
            const runBudget = ctx?.runBudget;
            const sandbox = ctx?.policy?.network.mode === 'off';
            const toolNames = ctx?.toolNames;
            const approved = ctx?.approval === 'allowed' || ctx?.approval === 'skip-all';
            const reach = network && !sandbox && approved;
            const gated = reach && ctx?.approval === 'allowed';
            const confirmConnect = ctx?.askUser ? connectAsker(ctx.askUser) : undefined;
            return {
                async run(options) {
                    if (!command) {
                        return fail('command is required');
                    }
                    const sourceError = checkPythonSource(command);
                    if (sourceError) {
                        return fail(sourceError);
                    }
                    const source = unwrapPythonSource(command) ?? command;
                    const prepared = prepare(args, options.cwd);
                    if ('error' in prepared) {
                        return fail(prepared.error);
                    }
                    if (prepared.outputs?.length && !attach) {
                        return fail('this device cannot persist produced files');
                    }
                    const staged = await stage(prepared.inputs, fetchAttachment, {
                        turnImages,
                        signal: options.signal
                    });
                    if (staged && 'error' in staged) {
                        return fail(staged.error);
                    }
                    const install = pipInstallTargets(command)?.map(pinned) ?? null;
                    const packages = install
                        ? [...new Set([...(prepared.packages ?? []), ...install])]
                        : prepared.packages;
                    const refusal = sandbox ? sandboxInstallError(command, prepared.packages) : null;
                    if (refusal) {
                        return fail(refusal);
                    }
                    const result = await runPython(install ? 'pass' : source, {
                        timeoutMs: options.timeoutMs,
                        maxOutputChars: options.maxOutputChars,
                        signal: options.signal,
                        packages,
                        inputs: staged?.files,
                        outputs: prepared.outputs,
                        workdir: prepared.workdir,
                        loadPyodide,
                        network: reach,
                        hosts: gated ? namedHosts(source) : undefined,
                        allowed: Policy.hostsOf(ctx?.policy),
                        askConnect: gated ? confirmConnect : undefined
                    });
                    const hint = packageFetchFailedHint(result.stderr) ??
                        nativeWheelHint(result.stderr) ??
                        officeModuleHint(result.stderr, toolNames) ??
                        missingModuleHint(result.stderr, { packages, sandbox, network: reach }) ??
                        pipFromSourceHint(result.stderr, source, { packages, sandbox }) ??
                        noProcessHint(result.stderr, sandbox) ??
                        noNetworkHint(result.stderr, toolNames, reach) ??
                        missingFileHint(result.stderr) ??
                        shellNameHint(result.stderr) ??
                        syntaxErrorHint(result.stderr, source);
                    const hinted = hint ? { ...result, stderr: `${result.stderr}\n${hint}` } : result;
                    const installed = install && result.exitCode === 0
                        ? {
                            ...hinted,
                            stdout: `installed: ${packages?.join(', ')}\nnothing was run — call exec again with language "python", packages: ${JSON.stringify(packages ?? [])} and the Python source in command\n${hinted.stdout}`
                        }
                        : hinted;
                    const undelivered = result.undeclared?.length
                        ? {
                            ...installed,
                            stderr: `${installed.stderr}${installed.stderr ? '\n' : ''}${result.undeclared.join(', ')} ${result.undeclared.length === 1 ? 'was' : 'were'} written but not declared in outputs, so ${result.undeclared.length === 1 ? 'it was' : 'they were'} discarded and nothing reached the user. There is no shell to inspect it with and nothing to look for on disk: declare it in outputs and run the same code again.`
                        }
                        : installed;
                    return collect(undelivered, {
                        declared: prepared.outputs,
                        attach,
                        runBudget,
                        source
                    });
                }
            };
        }
    };
}
function attachmentIdOf(value) {
    if (value === undefined)
        return undefined;
    return typeof value === 'string' ? value.trim() : '';
}
