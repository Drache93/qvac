import { jsonrepair } from 'jsonrepair';
import { isRecord } from '../../guards.js';
import { HarnessLog } from '../../log.js';
import { escapeLiteralDollars } from '../../tools/exec/scope.js';
const JSON_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
export class ArgRepairHook {
    name = 'arg-repair';
    phase = 'preToolCall';
    run(ctx) {
        if (ctx.phase !== 'preToolCall' || !ctx.parameters)
            return;
        let args = coerceProperties(ctx.args, ctx.parameters, { tool: ctx.toolName, path: '' });
        if (ctx.toolName === 'exec' && args.language !== 'python' && typeof args.command === 'string') {
            const command = escapeLiteralDollars(args.command);
            if (command !== args.command) {
                args = { ...args, command };
            }
        }
        if (args !== ctx.args) {
            return { args };
        }
    }
}
function coerce(value, schema, site) {
    if (!isPlainObject(schema)) {
        return value;
    }
    if (typeof value === 'string') {
        return coerceString(value, schema, site);
    }
    if (Array.isArray(value)) {
        return coerceItems(value, schema.items, site);
    }
    if (isPlainObject(value)) {
        return coerceProperties(value, schema, site);
    }
    return value;
}
function coerceString(value, schema, site) {
    const folded = foldEnum(value, schema.enum);
    if (folded !== undefined) {
        return folded;
    }
    const types = schemaTypes(schema);
    const structured = types.has('object') || types.has('array');
    if (structured) {
        const parsed = parseStructured(value, types);
        if (parsed !== null) {
            return coerce(parsed, schema, site);
        }
    }
    const scalarOnly = types.size > 0 && !types.has('string');
    if (scalarOnly) {
        const scalar = parseScalar(value.trim(), types);
        if (scalar !== undefined) {
            return scalar;
        }
    }
    if (structured || scalarOnly) {
        HarnessLog.debug('arg repair declined', {
            tool: site.tool,
            param: site.path,
            length: value.length
        });
    }
    return value;
}
function coerceProperties(value, schema, site) {
    if (!isPlainObject(schema.properties)) {
        return value;
    }
    const required = Array.isArray(schema.required) ? schema.required : [];
    let out = null;
    for (const [key, child] of Object.entries(schema.properties)) {
        const before = value[key];
        if (before === 'null' && !required.includes(key) && omittable(child)) {
            out ??= { ...value };
            delete out[key];
            continue;
        }
        const after = coerce(before, child, at(site, key));
        if (after !== before) {
            out ??= { ...value };
            out[key] = after;
        }
    }
    return out ?? value;
}
function coerceItems(value, items, site) {
    const out = value.map((item, i) => coerce(item, items, at(site, String(i))));
    return out.some((item, i) => item !== value[i]) ? out : value;
}
function at(site, key) {
    return { tool: site.tool, path: site.path ? `${site.path}.${key}` : key };
}
function foldEnum(value, values) {
    if (!Array.isArray(values) || values.includes(value))
        return undefined;
    const lower = value.toLowerCase();
    const matches = values.filter((v) => typeof v === 'string' && v.toLowerCase() === lower);
    return matches.length === 1 ? matches[0] : undefined;
}
function parseScalar(text, types) {
    if (text === 'null' && types.has('null'))
        return null;
    const lower = text.toLowerCase();
    if (types.has('boolean') && (lower === 'true' || lower === 'false')) {
        return lower === 'true';
    }
    if (!JSON_NUMBER.test(text)) {
        return undefined;
    }
    const number = Number(text);
    if (number === 0 && /[1-9]/.test(text.split(/e/i)[0])) {
        return undefined;
    }
    if (Number.isInteger(number)) {
        const numeric = types.has('integer') || types.has('number');
        return numeric && Number.isSafeInteger(number) ? number : undefined;
    }
    return types.has('number') && Number.isFinite(number) ? number : undefined;
}
function omittable(schema) {
    const types = schemaTypes(schema);
    return types.size > 0 && !types.has('string') && !types.has('null');
}
function parseStructured(value, types) {
    const text = value.trim();
    const parsed = read(text);
    if (typeof parsed === 'string') {
        const inner = parsed.trim();
        if (inner !== text && (inner[0] === '{' || inner[0] === '[' || inner[0] === '"')) {
            return parseStructured(parsed, types);
        }
        return null;
    }
    const accepted = accept(parsed, types);
    if (accepted !== null) {
        return accepted;
    }
    if (Array.isArray(parsed) &&
        types.has('object') &&
        isPlainObject(parsed[0]) &&
        typeof parsed.at(-1) === 'string') {
        return parsed[0];
    }
    if (text[0] === '"' && types.has('object')) {
        return accept(read(`{${text}}`), types);
    }
    return null;
}
function read(text) {
    try {
        return JSON.parse(jsonrepair(text));
    }
    catch {
        return null;
    }
}
function accept(value, types) {
    if (isPlainObject(value) && types.has('object'))
        return value;
    if (Array.isArray(value) && types.has('array'))
        return value;
    return null;
}
function schemaTypes(schema) {
    const found = new Set();
    if (!isPlainObject(schema)) {
        return found;
    }
    const declared = Array.isArray(schema.type) ? schema.type : [schema.type];
    for (const type of declared) {
        if (typeof type === 'string') {
            found.add(type);
        }
    }
    for (const key of ['oneOf', 'anyOf']) {
        const branches = schema[key];
        if (!Array.isArray(branches)) {
            continue;
        }
        for (const branch of branches) {
            for (const type of schemaTypes(branch)) {
                found.add(type);
            }
        }
    }
    return found;
}
function isPlainObject(value) {
    return isRecord(value) && !Array.isArray(value);
}
