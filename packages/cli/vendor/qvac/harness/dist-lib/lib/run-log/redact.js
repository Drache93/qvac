import { brandCapturedRecord, isCapturedJson, RUN_LOG_VERSION } from './protocol.js';
import { isRecord as isObject } from '../guards.js';
import { clipRawCall, MALFORMED_CALL_ID, MAX_RAW_CALL_CHARS, redactBareParameterMarkup, redactToolCallMarkup, toolCallMarkup } from '../helpers/tool-call-markup.js';
export const REDACTED = '[redacted]';
const MALFORMED_CALL_TURN = `[Tool: tool_call (${MALFORMED_CALL_ID})]`;
const CREDENTIAL_FIELDS = new Set([
    'password',
    'passwd',
    'passphrase',
    'dbpassword',
    'githubtoken',
    'openaiapikey',
    'clientpassword',
    'clientpassphrase',
    'secret',
    'clientsecret',
    'token',
    'accesstoken',
    'refreshtoken',
    'idtoken',
    'authtoken',
    'sessiontoken',
    'bearertoken',
    'apitoken',
    'apikey',
    'accesskey',
    'accesskeyid',
    'awsaccesskeyid',
    'privatekey',
    'secretaccesskey',
    'awssecretaccesskey',
    'credentials',
    'authorization',
    'proxyauthorization',
    'cookie',
    'setcookie',
    'xapikey',
    'xamzsecuritytoken',
    'xaccesstoken',
    'xauthtoken'
]);
const NUMERIC_CREDENTIAL_FIELDS = new Set([
    'password',
    'passwd',
    'passphrase',
    'dbpassword',
    'githubtoken',
    'openaiapikey',
    'clientpassword',
    'clientpassphrase',
    'clientsecret',
    'apikey',
    'accesstoken',
    'refreshtoken',
    'idtoken',
    'authtoken',
    'sessiontoken',
    'bearertoken',
    'apitoken',
    'authorization',
    'proxyauthorization',
    'cookie',
    'setcookie',
    'xapikey',
    'xamzsecuritytoken',
    'xaccesstoken',
    'xauthtoken',
    'accesskey',
    'privatekey',
    'credentials',
    'secretaccesskey',
    'awssecretaccesskey'
]);
function normalizeFieldName(name) {
    return name.toLowerCase().replace(/[-_]/g, '');
}
function isCredentialValue(name, value) {
    const field = normalizeFieldName(name);
    if (!CREDENTIAL_FIELDS.has(field)) {
        return false;
    }
    return (typeof value === 'string' ||
        isObject(value) ||
        (typeof value === 'number' && NUMERIC_CREDENTIAL_FIELDS.has(field)));
}
function isRecord(value) {
    return isObject(value) && !Array.isArray(value);
}
function isMalformedCallTurn(message) {
    return (isRecord(message) &&
        message.role === 'tool' &&
        typeof message.content === 'string' &&
        message.content.startsWith(MALFORMED_CALL_TURN));
}
function containsRedactedMarker(value) {
    if (value === REDACTED)
        return true;
    if (!value || typeof value !== 'object')
        return false;
    if (Array.isArray(value)) {
        return value.some(containsRedactedMarker);
    }
    return Object.values(value).some(containsRedactedMarker);
}
function redactRawCall({ raw, name, args, redactArgs, isSensitiveName }) {
    const redacted = redactArgs(name, isRecord(args) ? args : {});
    const clipped = raw.length >= MAX_RAW_CALL_CHARS;
    if (containsRedactedMarker(redacted) || clipped) {
        return clipRawCall(toolCallMarkup([{ name, arguments: redacted }]));
    }
    return redactBareParameterMarkup(redactToolCallMarkup(raw, redactArgs), isSensitiveName);
}
function define(out, key, value) {
    Object.defineProperty(out, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
    });
}
function isCompletionSnapshot(value) {
    return (isRecord(value.context) &&
        Object.hasOwn(value, 'value') &&
        ['active', 'done', 'stopped'].includes(String(value.status)));
}
function isOperation(value) {
    return (typeof value.id === 'string' &&
        typeof value.name === 'string' &&
        Object.hasOwn(value, 'args') &&
        (value.effect === 'read' || value.effect === 'write'));
}
function isReceipt(value) {
    return (typeof value.id === 'string' &&
        typeof value.name === 'string' &&
        (value.effect === 'read' || value.effect === 'write') &&
        (value.status === 'intent' || value.status === 'retry' || value.status === 'result'));
}
function isMetadata(value) {
    return (value.version === RUN_LOG_VERSION &&
        value.type === 'metadata' &&
        typeof value.runId === 'string');
}
function isDurableFacts(value) {
    return (typeof value.runId === 'string' &&
        Array.isArray(value.tools) &&
        Array.isArray(value.bindings) &&
        isRecord(value.runBudget) &&
        isRecord(value.outcome));
}
function mergeSensitiveSchema(actual, prompt) {
    const properties = {};
    const actualProperties = actual.properties ?? {};
    const promptProperties = prompt.properties ?? {};
    for (const key of new Set([...Object.keys(actualProperties), ...Object.keys(promptProperties)])) {
        const actualChild = actualProperties[key];
        const promptChild = promptProperties[key];
        define(properties, key, actualChild && promptChild
            ? mergeSensitiveSchema(actualChild, promptChild)
            : (promptChild ?? actualChild));
    }
    const items = actual.items && prompt.items
        ? mergeSensitiveSchema(actual.items, prompt.items)
        : (prompt.items ?? actual.items);
    const merged = { ...actual, ...prompt };
    if (actual.sensitive === true || prompt.sensitive === true) {
        merged.sensitive = true;
    }
    if (Object.keys(properties).length > 0) {
        merged.properties = properties;
    }
    if (items) {
        merged.items = items;
    }
    return merged;
}
function mergeSensitiveParameters(actual, prompt) {
    const merged = mergeSensitiveSchema(actual, prompt);
    return { ...merged, type: 'object', properties: merged.properties ?? {} };
}
function isDoneActorType(type) {
    return typeof type === 'string' && type.startsWith('xstate.done.actor.');
}
function isPlainRecord(value) {
    if (!isRecord(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function normalizeJsonHook(value, key) {
    let prototype = value;
    let descriptor;
    while (prototype && !descriptor) {
        descriptor = Object.getOwnPropertyDescriptor(prototype, 'toJSON');
        prototype = Object.getPrototypeOf(prototype);
    }
    if (!descriptor || ('value' in descriptor && typeof descriptor.value !== 'function')) {
        return { handled: false };
    }
    if (key === undefined) {
        const encoded = JSON.stringify(value);
        return { handled: true, value: encoded === undefined ? undefined : JSON.parse(encoded) };
    }
    const holder = {};
    define(holder, key, value);
    const encoded = JSON.stringify(holder);
    if (encoded === undefined) {
        return { handled: true, value: undefined };
    }
    const parsed = JSON.parse(encoded);
    if (parsed === null || typeof parsed !== 'object') {
        return { handled: true, value: undefined };
    }
    return { handled: true, value: Object.hasOwn(parsed, key) ? Reflect.get(parsed, key) : undefined };
}
function cloneStructure(value, memo = new WeakMap()) {
    if (!value || typeof value !== 'object') {
        return value;
    }
    const hit = memo.get(value);
    if (hit !== undefined) {
        return hit;
    }
    if (Array.isArray(value)) {
        const out = [];
        memo.set(value, out);
        for (const entry of value) {
            out.push(cloneStructure(entry, memo));
        }
        return out;
    }
    const out = {};
    memo.set(value, out);
    for (const [key, entry] of Object.entries(value)) {
        define(out, key, cloneStructure(entry, memo));
    }
    return out;
}
function copyPatch(patch) {
    return isCapturedJson(patch) ? patch : cloneStructure(patch);
}
function schemaFingerprint(parameters, prompted) {
    try {
        return JSON.stringify([parameters, prompted]);
    }
    catch {
        return undefined;
    }
}
function schemaPropertyFor(schema, key) {
    const properties = schema.properties;
    if (!properties) {
        return undefined;
    }
    if (Object.hasOwn(properties, key)) {
        return properties[key];
    }
    const lower = key.toLowerCase();
    for (const propertyKey of Object.keys(properties)) {
        if (propertyKey.toLowerCase() === lower) {
            return properties[propertyKey];
        }
    }
    return undefined;
}
function buildRedactor(initialTools = []) {
    const schemas = new Map();
    const schemaFingerprints = new Map();
    let shared = new WeakMap();
    let schemaShared = new WeakMap();
    const historyMemos = new WeakMap();
    const registerTools = (tools) => {
        let registered = false;
        for (const tool of tools) {
            if (!tool || typeof tool.name !== 'string' || !tool.parameters)
                continue;
            const prompted = tool.prompt?.parameters;
            const fingerprint = schemaFingerprint(tool.parameters, prompted);
            if (fingerprint !== undefined && schemaFingerprints.get(tool.name) === fingerprint) {
                continue;
            }
            const parameters = prompted
                ? mergeSensitiveParameters(tool.parameters, prompted)
                : tool.parameters;
            schemas.set(tool.name, parameters);
            if (fingerprint === undefined) {
                schemaFingerprints.delete(tool.name);
            }
            else {
                schemaFingerprints.set(tool.name, fingerprint);
            }
            registered = true;
        }
        if (registered) {
            shared = new WeakMap();
            schemaShared = new WeakMap();
        }
    };
    const isSensitiveMarkupName = (name) => {
        if (CREDENTIAL_FIELDS.has(normalizeFieldName(name))) {
            return true;
        }
        const lower = name.toLowerCase();
        for (const schema of schemas.values()) {
            const properties = schema.properties;
            if (!properties) {
                continue;
            }
            for (const key of Object.keys(properties)) {
                if (key.toLowerCase() === lower && properties[key]?.sensitive === true) {
                    return true;
                }
            }
        }
        return false;
    };
    const redactProse = (text) => redactBareParameterMarkup(redactToolCallMarkup(text, redactToolArguments), isSensitiveMarkupName);
    const walk = (value, memo, jsonKey) => {
        if (typeof value === 'string') {
            return jsonKey === 'response' || jsonKey === 'contentText' ? redactProse(value) : value;
        }
        if (!value || typeof value !== 'object')
            return value;
        const hit = memo?.get(value);
        if (hit !== undefined) {
            return hit;
        }
        if (Array.isArray(value)) {
            const out = [];
            memo?.set(value, out);
            for (let index = 0; index < value.length; index++) {
                out.push(walk(value[index], memo, String(index)));
            }
            return out;
        }
        if (!isPlainRecord(value)) {
            const normalized = normalizeJsonHook(value, jsonKey);
            if (normalized.handled) {
                return walk(normalized.value, memo);
            }
            const json = JSON.stringify(value);
            return json === undefined ? cloneStructure(value, memo) : walk(JSON.parse(json), memo);
        }
        const normalized = normalizeJsonHook(value, jsonKey);
        if (normalized.handled) {
            return walk(normalized.value, memo);
        }
        const out = {};
        memo?.set(value, out);
        for (const [key, entry] of Object.entries(value)) {
            define(out, key, isCredentialValue(key, entry) ? REDACTED : walk(entry, memo, key));
        }
        return out;
    };
    const walkSchema = (value, schema, { memo, jsonKey } = {}) => {
        if (schema.sensitive === true)
            return REDACTED;
        if (typeof value === 'string') {
            return redactBareParameterMarkup(value, isSensitiveMarkupName);
        }
        if (value && typeof value === 'object') {
            const normalized = normalizeJsonHook(value, jsonKey);
            if (normalized.handled) {
                return walkSchema(normalized.value, schema, { memo });
            }
        }
        const cacheSchema = memo === shared;
        if (cacheSchema && value && typeof value === 'object') {
            const cached = schemaShared.get(value)?.get(schema);
            if (cached !== undefined) {
                return cached;
            }
        }
        if (Array.isArray(value)) {
            if (!schema.items) {
                return walk(value, memo, jsonKey);
            }
            const out = [];
            if (cacheSchema) {
                cacheSchemaValue(value, schema, out);
            }
            for (let index = 0; index < value.length; index++) {
                out.push(walkSchema(value[index], schema.items, { memo, jsonKey: String(index) }));
            }
            return out;
        }
        if (!isPlainRecord(value)) {
            return walk(value, memo, jsonKey);
        }
        const out = {};
        if (cacheSchema) {
            cacheSchemaValue(value, schema, out);
        }
        for (const [key, entry] of Object.entries(value)) {
            const childSchema = schemaPropertyFor(schema, key);
            if (isCredentialValue(key, entry)) {
                define(out, key, REDACTED);
            }
            else if (childSchema) {
                define(out, key, walkSchema(entry, childSchema, { memo, jsonKey: key }));
            }
            else {
                define(out, key, walk(entry, memo, key));
            }
        }
        return out;
    };
    function cacheSchemaValue(value, schema, result) {
        let bySchema = schemaShared.get(value);
        if (!bySchema) {
            schemaShared.set(value, (bySchema = new WeakMap()));
        }
        bySchema.set(schema, result);
    }
    const walkCall = (value, memo) => {
        if (!isRecord(value) || typeof value.name !== 'string') {
            return walk(value, memo);
        }
        const schema = schemas.get(value.name);
        const out = {};
        const argsKey = Object.hasOwn(value, 'args') ? 'args' : 'arguments';
        for (const [key, entry] of Object.entries(value)) {
            if (isCredentialValue(key, entry)) {
                define(out, key, REDACTED);
            }
            else if (key === argsKey && schema) {
                define(out, key, walkSchema(entry, schema, { memo, jsonKey: key }));
            }
            else if ((key === 'raw' || key === 'rawCall') && typeof entry === 'string') {
                define(out, key, redactRawCall({
                    raw: entry,
                    name: value.name,
                    args: value[argsKey],
                    redactArgs: redactToolArguments,
                    isSensitiveName: isSensitiveMarkupName
                }));
            }
            else {
                define(out, key, walk(entry, memo, key));
            }
        }
        return out;
    };
    const walkPrepareStep = (value, memo) => {
        if (!isRecord(value)) {
            return walk(value, memo);
        }
        const hit = memo?.get(value);
        if (hit !== undefined) {
            return hit;
        }
        const schema = schemas.get(String(value.tool));
        const out = {};
        memo?.set(value, out);
        for (const [key, entry] of Object.entries(value)) {
            let sanitized;
            if (key === 'args' && schema) {
                sanitized = walkSchema(entry, schema, { memo, jsonKey: key });
            }
            else if (isCredentialValue(key, entry)) {
                sanitized = REDACTED;
            }
            else {
                sanitized = walk(entry, memo, key);
            }
            define(out, key, sanitized);
        }
        return out;
    };
    const walkToolErrors = (errors, memo) => errors.map((error) => {
        if (!isRecord(error)) {
            return walk(error, memo);
        }
        const out = {};
        for (const [key, entry] of Object.entries(error)) {
            define(out, key, (key === 'raw' || key === 'message') && typeof entry === 'string'
                ? REDACTED
                : walk(entry, memo, key));
        }
        return out;
    });
    const walkLastRound = (value, memo) => {
        const round = {};
        for (const [key, entry] of Object.entries(value)) {
            let safeEntry;
            if (key === 'toolCalls' && Array.isArray(entry)) {
                safeEntry = entry.map((call) => walkCall(call, memo));
            }
            else if (key === 'toolErrors' && Array.isArray(entry)) {
                safeEntry = walkToolErrors(entry, memo);
            }
            else if (key === 'contentText' && typeof entry === 'string') {
                safeEntry = redactProse(entry);
            }
            else {
                safeEntry = walk(entry, memo, key);
            }
            define(round, key, safeEntry);
        }
        return round;
    };
    const walkRejectedCall = (value, memo) => {
        const rejected = {};
        for (const [key, entry] of Object.entries(value)) {
            let safeEntry;
            if (key === 'call') {
                safeEntry = walkCall(entry, memo);
            }
            else if (key === 'activity') {
                safeEntry = walkToolActivity(entry, memo);
            }
            else {
                safeEntry = walk(entry, memo, key);
            }
            define(rejected, key, safeEntry);
        }
        return rejected;
    };
    const walkHistoryOutput = (splice, memo) => {
        const messages = splice.messages;
        if (!Array.isArray(messages)) {
            return cloneStructure(splice, memo);
        }
        const out = {};
        for (const [key, entry] of Object.entries(splice)) {
            define(out, key, key === 'messages' ? walkHistory(messages, memo) : cloneStructure(entry, memo));
        }
        return out;
    };
    const walkHistoryEntry = (message, memo, malformed = false) => {
        const call = isMalformedCallTurn(message);
        if (!isRecord(message) ||
            typeof message.content !== 'string' ||
            (message.role !== 'assistant' && !call)) {
            return cloneStructure(message, memo);
        }
        const hit = memo?.get(message);
        if (hit !== undefined) {
            return hit;
        }
        const out = cloneStructure(message, memo);
        if (call) {
            out.content = `${MALFORMED_CALL_TURN}\n${REDACTED}`;
        }
        else {
            out.content = malformed ? REDACTED : redactProse(message.content);
        }
        memo?.set(message, out);
        return out;
    };
    const historyMemoFor = (memo) => {
        if (!memo) {
            return undefined;
        }
        let history = historyMemos.get(memo);
        if (!history) {
            historyMemos.set(memo, (history = new WeakMap()));
        }
        return history;
    };
    const walkHistory = (messages, memo) => {
        const hit = memo?.get(messages);
        if (hit !== undefined) {
            return hit;
        }
        const out = messages.map((message, at) => walkHistoryEntry(message, memo, isMalformedCallTurn(messages[at + 1])));
        memo?.set(messages, out);
        return out;
    };
    const walkContext = (context, memo) => {
        const out = {};
        const handled = new Set();
        for (const [key, entry] of Object.entries(context)) {
            if (key === 'currentCall' || key === 'pendingCall') {
                const safeCall = key === 'pendingCall' ? walkApprovalCall(entry, memo) : walkCall(entry, memo);
                define(out, key, safeCall);
                handled.add(key);
            }
            else if (key === 'toolQueue' && Array.isArray(entry)) {
                define(out, key, entry.map((call) => walkCall(call, memo)));
                handled.add(key);
            }
            else if (key === 'lastRound' && isRecord(entry)) {
                define(out, key, walkLastRound(entry, memo));
                handled.add(key);
            }
            else if (key === 'rejectedCall' && isRecord(entry)) {
                define(out, key, walkRejectedCall(entry, memo));
                handled.add(key);
            }
            else if (key === 'prepareStep') {
                define(out, key, walkPrepareStep(entry, memo));
                handled.add(key);
            }
            else if (key === 'history' && Array.isArray(entry)) {
                define(out, key, walkHistory(entry, historyMemoFor(memo)));
                handled.add(key);
            }
        }
        for (const [key, entry] of Object.entries(context)) {
            if (handled.has(key))
                continue;
            let safeEntry;
            if (key === 'execution') {
                safeEntry = walkExecution(entry, memo);
            }
            else if (key === 'durable') {
                safeEntry = walkFacts(entry, memo);
            }
            else if (isCredentialValue(key, entry)) {
                safeEntry = REDACTED;
            }
            else {
                safeEntry = walk(entry, memo, key);
            }
            define(out, key, safeEntry);
        }
        return out;
    };
    const walkSnapshot = (snapshot, memo) => {
        const hit = memo?.get(snapshot);
        if (hit !== undefined) {
            if (isRecord(hit)) {
                return hit;
            }
        }
        const out = {};
        memo?.set(snapshot, out);
        for (const [key, entry] of Object.entries(snapshot)) {
            let safeEntry;
            if (key === 'context' && isRecord(entry)) {
                safeEntry = walkContext(entry, memo);
            }
            else if (isCredentialValue(key, entry)) {
                safeEntry = REDACTED;
            }
            else {
                safeEntry = walk(entry, memo, key);
            }
            define(out, key, safeEntry);
        }
        return out;
    };
    const walkOperation = (operation, memo) => {
        const args = isRecord(operation.args) ? operation.args : undefined;
        const hookToolName = (operation.name === 'hook:runPreToolFold' ||
            operation.name === 'hook:runPostToolFold' ||
            operation.name === 'hook:toolFailure') &&
            typeof args?.toolName === 'string'
            ? args.toolName
            : undefined;
        const schema = typeof operation.name === 'string'
            ? (schemas.get(operation.name) ?? (hookToolName ? schemas.get(hookToolName) : undefined))
            : undefined;
        const out = {};
        for (const [key, entry] of Object.entries(operation)) {
            if (key === 'args' && schema && hookToolName) {
                define(out, key, walkHookOperationArgs(entry, schema, memo));
            }
            else if (key === 'args' && schema) {
                define(out, key, walkSchema(entry, schema, { memo, jsonKey: key }));
            }
            else if (key === 'facts') {
                define(out, key, walkFacts(entry, memo));
            }
            else {
                define(out, key, isCredentialValue(key, entry) ? REDACTED : walk(entry, memo, key));
            }
        }
        return out;
    };
    const walkActorEvent = (event, memo) => {
        const hit = memo?.get(event);
        if (hit !== undefined) {
            if (isRecord(hit)) {
                return hit;
            }
        }
        const type = String(event.type);
        const outputKind = type.slice(type.lastIndexOf('.') + 1);
        const out = {};
        memo?.set(event, out);
        for (const [key, entry] of Object.entries(event)) {
            if (key !== 'output' || !isRecord(entry)) {
                define(out, key, isCredentialValue(key, entry) ? REDACTED : walk(entry, memo, key));
                continue;
            }
            const output = {};
            for (const [outputKey, outputValue] of Object.entries(entry)) {
                if (outputKey === 'history' && isRecord(outputValue)) {
                    define(output, outputKey, walkHistoryOutput(outputValue, historyMemoFor(memo)));
                }
                else if ((outputKind === 'generating' || outputKind === 'resolving') &&
                    (outputKey === 'toolCalls' || outputKey === 'calls') &&
                    Array.isArray(outputValue)) {
                    define(output, outputKey, outputValue.map((call) => walkCall(call, memo)));
                }
                else if (outputKind === 'generating' &&
                    outputKey === 'toolErrors' &&
                    Array.isArray(outputValue)) {
                    define(output, outputKey, walkToolErrors(outputValue, memo));
                }
                else if ((outputKind === 'inspecting' || outputKind === 'searching') &&
                    outputKey === 'directTool' &&
                    isRecord(outputValue)) {
                    define(output, outputKey, walkDirectTool(outputValue, memo));
                }
                else if (outputKind === 'inspecting' &&
                    (outputKey === 'rejection' || outputKey === 'rejected') &&
                    isRecord(outputValue)) {
                    define(output, outputKey, walkRejection(outputValue, memo));
                }
                else if (outputKey === 'execution') {
                    define(output, outputKey, walkExecution(outputValue, memo));
                }
                else if (outputKind === 'inspecting' && outputKey === 'call' && isRecord(outputValue)) {
                    define(output, outputKey, walkCall(outputValue, memo));
                }
                else if ((outputKind === 'prepareChecking' || outputKind === 'inspectPrepare') &&
                    outputKey === 'args') {
                    const schema = schemas.get(String(entry.tool));
                    define(output, outputKey, schema
                        ? walkSchema(outputValue, schema, { memo, jsonKey: outputKey })
                        : walk(outputValue, memo, outputKey));
                }
                else if (outputKind === 'preparing' && outputKey === 'step') {
                    define(output, outputKey, walkPrepareStep(outputValue, memo));
                }
                else if (outputKind === 'preparing') {
                    define(output, outputKey, walkPreparing(outputValue, memo));
                }
                else {
                    define(output, outputKey, walk(outputValue, memo, outputKey));
                }
            }
            define(out, key, output);
        }
        return out;
    };
    const walkApprovalCall = (value, memo) => {
        if (!isRecord(value)) {
            return walk(value, memo);
        }
        const call = { name: value.name, arguments: value.arguments };
        const sanitized = walkCall(call, memo);
        const sanitizedArgs = isRecord(sanitized) ? sanitized.arguments : undefined;
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            define(out, key, key === 'arguments' ? sanitizedArgs : walk(entry, memo, key));
        }
        return out;
    };
    const walkExecution = (value, memo) => {
        if (!isRecord(value)) {
            return walk(value, memo);
        }
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            if (key !== 'gate' || !isRecord(entry)) {
                define(out, key, walk(entry, memo, key));
            }
            else {
                const gate = {};
                for (const [gateKey, gateValue] of Object.entries(entry)) {
                    define(gate, gateKey, gateKey === 'call' ? walkApprovalCall(gateValue, memo) : walk(gateValue, memo, gateKey));
                }
                define(out, key, gate);
            }
        }
        return out;
    };
    const walkToolActivity = (value, memo) => {
        if (!isRecord(value)) {
            return walk(value, memo);
        }
        const out = {};
        const call = walkCall({ name: value.name, args: value.args }, memo);
        const sanitizedArgs = isRecord(call) ? call.args : undefined;
        for (const [key, entry] of Object.entries(value)) {
            define(out, key, key === 'args' ? sanitizedArgs : walk(entry, memo, key));
        }
        return out;
    };
    const walkTrusted = (value) => {
        if (!value || typeof value !== 'object') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((entry) => walkTrusted(entry));
        }
        if (!isPlainRecord(value)) {
            return cloneStructure(value);
        }
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            define(out, key, walkTrusted(entry));
        }
        return out;
    };
    const walkTrustedSchema = (schema) => {
        if (!isPlainRecord(schema)) {
            return walkTrusted(schema);
        }
        const out = {};
        for (const [key, entry] of Object.entries(schema)) {
            if (key === 'properties' && isRecord(entry)) {
                const properties = {};
                for (const [name, child] of Object.entries(entry)) {
                    define(properties, name, walkTrustedSchema(child));
                }
                define(out, key, properties);
            }
            else if (key === 'items') {
                define(out, key, walkTrustedSchema(entry));
            }
            else {
                define(out, key, walkTrusted(entry));
            }
        }
        return out;
    };
    const walkHookOperationArgs = (value, schema, memo) => {
        if (!isRecord(value)) {
            return walk(value, memo);
        }
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            if (key === 'args') {
                define(out, key, walkSchema(entry, schema, { memo, jsonKey: key }));
            }
            else if (key === 'parameters') {
                define(out, key, walkTrustedSchema(entry));
            }
            else {
                define(out, key, isCredentialValue(key, entry) ? REDACTED : walk(entry, memo, key));
            }
        }
        return out;
    };
    function redactHookPreToolResult(result, schema) {
        const out = {};
        for (const [key, entry] of Object.entries(result)) {
            define(out, key, key === 'args'
                ? walkSchema(entry, schema, { jsonKey: key })
                : walk(entry, new WeakMap(), key));
        }
        return out;
    }
    function redactOperationResult(operation, result) {
        const toolName = operation.name === 'hook:runPreToolFold' && isRecord(operation.args)
            ? operation.args.toolName
            : undefined;
        const schema = typeof toolName === 'string' ? schemas.get(toolName) : undefined;
        if (schema && isRecord(result)) {
            return redactHookPreToolResult(result, schema);
        }
        return walk(result, new WeakMap());
    }
    function redactToolArguments(name, args) {
        const schema = schemas.get(name);
        const safe = schema
            ? walkSchema(args, schema, { memo: new WeakMap(), jsonKey: 'args' })
            : walk(args, new WeakMap());
        return isRecord(safe) ? safe : {};
    }
    const walkPrompt = (prompt, memo) => {
        if (!isRecord(prompt)) {
            return walk(prompt, memo);
        }
        const out = {};
        for (const [key, entry] of Object.entries(prompt)) {
            define(out, key, key === 'parameters' ? walkTrustedSchema(entry) : walk(entry, memo, key));
        }
        return out;
    };
    const walkFacts = (value, memo) => {
        if (!isRecord(value)) {
            return walk(value, memo);
        }
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            if (key === 'tools' && Array.isArray(entry)) {
                define(out, key, entry.map((tool) => {
                    if (!isRecord(tool)) {
                        return walk(tool, memo, 'tools');
                    }
                    const copy = {};
                    for (const [toolKey, toolValue] of Object.entries(tool)) {
                        define(copy, toolKey, toolKey === 'prompt' ? walkPrompt(toolValue, memo) : walk(toolValue, memo, toolKey));
                    }
                    return copy;
                }));
            }
            else {
                define(out, key, walk(entry, memo, key));
            }
        }
        return out;
    };
    const walkResponseFormat = (value, memo) => {
        if (!isRecord(value)) {
            return walk(value, memo);
        }
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            if (key !== 'json_schema' || !isRecord(entry)) {
                define(out, key, walk(entry, memo, key));
                continue;
            }
            const jsonSchema = {};
            for (const [schemaKey, schemaValue] of Object.entries(entry)) {
                define(jsonSchema, schemaKey, schemaKey === 'schema'
                    ? walkTrustedSchema(schemaValue)
                    : walk(schemaValue, memo, schemaKey));
            }
            define(out, key, jsonSchema);
        }
        return out;
    };
    const walkRequest = (value, memo) => {
        if (!isRecord(value)) {
            return walk(value, memo);
        }
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            define(out, key, key === 'responseFormat' ? walkResponseFormat(entry, memo) : walk(entry, memo, key));
        }
        return out;
    };
    const walkMetadata = (value, memo) => {
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            let safeEntry;
            if (key === 'definition') {
                safeEntry = walkTrusted(entry);
            }
            else if (key === 'request') {
                safeEntry = walkRequest(entry, memo);
            }
            else {
                safeEntry = walk(entry, memo, key);
            }
            define(out, key, safeEntry);
        }
        return out;
    };
    const walkRequestMessages = (value, memo) => {
        if (Array.isArray(value)) {
            return walkHistory(value, historyMemoFor(memo));
        }
        const reference = isRecord(value) ? value.$qvacHistory : undefined;
        if (!isRecord(reference) || !Array.isArray(reference.items)) {
            return walk(value, memo);
        }
        const items = reference.items;
        const inline = items.map((item) => (isRecord(item) ? item.inline : undefined));
        const walked = walkHistory(inline, historyMemoFor(memo));
        const out = {};
        for (const [key, entry] of Object.entries(reference)) {
            define(out, key, key === 'items' && Array.isArray(walked)
                ? items.map((item, at) => inline[at] === undefined ? cloneStructure(item) : { inline: walked[at] })
                : cloneStructure(entry));
        }
        return { $qvacHistory: out };
    };
    const walkRequestRecord = (record, memo) => {
        const out = {};
        for (const [key, entry] of Object.entries(record)) {
            if (key === 'messages') {
                define(out, key, walkRequestMessages(entry, memo));
            }
            else if (key === 'tools' || key === 'params') {
                define(out, key, cloneStructure(entry));
            }
            else {
                define(out, key, walk(entry, memo, key));
            }
        }
        return out;
    };
    const isRequestRecord = (value) => value.version === RUN_LOG_VERSION && value.type === 'request';
    const walkBoundary = (value, memo) => {
        if (!isRecord(value)) {
            return walk(value, memo);
        }
        if (isRequestRecord(value)) {
            return walkRequestRecord(value, memo);
        }
        if (isDurableFacts(value)) {
            return walkFacts(value, memo);
        }
        if (value.version === RUN_LOG_VERSION &&
            value.type === 'operation' &&
            isRecord(value.receipt)) {
            const out = {};
            for (const [key, entry] of Object.entries(value)) {
                define(out, key, key === 'receipt' && isRecord(entry) ? walkOperation(entry, memo) : walk(entry, memo, key));
            }
            return out;
        }
        if (isCompletionSnapshot(value)) {
            return walkSnapshot(value, memo);
        }
        if (isOperation(value) || isReceipt(value)) {
            return walkOperation(value, memo);
        }
        if (isDoneActorType(value.type)) {
            return walkActorEvent(value, memo);
        }
        if (value.type === 'tool-activity') {
            return walkToolActivity(value, memo);
        }
        if (isMetadata(value)) {
            return walkMetadata(value, memo);
        }
        return walk(value, memo);
    };
    const walkRunRecord = (record, memo) => {
        if (isCapturedJson(record)) {
            return record;
        }
        if (!isRecord(record)) {
            return walk(record, memo);
        }
        if (isMetadata(record)) {
            return walkMetadata(record, memo);
        }
        if (isRequestRecord(record)) {
            return walkRequestRecord(record, memo);
        }
        const copied = {};
        for (const [recordKey, recordValue] of Object.entries(record)) {
            if (isCapturedJson(recordValue)) {
                define(copied, recordKey, recordValue);
            }
            else if (recordKey === 'snapshot') {
                define(copied, recordKey, walkBoundary(recordValue, memo));
            }
            else if ((recordKey === 'events' || recordKey === 'patch') && isRecord(recordValue)) {
                define(copied, recordKey, copyPatch(recordValue));
            }
            else if (recordKey === 'events' && Array.isArray(recordValue)) {
                define(copied, recordKey, recordValue.map((event) => (isRecord(event) ? copyPatch(event) : walk(event, memo))));
            }
            else if (recordKey === 'receipt' && isRecord(recordValue)) {
                define(copied, recordKey, walkOperation(recordValue, memo));
            }
            else {
                define(copied, recordKey, walk(recordValue, memo));
            }
        }
        return copied;
    };
    const walkEngineStep = (step, memo) => {
        const out = {};
        for (const [key, entry] of Object.entries(step)) {
            if (key !== 'records' || !Array.isArray(entry)) {
                define(out, key, walk(entry, memo, key));
                continue;
            }
            define(out, key, entry.map((record) => walkRunRecord(record, memo)));
        }
        return out;
    };
    const walkDirectTool = (value, memo) => {
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            if (key === 'call') {
                define(out, key, walkCall(entry, memo));
            }
            else if (key === 'execution') {
                define(out, key, walkExecution(entry, memo));
            }
            else {
                define(out, key, walk(entry, memo, key));
            }
        }
        return out;
    };
    const walkRejection = (value, memo) => {
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            if (key === 'call') {
                define(out, key, walkCall(entry, memo));
            }
            else if (key === 'activity') {
                define(out, key, walkToolActivity(entry, memo));
            }
            else {
                define(out, key, walk(entry, memo, key));
            }
        }
        return out;
    };
    const walkPreparing = (value, memo) => {
        if (!isRecord(value)) {
            return walk(value, memo);
        }
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            if (key === 'directTool' && isRecord(entry)) {
                define(out, key, walkDirectTool(entry, memo));
            }
            else {
                define(out, key, walk(entry, memo, key));
            }
        }
        return out;
    };
    function redactValue(value) {
        return walkBoundary(value, new WeakMap());
    }
    function redactShared(value) {
        return brandCapturedRecord(walkBoundary(value, shared));
    }
    function redactStep(step) {
        if (isRecord(step) &&
            Number.isSafeInteger(step.seq) &&
            Number.isSafeInteger(step.expectedLength) &&
            Array.isArray(step.records)) {
            return walkEngineStep(step, new WeakMap());
        }
        return walkBoundary(step, new WeakMap());
    }
    function redactRecord(record) {
        return brandCapturedRecord(walkRunRecord(record, new WeakMap()));
    }
    const redactor = Object.assign(redactValue, {
        registerTools,
        redactOperationResult,
        redactToolArguments,
        redactStep,
        redactShared,
        redactRecord
    });
    registerTools(initialTools);
    return redactor;
}
const defaultRedactor = buildRedactor();
export function createRunLogRedactor(tools = []) {
    return buildRedactor(tools);
}
export function redact(value) {
    return defaultRedactor(value);
}
export function redactShared(value) {
    return defaultRedactor.redactShared(value);
}
export function redactStep(step, redactor = defaultRedactor) {
    return redactor.redactStep(step);
}
export function redactRecord(record, redactor = redact) {
    if (isCapturedJson(record)) {
        return record;
    }
    if (!isRecord(record)) {
        return redactor(record);
    }
    const { patch, events, ...rest } = record;
    const snapshot = rest.type === 'checkpoint' ? rest.snapshot : undefined;
    const safeRest = { ...rest };
    if (rest.type === 'checkpoint') {
        delete safeRest.snapshot;
    }
    const out = { ...redactor(safeRest) };
    if (rest.type === 'checkpoint' && snapshot !== undefined) {
        define(out, 'snapshot', isCapturedJson(snapshot) ? snapshot : redactor(snapshot));
    }
    if (patch) {
        define(out, 'patch', copyPatch(patch));
    }
    if (Array.isArray(events)) {
        define(out, 'events', events.map(copyPatch));
    }
    return out;
}
export function unredact(_snapshot, _request) { }
export function redactingCore(core, redactor = defaultRedactor) {
    return new Proxy(core, {
        get(target, property, receiver) {
            if (property === 'append') {
                return (value) => target.append(redactRecord(value, redactor));
            }
            if (property === 'redactValue')
                return redactor.redactShared;
            const member = Reflect.get(target, property, receiver);
            if (typeof member !== 'function') {
                return member;
            }
            return member.bind(target);
        }
    });
}
