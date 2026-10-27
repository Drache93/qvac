import { Agent } from '../../agent/index.js';
import { createRunOutcomeTracker } from '../../helpers/run-outcome.js';
import { Policy } from '../../policy/index.js';
import { createRunBudget, runToolContext } from './loop.js';
import { createHash, createHmac, randomBytes } from 'crypto';
import { createInvokeTracker } from './actors.js';
import { stableStringify } from '../../helpers/stable-stringify.js';
import { historyPayload } from '../tool-turns.js';
const HOST_SHELL = { name: 'host' };
export const RUNTIME_BINDINGS = [
    'approve',
    'attach',
    'fetchAttachment',
    'askUser',
    'modelRound'
];
export function loadedSkills(context, session) {
    const files = [...session.loadedFilesThisTurn].map((key) => key.slice(0, key.indexOf('\0')));
    return new Set([...context.activated, ...session.loadedThisTurn, ...files]);
}
export function createSession(args, options) {
    const { runId, invokes = createInvokeTracker(), now = () => Date.now(), wallStart = Date.now(), requestDigestKey, digestRunId, pipeline, outbound, agentPorts } = options;
    const runBudget = createRunBudget(now());
    const shell = (args.tools ?? []).some((tool) => tool.name === 'exec') ? [HOST_SHELL] : [];
    const access = args.access ?? Policy.forRun([args.agent?.policy, args.policy], args, shell);
    const runOutcomes = createRunOutcomeTracker();
    const callKeySecret = requestDigestKey
        ? createHmac('sha256', requestDigestKey)
            .update('qvac:completion:call-key:v1\0')
            .update(digestRunId ?? runId)
            .digest()
        : randomBytes(32);
    return {
        bindings: RUNTIME_BINDINGS.filter((name) => typeof args[name] === 'function'),
        runId,
        pipeline: access?.rules.length ? pipeline.withRules(access.rules) : pipeline,
        outbound,
        enabled: [],
        sdkTools: undefined,
        grantedOps: new Map(),
        behaviorDigest: createHash('sha256')
            .update(stableStringify((args.tools ?? [])
            .map((tool) => ({
            name: tool.name,
            policyVersion: tool.policyVersion ?? null,
            effect: String(tool.effect),
            validate: String(tool.validate),
            resource: String(tool.resource),
            landedWrite: String(tool.landedWrite),
            execute: String(tool.execute)
        }))
            .sort((left, right) => left.name.localeCompare(right.name))))
            .digest('hex'),
        activation: {
            skillsSelected: false,
            enabledSkills: [],
            mention: null,
            loadedSkills: new Set()
        },
        inContextSkills: [],
        loadedThisTurn: new Set(),
        loadedFilesThisTurn: new Set(),
        loadedSkillFiles: new Map(),
        nudgedSkills: new Set(),
        backends: [],
        landed: runOutcomes.confirmedWrites,
        runOutcomes,
        callKey(name, callArgs) {
            const payload = stableStringify({ name, args: callArgs });
            return `call:${createHmac('sha256', callKeySecret)
                .update('qvac:completion:call:v1\0')
                .update(payload)
                .digest('hex')}`;
        },
        resultDigest(output) {
            return createHmac('sha256', callKeySecret)
                .update('qvac:completion:result:v1\0')
                .update(stableStringify(historyPayload(output)) ?? '')
                .digest('hex')
                .slice(0, 16);
        },
        skillIcon: null,
        reselectTools: null,
        preloadSystem: null,
        liveRound: null,
        writableRoots: [],
        runBudget,
        toolContext: runToolContext(args, runBudget),
        turnImages: [],
        generationParams: undefined,
        policy: Agent.policy(args.agent),
        access,
        accessDigest: access
            ? createHash('sha256').update(stableStringify(access)).digest('hex')
            : null,
        agentPorts,
        runStarted: false,
        promptParts: null,
        startedAt: now(),
        now,
        wallStart,
        ...invokes
    };
}
