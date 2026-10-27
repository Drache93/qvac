import { z } from 'zod';
import { errorMessage } from '../../guards.js';
import { argvToObject, isObjectSchema, objectProps, walkCommands } from './cli-argv.js';
export function buildSchemaAnnotation(schema) {
    const resourceEffects = schema['x-resource-effects'];
    return (argv) => {
        const first = argv[0];
        if (resourceEffects && typeof first === 'string') {
            if (resourceEffects[basename(first)] === 'read') {
                return 'read';
            }
        }
        return walkCommands(argv, schema).node['x-effect'] === 'read' ? 'read' : 'write';
    };
}
export function buildSchemaOutputCap(schema) {
    return (argv) => walkCommands(argv, schema).node['x-max-output-chars'];
}
function basename(p) {
    return p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1);
}
export function buildSchemaCheck(schema, resourcePaths) {
    const source = schema;
    let zodSchema;
    try {
        zodSchema = z.fromJSONSchema(source);
    }
    catch (err) {
        const msg = errorMessage(err);
        return () => `invalid skill cli JSON Schema: ${msg}`;
    }
    return (argv) => {
        const built = argvToObject(argv, schema);
        if (typeof built === 'string') {
            return built;
        }
        const cmdErr = assertSingleCommand(built, schema);
        if (cmdErr) {
            return cmdErr;
        }
        const resourceErr = assertResourcePath(built, resourcePaths);
        if (resourceErr) {
            return resourceErr;
        }
        const result = zodSchema.safeParse(built);
        if (result.success) {
            return null;
        }
        return formatZod(result.error);
    };
}
function assertResourcePath(obj, resourcePaths) {
    if (!resourcePaths || resourcePaths.length === 0 || typeof obj.script !== 'string') {
        return null;
    }
    return resourcePaths.includes(obj.script) ? null : 'script must be a bundled skill resource';
}
function assertSingleCommand(obj, schema) {
    const props = objectProps(schema);
    const commandKeys = Object.entries(props)
        .filter(([, prop]) => isObjectSchema(prop))
        .map(([k]) => k);
    const present = commandKeys.filter((k) => k in obj);
    if (present.length > 1) {
        return `only one command allowed (got ${present.join(', ')})`;
    }
    return null;
}
function formatZod(err) {
    const issue = err.issues[0];
    if (!issue) {
        return 'invalid parameters';
    }
    const where = issue.path.length ? `${issue.path.join('.')}: ` : '';
    return `${where}${issue.message}`;
}
