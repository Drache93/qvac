var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import '../hardware/gpu-probe-entry.js';
import FileLog from 'bare-file-logger';
import fs from 'fs';
import { dirname, isAbsolute, join } from 'path';
import process from 'process';
import { pathToFileURL } from 'url';
import { sealAddons } from '#addon-seal';
import { Harness, serveHarness } from '../../index.js';
import { errorMessage, isRecord } from '../guards.js';
import { HarnessLog } from '../log.js';
import { configureSdkStorage } from '../sdk-storage.js';
import { Tools } from '../tools/index.js';
import { loadSkillCatalog } from '../tools/skills/catalog.js';
import { loadUserPlugins, userConfigDir } from './user-plugins.js';
import { musicModelSet } from '../models/model-catalog.js';
const LOG_MAX_SIZE = 100_000_000;
const SCOPE = '[harness]';
const DISCARD = { info() { }, debug() { }, warn() { }, error() { } };
export class HarnessSidecar {
    _plugins;
    constructor(plugins) {
        this._plugins = plugins;
    }
    static start(ipc, ready, plugins) {
        return new HarnessSidecar(plugins).start(ipc, ready);
    }
    static loadUserPlugins(dir, leftOut) {
        return loadUserPlugins(dir, leftOut);
    }
    async start(ipc, ready) {
        let harness;
        let dying = false;
        const die = () => {
            if (dying)
                return;
            dying = true;
            Promise.resolve(harness?.close())
                .catch(noop)
                .then(() => Bare.exit(0));
        };
        Bare.IPC.on('end', die).on('close', die);
        const argv = Bare.argv;
        const sdkStorage = JSON.parse(argv[3] || '{}');
        if (argv[7]) {
            HarnessLog.followHost(argv[7]);
        }
        else {
            HarnessLog.enable(false);
        }
        const hostWantsLogs = HarnessLog.level() !== 'off';
        const log = openHarnessLog(join(dirname(sdkStorage.home), 'harness.log')) ?? DISCARD;
        HarnessLog.setSink((line, level) => log[level](SCOPE, line));
        captureConsole(log);
        await alignSdkConsoleWithHost(hostWantsLogs);
        const skillsDir = argv[2] || (await Tools.bundledSkillsDir());
        if (argv[11]) {
            process.env.QVAC_PYTHON_WHEELS_DIR = argv[11];
        }
        configureSdkStorage(sdkStorage);
        process.env.QVAC_PYODIDE_CACHE_DIR = `${sdkStorage.home}/pyodide-cache`;
        const skillCatalog = skillsDir ? await loadSkillCatalog(skillsDir) : undefined;
        const credentialStore = skillCatalog
            ? (key, ctx) => harness?.resolveCredential(key, ctx) ?? null
            : undefined;
        const tools = Tools.product({
            sdkHome: sdkStorage.home,
            skillsDir,
            skillCatalog,
            credentialStore
        });
        const plugins = this._plugins(pluginContext(argv, { sdkStorage, skillsDir, skillCatalog, credentialStore }));
        harness = new Harness({
            ...modelOptions(argv),
            tools,
            exec: true,
            skillsDir,
            sdkHome: sdkStorage.home,
            modelsDir: sdkStorage.models,
            pluginMode: 'dynamic',
            plugins: admit(plugins, log)
        });
        await harness.ready().catch((err) => log.error(SCOPE, 'harness failed to open', err));
        await addUserPlugins(harness, log);
        await addHostModule(harness, log);
        sealAddons();
        serveHarness(ipc, harness);
        ready();
        return noop;
    }
}
function pluginContext(argv, base) {
    const music = argv[9] ? JSON.parse(argv[9]) : undefined;
    return {
        ...base,
        pluginOptions: argv[14] ? JSON.parse(argv[14]) : {},
        imageModel: argv[5] ? JSON.parse(argv[5]) : undefined,
        imageClamps: argv[6] ? JSON.parse(argv[6]) : undefined,
        musicModel: (typeof music === 'string' ? musicModelSet(music) : music) ?? undefined,
        musicClamps: argv[10] ? JSON.parse(argv[10]) : undefined,
        knowledge: argv[13] ? JSON.parse(argv[13]) : undefined
    };
}
function modelOptions(argv) {
    const embed = JSON.parse(argv[4] || '{}');
    const llm = argv[8] ? JSON.parse(argv[8]) : {};
    return {
        gpuStats: argv[12] ? JSON.parse(argv[12]) : undefined,
        embedDevice: embed.device,
        embedGpuLayers: embed.gpuLayers,
        embedBatchSize: embed.batchSize,
        llmDevice: llm.llmDevice,
        llmGpuLayers: llm.llmGpuLayers,
        contextSize: llm.contextSize,
        kvCacheK: llm.kvCacheK,
        kvCacheV: llm.kvCacheV,
        llmLoad: llm.llmLoad,
        slots: llm.slots,
        completionModelCap: llm.completionModelCap
    };
}
function admit(plugins, log) {
    return plugins.filter((plugin) => {
        const reason = invalid(plugin);
        if (reason) {
            log.error(SCOPE, `plugin '${plugin.name}' left out: ${reason}`);
        }
        return !reason;
    });
}
async function addUserPlugins(harness, log) {
    const leftOut = (name, reason) => log.error(SCOPE, `user plugin '${name}' left out: ${reason}`);
    const plugins = await loadUserPlugins(userConfigDir(), leftOut).catch((err) => {
        log.error(SCOPE, 'user plugins left out', err);
        return [];
    });
    for (const plugin of plugins) {
        try {
            await harness.addPlugin(plugin);
        }
        catch (err) {
            leftOut(plugin.name, errorMessage(err));
        }
    }
}
export const HOST_MODULE_ENV = 'QVAC_HARNESS_HOST_MODULE';
export async function addHostModule(harness, log, env = process.env) {
    const file = env[HOST_MODULE_ENV];
    if (!file) {
        return;
    }
    if (!isAbsolute(file)) {
        throw new Error(`${HOST_MODULE_ENV} must be an absolute path, not ${file}`);
    }
    try {
        const host = await import(__rewriteRelativeImportExtension(pathToFileURL(file).href));
        const configure = isRecord(host) ? host.configureHarness : undefined;
        if (typeof configure !== 'function') {
            throw new Error('it exports no configureHarness(harness, log)');
        }
        await configure(harness, log);
    }
    catch (err) {
        log.error(SCOPE, `host module ${file} failed, so the sidecar stops`, err);
        throw err;
    }
}
function openHarnessLog(path) {
    try {
        fs.mkdirSync(dirname(path), { recursive: true });
        return new FileLog(path, { maxSize: LOG_MAX_SIZE, rotate: (p) => `${p}.1` });
    }
    catch {
        return null;
    }
}
function captureConsole(log) {
    console.log = console.info = (...args) => log.info(SCOPE, ...args);
    console.debug = (...args) => log.debug(SCOPE, ...args);
    console.warn = (...args) => log.warn(SCOPE, ...args);
    console.error = (...args) => log.error(SCOPE, ...args);
}
async function alignSdkConsoleWithHost(hostWantsLogs) {
    try {
        const logging = await import('#sdk-logging');
        logging.setGlobalConsoleOutput(hostWantsLogs);
    }
    catch {
    }
}
function invalid(plugin) {
    try {
        return plugin.validate?.() ?? null;
    }
    catch (err) {
        return errorMessage(err);
    }
}
function noop() { }
