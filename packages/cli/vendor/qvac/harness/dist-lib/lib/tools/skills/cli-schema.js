export { CLI_SCHEMA_FILENAME } from './cli-schema-types.js';
export { argvToObject } from './cli-argv.js';
export { loadSkillCli, resolveCliSchema, execBinFromTools } from './cli-schema-load.js';
import { buildSchemaAnnotation, buildSchemaCheck, buildSchemaOutputCap } from './cli-schema-check.js';
import { createHash } from 'crypto';
import fs from 'fs';
import { errorCode } from '../../guards.js';
import { stableStringify } from '../../helpers/stable-stringify.js';
const CLI_POLICY_VERSION = 1;
function resourceIdentity(resourcePath) {
    try {
        const digest = createHash('sha256').update(fs.readFileSync(resourcePath)).digest('hex');
        return [resourcePath, digest];
    }
    catch (error) {
        const code = errorCode(error) ?? 'unreadable';
        return [resourcePath, `unreadable:${code}`];
    }
}
export function buildCliValidator(def) {
    const bin = def.bin.toLowerCase();
    const fingerprint = createHash('sha256')
        .update(stableStringify({
        version: CLI_POLICY_VERSION,
        bin,
        schema: def.schema ?? null,
        resources: (def.resourcePaths ?? []).map(resourceIdentity)
    }))
        .digest('hex');
    if (!def.schema) {
        return {
            bin,
            fingerprint,
            check: () => 'skill cli schema is missing',
            annotation: () => 'write',
            effect: () => 'write',
            outputCap: () => undefined
        };
    }
    const check = buildSchemaCheck(def.schema, def.resourcePaths);
    const annotation = buildSchemaAnnotation(def.schema);
    const outputCap = buildSchemaOutputCap(def.schema);
    return {
        bin,
        fingerprint,
        check,
        annotation,
        effect: (argv) => (check(argv) === null ? annotation(argv) : 'write'),
        outputCap: (argv) => (check(argv) === null ? outputCap(argv) : undefined)
    };
}
export function checkCliOps(argv, compiled) {
    if (compiled.length === 0)
        return null;
    let lastErr = null;
    for (const c of compiled) {
        const err = c.check(argv);
        if (err === null) {
            return null;
        }
        lastErr = err;
    }
    return lastErr ?? 'command does not match any allowed skill operation';
}
