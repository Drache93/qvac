import { createHash } from 'crypto';
import { isRecord } from '../../guards.js';
import { copy } from '../../helpers/copy.js';
import { stableStringify } from '../../helpers/stable-stringify.js';
import { createRunOutcomeTracker } from '../../helpers/run-outcome.js';
import { runToolContext } from './loop.js';
function rootIdentity(root) {
    return root.kind === 'local'
        ? `local:${root.root}`
        : `hyper:${root.key}:${root.prefix}:${root.writable}`;
}
export function capabilityPolicy(session) {
    const context = session.toolContext();
    const policy = {
        behaviorDigest: session.behaviorDigest,
        roots: (context.fsRoots ?? []).map(rootIdentity).sort(),
        writeRoots: session.writableRoots.map(rootIdentity).sort(),
        skills: [...session.activation.enabledSkills].sort(),
        skillContent: session.inContextSkills
            .map((skill) => [skill.name, skill.contentDigest ?? null])
            .sort(([left], [right]) => left.localeCompare(right)),
        grantedOps: [...session.grantedOps.entries()]
            .map(([bin, validators]) => [bin, validators.map((validator) => validator.fingerprint).sort()])
            .sort(([left], [right]) => left.localeCompare(right))
    };
    if (session.accessDigest) {
        policy.access = session.accessDigest;
    }
    return policy;
}
const schemaDigests = new WeakMap();
export function schemaDigest(parameters) {
    const serialized = stableStringify(parameters);
    const cached = schemaDigests.get(parameters);
    if (cached?.serialized === serialized) {
        return cached.digest;
    }
    const digest = createHash('sha256').update(serialized).digest('hex');
    schemaDigests.set(parameters, { serialized, digest });
    return digest;
}
const durableFactsCache = new WeakMap();
function toolFacts(tools) {
    return tools.map(mapToolFacts);
}
function mapToolFacts({ name, description, prompt, policyVersion, parameters, toolset, autoApprove, externalWrite, owningSkill, skillGated, rootsRequired, writeRootsRequired, compiled, defer }) {
    return {
        name,
        description,
        prompt: prompt ?? null,
        policyVersion: policyVersion ?? null,
        parametersDigest: schemaDigest(parameters),
        toolset,
        autoApprove: autoApprove === true,
        externalWrite: externalWrite === true,
        owningSkill: owningSkill ?? null,
        skillGated: skillGated === true,
        rootsRequired: rootsRequired === true,
        writeRootsRequired: writeRootsRequired === true,
        compiled: compiled === true,
        defer
    };
}
function makeDurableFactsSource(session) {
    return {
        bindings: [...session.bindings],
        runId: session.runId,
        tools: toolFacts(session.enabled),
        policy: capabilityPolicy(session),
        loadedThisTurn: [...session.loadedThisTurn],
        loadedFilesThisTurn: [...session.loadedFilesThisTurn],
        loadedSkillFiles: [...session.loadedSkillFiles].map(([name, files]) => [
            name,
            [...files]
        ]),
        nudgedSkills: [...session.nudgedSkills],
        backends: [...session.backends],
        outcome: session.runOutcomes.snapshot(),
        skillIcon: session.skillIcon,
        runBudget: { ...session.runBudget },
        startedAt: session.startedAt,
        runStarted: session.runStarted,
        promptParts: session.promptParts,
        activation: {
            ...session.activation,
            enabledSkills: [...session.activation.enabledSkills],
            loadedSkills: [...session.activation.loadedSkills]
        }
    };
}
export function captureFacts(session) {
    const source = makeDurableFactsSource(session);
    const serialized = JSON.stringify(source);
    if (serialized === undefined) {
        return copy(source);
    }
    const cached = durableFactsCache.get(session);
    if (cached?.serialized === serialized) {
        return cached.snapshot;
    }
    const snapshot = JSON.parse(serialized);
    freezeJsonTree(snapshot);
    durableFactsCache.set(session, { serialized, snapshot });
    return snapshot;
}
export function captureToolOperationFacts(session) {
    return copy({
        backends: [...session.backends],
        runBudget: { outputBytesUsed: session.runBudget.outputBytesUsed },
        outcome: { confirmedWrites: session.runOutcomes.snapshot().confirmedWrites }
    });
}
export function restoreFacts(deps, facts) {
    facts = copy(facts);
    const session = deps.session;
    session.bindings = [...facts.bindings];
    session.runId = facts.runId;
    session.loadedThisTurn = new Set(facts.loadedThisTurn);
    session.loadedFilesThisTurn = new Set(facts.loadedFilesThisTurn);
    session.loadedSkillFiles = new Map(facts.loadedSkillFiles.map(([name, files]) => [name, new Set(files)]));
    session.nudgedSkills = new Set(facts.nudgedSkills);
    session.backends = [...facts.backends];
    session.runOutcomes = createRunOutcomeTracker(facts.outcome);
    session.landed = session.runOutcomes.confirmedWrites;
    session.skillIcon = facts.skillIcon;
    session.runBudget = { ...facts.runBudget };
    session.toolContext = runToolContext(deps.args, session.runBudget);
    session.startedAt = facts.startedAt ?? session.startedAt;
    session.runStarted = facts.runStarted;
    session.promptParts = facts.promptParts;
    session.activation = { ...facts.activation, loadedSkills: new Set(facts.activation.loadedSkills) };
}
function freezeJsonTree(root) {
    if (!isRecord(root)) {
        return;
    }
    const pending = [root];
    const visited = new WeakSet();
    while (pending.length > 0) {
        const current = pending.pop();
        if (current === undefined || visited.has(current)) {
            continue;
        }
        visited.add(current);
        enqueueJsonChildren(current, pending);
        Object.freeze(current);
    }
}
function enqueueJsonChildren(current, pending) {
    for (const key of Reflect.ownKeys(current)) {
        const child = Reflect.get(current, key);
        if (isRecord(child)) {
            pending.push(child);
        }
    }
}
