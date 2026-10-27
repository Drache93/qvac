import fs from 'fs';
import path from 'path';
import { isRecord } from '../../guards.js';
import { CLI_SCHEMA_FILENAME } from './cli-schema-types.js';
export async function resolveCliSchema(skillDir, bin, readFile = (p) => fs.promises.readFile(p, 'utf8')) {
    const full = path.join(skillDir, CLI_SCHEMA_FILENAME);
    let raw;
    try {
        raw = await readFile(full);
    }
    catch (err) {
        if (isEnoent(err)) {
            return { bin };
        }
        return { bin, schemaFile: CLI_SCHEMA_FILENAME };
    }
    try {
        const schema = JSON.parse(raw);
        if (!isSchemaObject(schema)) {
            return { bin, schemaFile: CLI_SCHEMA_FILENAME };
        }
        if (!resourceGuardConsistent(schema)) {
            return { bin, schemaFile: CLI_SCHEMA_FILENAME };
        }
        if (!effectAnnotationsValid(schema)) {
            return { bin, schemaFile: CLI_SCHEMA_FILENAME };
        }
        if (!resourceEffectsValid(schema)) {
            return { bin, schemaFile: CLI_SCHEMA_FILENAME };
        }
        if (!outputCapsValid(schema)) {
            return { bin, schemaFile: CLI_SCHEMA_FILENAME };
        }
        const resourcePaths = resolveResourcePaths(skillDir, schema);
        return {
            bin,
            schema,
            schemaFile: CLI_SCHEMA_FILENAME,
            resourcePaths: resourcePaths.length ? resourcePaths : undefined
        };
    }
    catch {
        return { bin, schemaFile: CLI_SCHEMA_FILENAME };
    }
}
function resourceGuardConsistent(schema) {
    const resources = schema['x-resource-files'];
    if (!resources || resources.length === 0) {
        return true;
    }
    return schema.properties?.script?.type === 'string';
}
function effectAnnotationsValid(schema) {
    if ('x-effect' in schema && schema['x-effect'] !== 'read')
        return false;
    return Object.values(schema.properties ?? {}).every(effectAnnotationsValid);
}
function resourceEffectsValid(schema) {
    const effects = schema['x-resource-effects'];
    if (effects === undefined) {
        return true;
    }
    if (typeof effects !== 'object' || effects === null || Array.isArray(effects)) {
        return false;
    }
    const files = new Set(schema['x-resource-files'] ?? []);
    return Object.entries(effects).every(([file, effect]) => effect === 'read' && files.has(file));
}
function outputCapsValid(schema) {
    const cap = schema['x-max-output-chars'];
    if (cap !== undefined && !(Number.isInteger(cap) && cap > 0)) {
        return false;
    }
    return Object.values(schema.properties ?? {}).every(outputCapsValid);
}
function resolveResourcePaths(skillDir, schema) {
    const resources = schema['x-resource-files'] ?? [];
    return resources
        .filter((resource) => typeof resource === 'string' && /^[\w-]+\.applescript$/.test(resource))
        .map((resource) => path.join(skillDir, resource));
}
export function execBinFromTools(tools) {
    for (const entry of tools) {
        const m = /^exec\((.+)\)$/i.exec(entry.trim());
        const scope = m?.[1]?.trim();
        if (scope) {
            return scope;
        }
    }
    return undefined;
}
export async function loadSkillCli(skillDir, tools, readFile) {
    const bin = execBinFromTools(tools);
    if (!bin) {
        return undefined;
    }
    const resolved = await resolveCliSchema(skillDir, bin, readFile);
    if (resolved.schema || resolved.schemaFile) {
        return resolved;
    }
    return undefined;
}
function isEnoent(err) {
    return isRecord(err) && 'code' in err && err.code === 'ENOENT';
}
function isSchemaObject(v) {
    return isRecord(v) && !Array.isArray(v);
}
