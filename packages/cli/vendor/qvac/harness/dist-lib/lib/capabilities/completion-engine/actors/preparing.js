import { Agent } from '../../../agent/index.js';
import { spliceFrom } from '../splice.js';
import { AbortedError } from '../../../helpers/race-abort.js';
import { currentTimeAnnotation, lastUserContent } from '../../../prompt.js';
import { explicitWebSearchQuery, lastUserImages, modelTurns, withTurnContext } from '../turns.js';
import { HookHalt } from '../../../helpers/engine-error.js';
import { stripControlTokens } from '../../../helpers/control-tokens.js';
import { skillInContext } from '../../skill-entry.js';
import { meetsMinCapabilityProfile, modelNameToCapabilityProfile } from '../../../models/model-catalog-constants.js';
import { deferredForRun, defers, renderedTools, TOOL_SEARCH_TOOL_NAME, toSdkTools, withToolSearch } from '../../sdk-tool.js';
import { loadedSkillFilesFrom, loadedSkillsFrom } from '../../tool-turns.js';
import { promptPrefixHash } from '../../prompt-prefix.js';
import { promptUsageParts } from '../../usage-breakdown.js';
import { logToolPrompt } from '../../tool-prompt-log.js';
import { toolContext } from './execution-plan.js';
import { knowledgeSearch } from './retrieving.js';
import { detachJson } from '../../../helpers/detach-json.js';
import { GOAL_CHECKS_ASK, GOAL_PROOF_ASK } from '../../../helpers/goal-check.js';
function offeredTools(tools, model) {
    const profile = model ? modelNameToCapabilityProfile(model) : undefined;
    return tools.filter(({ minCapabilityProfile: min }) => !min || (profile !== undefined && meetsMinCapabilityProfile(profile, min)));
}
function promptForWholeTools(ports, tools) {
    const deferred = new Set(tools.filter(defers).map((tool) => tool.name));
    return {
        ...ports,
        systemPrompt: (input) => {
            const whole = input.toolNames.filter((name) => !deferred.has(name));
            const searching = whole.length < input.toolNames.length;
            return ports.systemPrompt({
                ...input,
                toolNames: searching ? [...whole, TOOL_SEARCH_TOOL_NAME] : whole
            });
        }
    };
}
function takesCommand(tools) {
    return tools.some((tool) => 'command' in tool.parameters.properties);
}
function checksAsk({ goal }, checkable) {
    if (!goal || !checkable || goal.named) {
        return [];
    }
    return [{ role: 'user', content: goal.checks.length ? GOAL_PROOF_ASK : GOAL_CHECKS_ASK }];
}
export function preparing(source) {
    return ({ input, context, reconstruct, emit }) => prepare({ input, context, reconstruct, source, emit });
}
async function prepare({ input, context, reconstruct, source, emit }) {
    const { args, session } = input;
    const { model, agent, thinkingDefault, generationParams: generationParamsOverride, responseFormat, messages: storedMessages, tools: allTools = [], skillCatalog = [], signal, fsRoots = [], fsWriteRoots = [], deferTools } = args;
    if (signal?.aborted) {
        throw new AbortedError();
    }
    const messages = modelTurns(bareTurn(storedMessages), context.policy.continuationNudge);
    const userText = args.typedText === undefined ? lastUserContent(messages) : stripControlTokens(args.typedText);
    let promptContext;
    if (!session.runStarted && !reconstruct) {
        await session.pipeline.onRunStart({
            runId: session.runId,
            agentId: agent?.id ?? null,
            messages
        });
        session.runStarted = true;
        const submitted = await session.pipeline.promptSubmit({
            runId: session.runId,
            agentId: agent?.id ?? null,
            mode: 'prompt',
            text: lastUserContent(messages)
        });
        if (!submitted.ok) {
            throw new HookHalt(submitted.rejection.error, submitted.rejection.hook);
        }
        promptContext = submitted.context;
    }
    const hits = reconstruct ? [] : await knowledgeHits(input, context, messages);
    const turnImages = lastUserImages(messages);
    const loadedSkills = new Set([...loadedSkillsFrom(messages), ...context.activated]);
    const loadedSkillFiles = loadedSkillFilesFrom(messages);
    const inContextSkills = skillCatalog.filter(skillInContext);
    const offered = offeredTools(allTools, model);
    const tools = deferTools ? offered.map(deferredForRun) : offered;
    const resolved = Agent.resolve({
        agent,
        model,
        capabilityProfile: model ? modelNameToCapabilityProfile(model) : undefined,
        thinkingDefault,
        generationParams: generationParamsOverride,
        responseFormat,
        messages,
        userText,
        tools,
        skills: inContextSkills,
        loadedSkills,
        fsRoots,
        fsWriteRoots,
        planning: context.plan.length > 0 || context.goal !== null,
        planMode: context.planMode,
        policy: session.access
    }, deferTools ? promptForWholeTools(session.agentPorts, tools) : session.agentPorts);
    const { system, activation, activeSkills, mention, grantedOps } = resolved;
    const catalog = withToolSearch(resolved.select(new Set(activeSkills.map(({ name }) => name))));
    const callable = (loaded) => {
        const names = new Set(resolved.select(loaded).map(({ name }) => name));
        return catalog.filter(({ name }) => name === TOOL_SEARCH_TOOL_NAME || names.has(name));
    };
    const enabled = callable(loadedSkills);
    const sdkTools = toSdkTools(catalog);
    const { skillsSelected } = activation;
    const sent = reconstruct ? context.history[0] : undefined;
    let systemContent = sent && 'role' in sent && sent.role === 'system' ? sent.content : system.text;
    const promptPrefix = promptPrefixHash({ system: systemContent, tools: renderedTools(sdkTools) });
    const promptParts = promptUsageParts({ system, toolSchemas: renderedTools(sdkTools) });
    const logSelection = (prefix) => {
        logToolPrompt({
            promptPrefix: prefix,
            modelId: args.modelId,
            cacheKey: context.cacheKey ?? undefined,
            agentId: agent?.id,
            messageCount: messages.length,
            responseFormat: responseFormat?.type,
            tools: session.sdkTools,
            definitions: session.enabled,
            activeSkills: activeSkills.map((skill) => skill.name),
            skillsSelected,
            enabledSkills: agent?.enabledSkills ?? [],
            mentionedSkill: mention?.name ?? null,
            loadedSkills: session.activation.loadedSkills,
            toolOps: session.grantedOps
        });
    };
    session.reselectTools = (loaded) => {
        const reselected = callable(loaded);
        const names = reselected.map((tool) => tool.name).join();
        const changed = names !== session.enabled.map((tool) => tool.name).join();
        if (changed) {
            session.enabled = reselected;
        }
        const prefix = promptPrefixHash({ system: systemContent, tools: renderedTools(sdkTools) });
        if (changed) {
            logSelection(prefix);
        }
        return prefix;
    };
    session.preloadSystem = (skill) => {
        const systemParts = resolved.systemFor(new Set([...loadedSkills, skill]));
        systemContent = systemParts.text;
        session.promptParts = promptUsageParts({
            system: systemParts,
            toolSchemas: renderedTools(sdkTools)
        });
        return systemContent;
    };
    const firstTurn = context.round === 0 && !context.directSearchDone;
    const added = addedContext(hits, promptContext);
    const sentAt = storedMessages.findLast((turn) => turn.role === 'user')?.sentAt;
    const time = currentTimeAnnotation(new Date(sentAt || session.startedAt));
    const withSystem = (turns) => systemContent ? [{ role: 'system', content: systemContent }, ...turns] : turns;
    const checks = checksAsk(context, takesCommand(enabled));
    const initialHistory = withSystem([...withTurnContext(messages, added), ...checks]);
    const history = firstTurn
        ? withSystem([...withTurnContext(messages, { time, ...added }), ...checks])
        : [...context.history];
    if (firstTurn && !reconstruct && messages.some((turn) => turn.role === 'user')) {
        emit({ type: 'context', context: { time, ...added }, round: context.round });
    }
    const sources = firstTurn
        ? hits.map((hit) => session.outbound.facts('tool-result', hit.text))
        : [...context.sources];
    const preparation = {
        history: spliceFrom(context.history, history),
        activated: [...loadedSkills],
        webSearches: context.webSearches,
        deniedKeys: [...context.deniedKeys],
        sources,
        availableTools: enabled.map((tool) => tool.name),
        promptPrefix,
        checkable: context.goal ? takesCommand(enabled) : undefined
    };
    prepareSession(session, {
        enabled,
        sdkTools,
        grantedOps,
        activation,
        inContextSkills,
        loadedSkillFiles,
        writableRoots: resolved.writableRoots,
        turnImages,
        generationParams: resolved.generationParams,
        promptParts
    });
    logSelection(promptPrefix);
    const round = { preparation, step: null, searchQuery: null };
    if (reconstruct) {
        return round;
    }
    const call = source.propose(input, resolved);
    const tool = call && enabled.find((tool) => tool.name === call.tool);
    const effect = call && tool
        ? tool.effect(detachJson(call.args), toolContext({ deps: input, context, name: tool.name }))
        : null;
    const searchQuery = (skillPreloaded) => context.directSearchDone ? null : explicitWebSearchQuery(userText, enabled, { skillPreloaded });
    return {
        ...round,
        step: call && {
            ...call,
            available: Boolean(tool),
            effect,
            history: spliceFrom(context.history, initialHistory),
            pendingSearch: searchQuery(true)
        },
        searchQuery: searchQuery(false)
    };
}
function bareTurn(messages) {
    const at = messages.findLastIndex((turn) => turn.role === 'user');
    const turn = messages[at];
    if (!turn || !('context' in turn)) {
        return messages;
    }
    const bare = { ...turn };
    delete bare.context;
    const next = [...messages];
    next[at] = bare;
    return next;
}
function addedContext(hits, notes) {
    const added = {};
    if (hits.length > 0) {
        added.excerpts = hits.map((hit) => hit.text);
    }
    if (notes !== undefined) {
        added.notes = notes;
    }
    return added;
}
function knowledgeHits(deps, context, messages) {
    if (context.round > 0 || context.directSearchDone) {
        return Promise.resolve([]);
    }
    return knowledgeSearch(deps, {
        id: `${context.runId}:round-${context.round}:prepare:knowledge`,
        text: Agent.untransferred(lastUserContent(messages))
    });
}
function prepareSession(session, prepared) {
    Object.assign(session, prepared);
}
