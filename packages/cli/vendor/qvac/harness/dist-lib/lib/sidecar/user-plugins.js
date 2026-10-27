var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import '../../index.js';
import '../plugins/index.js';
import '../plugins/context.js';
import '../helpers/race-abort.js';
import fs from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import process from 'process';
import { pathToFileURL } from 'url';
import { errorMessage, isRecord } from '../guards.js';
export function userConfigDir(env = process.env) {
    return join(env['HOME'] ?? env['USERPROFILE'] ?? homedir(), '.config', 'qv-ac');
}
export async function loadUserPlugins(dir, leftOut) {
    const entries = await readConfig(join(dir, 'config.json'), leftOut);
    if (entries.length === 0) {
        return [];
    }
    const imports = await sharedImports();
    const plugins = [];
    for (const listed of entries) {
        try {
            plugins.push(await userPlugin(join(dir, 'plugins'), entryOf(listed), imports));
        }
        catch (err) {
            leftOut(isRecord(listed) ? String(listed['name']) : String(listed), errorMessage(err));
        }
    }
    return plugins;
}
async function readConfig(path, leftOut) {
    let text;
    try {
        text = await fs.promises.readFile(path, 'utf8');
    }
    catch {
        return [];
    }
    try {
        const config = JSON.parse(text);
        const plugins = isRecord(config) ? config['plugins'] : undefined;
        if (!Array.isArray(plugins)) {
            throw new Error('plugins: a list of names or { name, options, read }');
        }
        return plugins;
    }
    catch (err) {
        leftOut(path, errorMessage(err));
        return [];
    }
}
function entryOf(listed) {
    if (typeof listed === 'string') {
        return { name: listed };
    }
    if (!isRecord(listed) || typeof listed['name'] !== 'string') {
        throw new Error('an entry is a name or { name, options, read }');
    }
    const read = listed['read'];
    if (read !== undefined && !(Array.isArray(read) && read.every((r) => typeof r === 'string'))) {
        throw new Error('read: a list of tool names');
    }
    return { name: listed['name'], options: listed['options'], read };
}
async function userPlugin(pluginsDir, { name, options, read = [] }, imports) {
    const self = Reflect.get(import.meta, 'cache')[import.meta.url];
    const Module = Reflect.get(self, 'constructor');
    const url = Module.resolveSync(`./${name}`, pathToFileURL(pluginsDir + '/'), 'import', {
        referrer: self
    });
    const made = (await Module.load(url, { referrer: self, imports })).exports.default;
    const context = { options };
    const plugin = typeof made === 'function' ? await made(context) : made;
    if (!isPlugin(plugin)) {
        throw new Error('its default export is not a plugin, nor a function that returns one');
    }
    if (plugin.addons && Object.keys(plugin.addons).length > 0) {
        throw new Error('declares addons, which a user plugin may not load');
    }
    plugin.read = read;
    return plugin;
}
const BUILTINS = ['fs', 'os', 'crypto', 'process', 'url', 'path', 'events'];
const OWN = import.meta.url.endsWith('.ts') ? '.ts' : '.js';
const own = (file) => import.meta.resolve(`${file}${OWN}`);
export async function sharedImports() {
    const raceAbort = own('../helpers/race-abort');
    const targets = {
        ...Object.fromEntries(BUILTINS.map((name) => [name, import.meta.resolve(name)])),
        '@qvac/harness': own('../../index'),
        '@qvac/harness/plugins': own('../plugins/index'),
        '@qvac/harness/plugins/context': own('../plugins/context'),
        '@qvac/harness/race-abort': raceAbort,
        '@qvac/harness/lib/helpers/race-abort.ts': raceAbort,
        '@qvac/sdk': import.meta.resolve('#sdk')
    };
    const imports = {};
    for (const [specifier, href] of Object.entries(targets)) {
        imports[specifier] = await reexport(href);
    }
    return imports;
}
async function reexport(href) {
    const target = await import(__rewriteRelativeImportExtension(href));
    const from = JSON.stringify(href);
    const source = `export * from ${from}\n` + ('default' in target ? `export { default } from ${from}\n` : '');
    return `data:text/javascript,${encodeURIComponent(source)}`;
}
function isPlugin(value) {
    return (isRecord(value) && typeof value['name'] === 'string' && typeof value['setup'] === 'function');
}
