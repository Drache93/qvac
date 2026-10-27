export function walkCommands(argv, schema) {
    let node = schema;
    const pathSegs = [];
    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] ?? '';
        if (isParamToken(tok)) {
            break;
        }
        const child = objectProps(node)[tok];
        if (!child || !isObjectSchema(child)) {
            break;
        }
        pathSegs.push(tok);
        node = child;
        i++;
    }
    return { node, pathSegs, index: i };
}
export function argvToObject(argv, schema) {
    const { node, pathSegs, index } = walkCommands(argv, schema);
    const leaf = parseParams(argv.slice(index), node, pathSegs.join(' '));
    if (typeof leaf === 'string') {
        return leaf;
    }
    return pathSegs.reduceRight((inner, seg) => ({ [seg]: inner }), leaf);
}
export function objectProps(schema) {
    return schema.properties ?? {};
}
export function isObjectSchema(schema) {
    return schema.type === 'object' || (!schema.type && !!schema.properties);
}
function isParamToken(tok) {
    if (!tok)
        return false;
    if (tok.startsWith('-'))
        return true;
    if (tok.includes('=')) {
        return true;
    }
    return false;
}
function flagParts(tok) {
    if (!tok.startsWith('--')) {
        return { key: tok.slice(1), inline: undefined };
    }
    const body = tok.slice(2);
    const ieq = body.indexOf('=');
    if (ieq < 0) {
        return { key: body, inline: undefined };
    }
    return { key: body.slice(0, ieq), inline: body.slice(ieq + 1) };
}
function accepted(schema, command) {
    const commands = [];
    const params = [];
    for (const [key, prop] of Object.entries(objectProps(schema))) {
        if (isObjectSchema(prop)) {
            commands.push(key);
        }
        else {
            params.push(key);
        }
    }
    const parts = [];
    if (commands.length) {
        parts.push(`commands: ${commands.join(', ')}`);
    }
    if (params.length) {
        parts.push(`${command || 'it'} takes: ${params.join(', ')}`);
    }
    return parts.length ? `; ${parts.join('; ')}` : '';
}
function parseParams(tokens, schema, command) {
    const props = objectProps(schema);
    const propSchemas = new Map(Object.entries(props));
    const boolKeys = new Set(Object.entries(props)
        .filter(([, s]) => s.type === 'boolean')
        .map(([k]) => k));
    const positionals = schema['x-positionals'] ?? [];
    const restName = schema['x-rest'];
    const out = {};
    let posIdx = 0;
    const restVals = [];
    let i = 0;
    while (i < tokens.length) {
        const tok = tokens[i] ?? '';
        const canAbsorb = posIdx < positionals.length || restName !== undefined;
        const eq = tok.indexOf('=');
        if (eq > 0 && !tok.startsWith('-')) {
            const key = tok.slice(0, eq);
            const keySchema = propSchemas.get(key);
            if (keySchema !== undefined) {
                out[key] = coerce(tok.slice(eq + 1), keySchema);
                i++;
                continue;
            }
            if (!canAbsorb) {
                return `unknown parameter "${key}"${accepted(schema, command)}`;
            }
        }
        const flag = tok.startsWith('-') ? flagParts(tok) : null;
        const flagSchema = flag ? propSchemas.get(flag.key) : undefined;
        if (flag && flagSchema !== undefined) {
            const { key, inline } = flag;
            if (boolKeys.has(key)) {
                out[key] = inline !== undefined ? inline !== 'false' && inline !== '0' : true;
                i++;
                continue;
            }
            if (inline !== undefined) {
                out[key] = coerce(inline, flagSchema);
                i++;
                continue;
            }
            const next = tokens[i + 1];
            if (next === undefined || next.startsWith('-')) {
                return `flag --${key} requires a value`;
            }
            out[key] = coerce(next, flagSchema);
            i += 2;
            continue;
        }
        if (flag && !canAbsorb) {
            return `unknown flag "--${flag.key}"${accepted(schema, command)}`;
        }
        if (boolKeys.has(tok)) {
            out[tok] = true;
            i++;
            continue;
        }
        if (propSchemas.get(tok)?.type === 'string' && !canAbsorb) {
            out[tok] = '';
            i++;
            continue;
        }
        const name = positionals[posIdx];
        if (name !== undefined) {
            const nameSchema = propSchemas.get(name);
            if (nameSchema === undefined) {
                return `x-positionals names unknown property "${name}"`;
            }
            out[name] = coerce(tok, nameSchema);
            posIdx++;
            i++;
            continue;
        }
        if (restName) {
            restVals.push(tok);
            i++;
            continue;
        }
        return `unexpected argument "${tok}"${accepted(schema, command)}`;
    }
    if (restName && restVals.length > 0) {
        out[restName] = restVals;
    }
    return out;
}
function coerce(value, schema) {
    if (schema.type === 'number' || schema.type === 'integer') {
        const n = Number(value);
        return Number.isFinite(n) ? n : value;
    }
    if (schema.type === 'boolean') {
        return value !== 'false' && value !== '0';
    }
    return value;
}
