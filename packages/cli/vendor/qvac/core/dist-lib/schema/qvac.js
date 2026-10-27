import { registerContentTypes, versionedRegistrar } from './content.js';
export { APPROVAL_STATUSES, CHUNK_PAYLOAD_FIELDS, CHUNK_TYPES, MODEL_REQUEST_STATES, RUN_STATES, registerContentTypes } from './content.js';
import b4a from 'b4a';
export const INDEXING_STATES = ['indexing', 'ready', 'failed'];
export const CAPABILITY_PROFILES = ['tiny', 'low', 'mid', 'high', 'xhigh'];
export const APP_CHANNELS = ['dev', 'staging', 'prod'];
export const RAG_SOURCE_EXCERPT_CHARS = 280;
export const MAX_RAG_SOURCES_PER_CHUNK = 1024;
export const MAX_RAG_SOURCE_NOTICE_CHARS = 1024;
export const MAX_RAG_SOURCE_URL_CHARS = 2048;
export function ragSourcesWithinBounds(content) {
    if (!content || content.sources.length > MAX_RAG_SOURCES_PER_CHUNK) {
        return false;
    }
    if ((content.notice?.length ?? 0) > MAX_RAG_SOURCE_NOTICE_CHARS)
        return false;
    return content.sources.every((source) => source.excerpt.length <= RAG_SOURCE_EXCERPT_CHARS &&
        (source.url?.length ?? 0) <= MAX_RAG_SOURCE_URL_CHARS);
}
export const MAX_TOOL_CONFIGS_BYTES = 16 * 1024;
export function toolConfigsWithinBounds(settings) {
    return b4a.byteLength(JSON.stringify(settings ?? {}), 'utf8') <= MAX_TOOL_CONFIGS_BYTES;
}
export const MAX_TOOL_ACTIVITY_ARGS_BYTES = 8 * 1024;
export function capToolActivityArguments(args) {
    if (args === undefined || args === null)
        return args;
    let encoded;
    try {
        encoded = JSON.stringify(args);
    }
    catch {
        return { truncated: true };
    }
    if (encoded === undefined) {
        return null;
    }
    if (b4a.byteLength(encoded, 'utf8') <= MAX_TOOL_ACTIVITY_ARGS_BYTES) {
        return args;
    }
    return { truncated: true };
}
export const MAX_DEVICE_NAME_CHARS = 100;
export function deviceNameWithinBounds(name) {
    return name.length <= MAX_DEVICE_NAME_CHARS;
}
export function capDeviceName(name) {
    return name.length <= MAX_DEVICE_NAME_CHARS ? name : name.slice(0, MAX_DEVICE_NAME_CHARS);
}
export const MAX_MESH_NAME_CHARS = 100;
export function meshNameWithinBounds(name) {
    return name.length <= MAX_MESH_NAME_CHARS;
}
export const MAX_PROJECT_ORDER_IDS = 500;
export function registerQvacTypes(ns) {
    const versioned = versionedRegistrar(ns, 'qvac');
    registerContentTypes(ns, 'qvac');
    versioned('chunk', [
        { name: 'id', type: 'string', required: true },
        { name: 'chatId', type: 'string', required: true },
        { name: 'runId', type: 'string' },
        { name: 'type', type: '@qvac/chunk-type', required: true },
        { name: 'seq', type: 'uint', required: true },
        { name: 'originDeviceId', type: 'fixed32', required: true },
        { name: 'createdAt', type: 'uint', required: true },
        { name: 'updatedAt', type: 'uint' },
        { name: 'userMessage', type: '@qvac/chunk-content-user-message' },
        { name: 'content', type: '@qvac/chunk-content-assistant' },
        { name: 'thinking', type: '@qvac/chunk-content-thinking' },
        { name: 'toolCall', type: '@qvac/chunk-content-tool-call' },
        { name: 'toolResult', type: '@qvac/chunk-content-tool-result' },
        { name: 'attachment', type: '@qvac/chunk-content-attachment' },
        { name: 'approvalRequest', type: '@qvac/chunk-content-approval-request' },
        { name: 'runStatus', type: '@qvac/chunk-content-run-status' },
        { name: 'runRequest', type: '@qvac/chunk-content-run-request' },
        { name: 'sources', type: '@qvac/chunk-content-sources' },
        { name: 'parentId', type: 'string' },
        { name: 'effect', type: 'string' },
        { name: 'intent', type: 'string' },
        { name: 'display', type: 'json' },
        { name: 'rawCall', type: 'string' },
        { name: 'compaction', type: '@qvac/chunk-content-compaction' },
        { name: 'senderMemberId', type: 'fixed32' },
        { name: 'capability', type: 'string' },
        { name: 'capabilityArgs', type: 'json' },
        { name: 'enhance', type: '@qvac/enhance-mode' },
        { name: 'sourceId', type: 'string' },
        { name: 'requesterMemberId', type: 'fixed32' },
        { name: 'senderNameAtSend', type: 'string' },
        { name: 'context', type: '@qvac/chunk-content-context' },
        { name: 'modelRequest', type: '@qvac/chunk-content-model-request' },
        { name: 'round', type: 'uint' },
        { name: 'callId', type: 'string' },
        { name: 'resumed', type: 'bool' },
        { name: 'roundReset', type: '@qvac/chunk-content-round-reset' },
        { name: 'agentSwitch', type: '@qvac/chunk-content-agent-switch' },
        { name: 'runnerDeviceId', type: 'fixed32' },
        { name: 'runTakenBy', type: 'fixed32' },
        { name: 'runTakenAt', type: 'uint' }
    ]);
    versioned('chunk-counter', [
        { name: 'chatId', type: 'string', required: true },
        { name: 'count', type: 'uint', required: true },
        { name: 'lastActivityAt', type: 'uint' }
    ]);
    versioned('append-chunk-operation', [
        { name: 'id', type: 'string', required: true },
        { name: 'chatId', type: 'string', required: true },
        { name: 'runId', type: 'string' },
        { name: 'type', type: '@qvac/chunk-type', required: true },
        { name: 'originDeviceId', type: 'fixed32', required: true },
        { name: 'createdAt', type: 'uint', required: true },
        { name: 'userMessage', type: '@qvac/chunk-content-user-message' },
        { name: 'content', type: '@qvac/chunk-content-assistant' },
        { name: 'thinking', type: '@qvac/chunk-content-thinking' },
        { name: 'toolCall', type: '@qvac/chunk-content-tool-call' },
        { name: 'toolResult', type: '@qvac/chunk-content-tool-result' },
        { name: 'attachment', type: '@qvac/chunk-content-attachment' },
        { name: 'approvalRequest', type: '@qvac/chunk-content-approval-request' },
        { name: 'runStatus', type: '@qvac/chunk-content-run-status' },
        { name: 'runRequest', type: '@qvac/chunk-content-run-request' },
        { name: 'sources', type: '@qvac/chunk-content-sources' },
        { name: 'parentId', type: 'string' },
        { name: 'effect', type: 'string' },
        { name: 'intent', type: 'string' },
        { name: 'display', type: 'json' },
        { name: 'rawCall', type: 'string' },
        { name: 'compaction', type: '@qvac/chunk-content-compaction' },
        { name: 'senderMemberId', type: 'fixed32' },
        { name: 'capability', type: 'string' },
        { name: 'capabilityArgs', type: 'json' },
        { name: 'enhance', type: '@qvac/enhance-mode' },
        { name: 'sourceId', type: 'string' },
        { name: 'senderNameAtSend', type: 'string' },
        { name: 'context', type: '@qvac/chunk-content-context' },
        { name: 'modelRequest', type: '@qvac/chunk-content-model-request' },
        { name: 'round', type: 'uint' },
        { name: 'callId', type: 'string' },
        { name: 'resumed', type: 'bool' },
        { name: 'roundReset', type: '@qvac/chunk-content-round-reset' },
        { name: 'agentSwitch', type: '@qvac/chunk-content-agent-switch' },
        { name: 'runnerDeviceId', type: 'fixed32' }
    ]);
    versioned('update-chunk-operation', [
        { name: 'id', type: 'string', required: true },
        { name: 'updatedAt', type: 'uint', required: true },
        { name: 'runStatus', type: '@qvac/chunk-content-run-status' },
        { name: 'attachment', type: '@qvac/chunk-content-attachment' }
    ]);
    versioned('resolve-approval-operation', [
        { name: 'id', type: 'string', required: true },
        { name: 'approved', type: 'bool', required: true },
        { name: 'resolvedAt', type: 'uint', required: true }
    ]);
    ns.register({ name: 'agent-reasoning', enum: ['inherit', 'enabled', 'disabled'], strings: true });
    ns.register({
        name: 'capability-profile',
        enum: CAPABILITY_PROFILES,
        strings: true
    });
    ns.register({ name: 'app-channel', enum: APP_CHANNELS, strings: true });
    ns.register({ name: 'image-model-choice', enum: ['sd2', 'sdxl', 'flux2-klein'], strings: true });
    ns.register({
        name: 'agent-icon-name',
        enum: [
            'artificial-intelligence',
            'code',
            'work',
            'calendar',
            'home',
            'shield',
            'bar-chart',
            'email',
            'auto-stories',
            'person',
            'heart'
        ],
        strings: true
    });
    ns.register({ name: 'tools-access-scope', enum: ['all', 'selected'], strings: true });
    ns.register({ name: 'skills-access-scope', enum: ['all', 'selected'], strings: true });
    ns.register({ name: 'approval-mode', enum: ['ask', 'skip-all'], strings: true });
    versioned('agent', [
        { name: 'id', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'bio', type: 'string', required: true },
        { name: 'providerDeviceId', type: 'fixed32', required: true },
        { name: 'modelName', type: 'string', required: true },
        { name: 'reasoning', type: '@qvac/agent-reasoning', required: true },
        { name: 'enabledSkills', type: 'string', array: true },
        { name: 'enabledTools', type: 'string', array: true },
        { name: 'installedSkills', type: 'string', array: true },
        { name: 'isDefault', type: 'bool' },
        { name: 'createdAt', type: 'uint', required: true },
        { name: 'updatedAt', type: 'uint', required: true },
        { name: 'deletedAt', type: 'uint' },
        { name: 'imageModelChoice', type: '@qvac/image-model-choice' },
        { name: 'kvCacheK', type: 'string' },
        { name: 'kvCacheV', type: 'string' },
        { name: 'iconName', type: '@qvac/agent-icon-name' },
        { name: 'ctxSize', type: 'uint' },
        { name: 'toolsScope', type: '@qvac/tools-access-scope' },
        { name: 'skillsScope', type: '@qvac/skills-access-scope' },
        { name: 'imageSteps', type: 'uint' },
        { name: 'imageWidth', type: 'uint' },
        { name: 'imageHeight', type: 'uint' },
        { name: 'approvalMode', type: '@qvac/approval-mode' },
        { name: 'disabledToolsets', type: 'string', array: true },
        { name: 'lenderDeviceId', type: 'fixed32' },
        { name: 'sharedIn', type: 'fixed32' }
    ]);
    ns.register({
        name: 'chat-fork-source',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'chatId', type: 'string', required: true },
            { name: 'runId', type: 'string' }
        ]
    });
    ns.register({
        name: 'chat-suggestion',
        fields: [
            { name: 'text', type: 'string', required: true },
            { name: 'runId', type: 'string', required: true }
        ]
    });
    versioned('chat', [
        { name: 'id', type: 'string', required: true },
        { name: 'agentId', type: 'string', required: true },
        { name: 'title', type: 'string', required: true },
        { name: 'createdAt', type: 'uint', required: true },
        { name: 'deletedAt', type: 'uint' },
        { name: 'ragEnabled', type: 'bool' },
        { name: 'webSearchEnabled', type: 'bool' },
        { name: 'updatedAt', type: 'uint' },
        { name: 'groupId', type: 'string' },
        { name: 'rank', type: 'float64' },
        { name: 'rankedAt', type: 'uint' },
        { name: 'readThrough', type: 'uint' },
        { name: 'forkedFrom', type: '@qvac/chat-fork-source' },
        { name: 'projectId', type: 'string' },
        { name: 'knowledgeSourcesOff', type: 'string', array: true },
        { name: 'suggestion', type: '@qvac/chat-suggestion' }
    ]);
    ns.register({
        name: 'tool-report-entry',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'promptChars', type: 'uint', required: true },
            { name: 'toolset', type: 'string' },
            { name: 'skillGated', type: 'bool' },
            { name: 'scopeRequired', type: 'bool' },
            { name: 'rootsRequired', type: 'bool' },
            { name: 'writeRootsRequired', type: 'bool' }
        ]
    });
    versioned('device', [
        { name: 'id', type: 'fixed32', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'joinedAt', type: 'uint', required: true },
        { name: 'capabilityProfile', type: '@qvac/capability-profile', required: true },
        { name: 'recommendedModelName', type: 'string', required: true },
        { name: 'revoked', type: 'bool' },
        { name: 'revokedAt', type: 'uint' },
        { name: 'writerKey', type: 'buffer' },
        { name: 'installedToolNames', type: 'string', array: true },
        { name: 'installedSkillNames', type: 'string', array: true },
        { name: 'installedModelNames', type: 'string', array: true },
        { name: 'cachedModelNames', type: 'string', array: true },
        { name: 'revokedBy', type: 'buffer' },
        { name: 'appVersion', type: 'string' },
        { name: 'appBuild', type: 'string' },
        { name: 'appChannel', type: '@qvac/app-channel' },
        { name: 'platform', type: 'string' },
        { name: 'readySkillNames', type: 'string', array: true },
        { name: 'toolCatalog', type: '@qvac/tool-report-entry', array: true },
        { name: 'memberId', type: 'fixed32' },
        { name: 'memberProof', type: 'buffer' },
        { name: 'attestedAt', type: 'uint' },
        { name: 'claimedMemberId', type: 'fixed32' },
        { name: 'inviteToken', type: 'fixed32' },
        { name: 'deviceSignature', type: 'buffer' }
    ]);
    versioned('writer', [
        { name: 'writerKey', type: 'buffer', required: true },
        { name: 'device', type: '@qvac/device' },
        { name: 'deviceSignature', type: 'buffer' }
    ]);
    versioned('remove-writer-operation', [
        { name: 'writerKey', type: 'buffer', required: true },
        { name: 'deviceId', type: 'fixed32' },
        { name: 'revokedAt', type: 'uint' }
    ]);
    versioned('remove-member-operation', [
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'revokedAt', type: 'uint' }
    ]);
    versioned('writer-claim', [
        { name: 'signature', type: 'buffer', required: true },
        { name: 'device', type: '@qvac/device' },
        { name: 'deviceId', type: 'fixed32' },
        { name: 'claimedMemberId', type: 'fixed32' },
        { name: 'inviteToken', type: 'fixed32' },
        { name: 'deviceSignature', type: 'buffer' }
    ]);
    versioned('vouched-join', [
        { name: 'signature', type: 'buffer', required: true },
        { name: 'device', type: '@qvac/device' },
        { name: 'deviceId', type: 'fixed32' },
        { name: 'deviceSignature', type: 'buffer' },
        { name: 'writerKey', type: 'fixed32' },
        { name: 'memberProof', type: 'buffer' },
        { name: 'memberSignature', type: 'buffer' }
    ]);
    versioned('register-device-operation', [{ name: 'device', type: '@qvac/device', required: true }]);
    versioned('update-device-operation', [{ name: 'device', type: '@qvac/device', required: true }]);
    versioned('report-device-capabilities-operation', [
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'installedToolNames', type: 'string', array: true },
        { name: 'installedSkillNames', type: 'string', array: true },
        { name: 'installedModelNames', type: 'string', array: true },
        { name: 'cachedModelNames', type: 'string', array: true },
        { name: 'readySkillNames', type: 'string', array: true },
        { name: 'toolCatalog', type: '@qvac/tool-report-entry', array: true }
    ]);
    versioned('put-agent-operation', [{ name: 'agent', type: '@qvac/agent', required: true }]);
    versioned('put-chat-operation', [{ name: 'chat', type: '@qvac/chat', required: true }]);
    ns.register({ name: 'approval-decision', enum: ['allow', 'deny'], strings: true });
    versioned('approval-rule', [
        { name: 'id', type: 'string', required: true },
        { name: 'toolName', type: 'string' },
        { name: 'resourceKind', type: 'string' },
        { name: 'resourcePattern', type: 'string' },
        { name: 'decision', type: '@qvac/approval-decision', required: true },
        { name: 'createdAt', type: 'uint', required: true },
        { name: 'updatedAt', type: 'uint', required: true },
        { name: 'expiresAt', type: 'uint' },
        { name: 'agentId', type: 'string' },
        { name: 'effect', type: 'string' },
        { name: 'memberId', type: 'fixed32' }
    ]);
    versioned('put-approval-rule-operation', [
        { name: 'rule', type: '@qvac/approval-rule', required: true }
    ]);
    versioned('mesh-blind-peer', [{ name: 'key', type: 'buffer', required: true }]);
    ns.register({
        name: 'autobee-head',
        fields: [
            { name: 'key', type: 'fixed32', required: true },
            { name: 'length', type: 'uint', required: true }
        ]
    });
    versioned('mesh-invite', [
        { name: 'meshKey', type: 'fixed32', required: true },
        { name: 'seed', type: 'fixed32', required: true },
        { name: 'fastForward', type: '@qvac/autobee-head' },
        { name: 'additionalNodes', type: 'ipv4Address', array: true },
        { name: 'blindPeers', type: 'fixed32', array: true },
        { name: 'memberInvite', type: 'bool' },
        { name: 'memberId', type: 'fixed32' },
        { name: 'inviteNonce', type: 'fixed32' },
        { name: 'compute', type: 'bool' },
        { name: 'inviterName', type: 'string' },
        { name: 'deviceSeed', type: 'fixed32' },
        { name: 'deviceProof', type: 'buffer' },
        { name: 'workspace', type: 'bool' },
        { name: 'workspaceName', type: 'string' }
    ]);
    versioned('seed-defaults-operation', [
        { name: 'agent', type: '@qvac/agent', required: true },
        { name: 'chat', type: '@qvac/chat', required: true },
        { name: 'blindPeers', type: '@qvac/mesh-blind-peer', array: true }
    ]);
    const knowledge = (chatId) => [
        { name: 'id', type: 'string', required: true },
        { name: 'chatId', type: 'string', required: chatId },
        { name: 'fileName', type: 'string', required: true },
        { name: 'mimeType', type: 'string', required: true },
        { name: 'byteLength', type: 'uint', required: true },
        { name: 'blobId', type: 'string', required: true },
        { name: 'createdAt', type: 'uint', required: true },
        { name: 'updatedAt', type: 'uint', required: true },
        { name: 'deletedAt', type: 'uint' }
    ];
    versioned('knowledge', knowledge(true), [
        ...knowledge(false),
        { name: 'deletedBy', type: 'fixed32' }
    ]);
    versioned('add-knowledge-operation', [
        { name: 'knowledge', type: '@qvac/knowledge', required: true }
    ]);
    versioned('remove-knowledge-operation', [
        { name: 'knowledgeId', type: 'string', required: true },
        { name: 'at', type: 'uint', required: true }
    ]);
    versioned('knowledge-artifact', [
        { name: 'id', type: 'string', required: true },
        { name: 'knowledgeId', type: 'string', required: true },
        { name: 'sourceHash', type: 'string', required: true },
        { name: 'embedderVersion', type: 'string', required: true },
        { name: 'dimensions', type: 'uint', required: true },
        { name: 'artifactBlobId', type: 'string', required: true },
        { name: 'createdAt', type: 'uint', required: true }
    ]);
    versioned('add-knowledge-artifact-operation', [
        { name: 'artifact', type: '@qvac/knowledge-artifact', required: true }
    ]);
    ns.register({ name: 'indexing-state', enum: INDEXING_STATES, strings: true });
    ns.register({ name: 'indexing-resolution', enum: ['ready', 'failed'], strings: true });
    const indexingStatus = (chatId) => [
        { name: 'id', type: 'string', required: true },
        { name: 'knowledgeId', type: 'string', required: true },
        { name: 'chatId', type: 'string', required: chatId },
        { name: 'status', type: '@qvac/indexing-state', required: true },
        { name: 'claimId', type: 'string', required: true },
        { name: 'claimedBy', type: 'buffer', required: true },
        { name: 'at', type: 'uint', required: true },
        { name: 'expiresAt', type: 'uint', required: true },
        { name: 'error', type: 'string' }
    ];
    versioned('indexing-status', indexingStatus(true), indexingStatus(false));
    versioned('claim-indexing-operation', [
        { name: 'id', type: 'string', required: true },
        { name: 'knowledgeId', type: 'string', required: true },
        { name: 'claimId', type: 'string', required: true },
        { name: 'at', type: 'uint', required: true }
    ]);
    versioned('resolve-indexing-operation', [
        { name: 'id', type: 'string', required: true },
        { name: 'claimId', type: 'string', required: true },
        { name: 'status', type: '@qvac/indexing-resolution', required: true },
        { name: 'error', type: 'string' }
    ]);
    versioned('update-device-profile-operation', [
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'capabilityProfile', type: '@qvac/capability-profile', required: true },
        { name: 'recommendedModelName', type: 'string', required: true },
        { name: 'platform', type: 'string' }
    ]);
    versioned('report-device-version-operation', [
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'appVersion', type: 'string', required: true },
        { name: 'appBuild', type: 'string' },
        { name: 'appChannel', type: '@qvac/app-channel', required: true }
    ]);
    versioned('tool-configs', [
        { name: 'agentId', type: 'string', required: true },
        { name: 'toolName', type: 'string', required: true },
        { name: 'settings', type: 'json', required: true },
        { name: 'createdAt', type: 'uint', required: true },
        { name: 'updatedAt', type: 'uint', required: true },
        { name: 'deletedAt', type: 'uint' }
    ]);
    versioned('put-tool-configs-operation', [
        { name: 'settings', type: '@qvac/tool-configs', required: true }
    ]);
    ns.register({
        name: 'tool-decision',
        enum: ['auto', 'allowed', 'denied', 'skip-all', 'blocked'],
        strings: true
    });
    versioned('tool-activity', [
        { name: 'id', type: 'string', required: true },
        { name: 'agentId', type: 'string', required: true },
        { name: 'originDeviceId', type: 'fixed32', required: true },
        { name: 'chatId', type: 'string' },
        { name: 'runId', type: 'string' },
        { name: 'toolName', type: 'string', required: true },
        { name: 'arguments', type: 'json' },
        { name: 'resource', type: '@qvac/resource-descriptor' },
        { name: 'effect', type: 'string' },
        { name: 'decision', type: '@qvac/tool-decision', required: true },
        { name: 'at', type: 'uint', required: true },
        { name: 'seq', type: 'uint', required: true }
    ]);
    versioned('append-tool-activity-operation', [
        { name: 'activity', type: '@qvac/tool-activity', required: true }
    ]);
    versioned('tool-activity-counter', [
        { name: 'agentId', type: 'string', required: true },
        { name: 'count', type: 'uint', required: true }
    ]);
    versioned('writer-activity', [
        { name: 'writerKey', type: 'fixed32', required: true },
        { name: 'length', type: 'uint', required: true },
        { name: 'clock', type: 'uint', required: true },
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'revoked', type: 'bool' }
    ]);
    versioned('device-attestation', [
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'signature', type: 'buffer', required: true }
    ]);
    versioned('member', [
        { name: 'id', type: 'fixed32', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'joinedAt', type: 'uint', required: true },
        { name: 'updatedAt', type: 'uint', required: true }
    ]);
    versioned('mint-member-operation', [
        { name: 'member', type: '@qvac/member', required: true },
        { name: 'proof', type: 'buffer', required: true }
    ]);
    versioned('update-member-operation', [{ name: 'member', type: '@qvac/member', required: true }]);
    versioned('join-member-operation', [
        { name: 'member', type: '@qvac/member', required: true },
        { name: 'proof', type: 'buffer', required: true }
    ]);
    versioned('attest-member-device-operation', [
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'proof', type: 'buffer', required: true },
        { name: 'attestedAt', type: 'uint', required: true }
    ]);
    versioned('chat-group', [
        { name: 'id', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'createdAt', type: 'uint', required: true },
        { name: 'updatedAt', type: 'uint', required: true },
        { name: 'deletedAt', type: 'uint' },
        { name: 'rank', type: 'float64' }
    ]);
    versioned('put-chat-group-operation', [
        { name: 'group', type: '@qvac/chat-group', required: true }
    ]);
    versioned('joined-mesh', [
        { name: 'meshKey', type: 'fixed32', required: true },
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'joinedAt', type: 'uint', required: true },
        { name: 'leftAt', type: 'uint' },
        { name: 'label', type: 'string' },
        { name: 'labeledAt', type: 'uint' },
        { name: 'shared', type: 'bool' },
        { name: 'sharedAt', type: 'uint' },
        { name: 'workspace', type: 'bool' }
    ]);
    versioned('put-joined-mesh-operation', [
        { name: 'room', type: '@qvac/joined-mesh', required: true }
    ]);
    versioned('reindex-agents-operation', [{ name: 'agentIds', type: 'string', array: true }]);
    versioned('mesh-invite-grant', [
        { name: 'grantKey', type: 'fixed32', required: true },
        { name: 'kind', type: 'string' },
        { name: 'issuerDeviceId', type: 'fixed32' },
        { name: 'issuerMemberId', type: 'fixed32' },
        { name: 'issuedAt', type: 'uint' },
        { name: 'expiresAt', type: 'uint' },
        { name: 'maxUses', type: 'uint' },
        { name: 'uses', type: 'uint' },
        { name: 'revokedAt', type: 'uint' },
        { name: 'revokedBy', type: 'buffer' },
        { name: 'updatedAt', type: 'uint' },
        { name: 'sequence', type: 'uint' }
    ]);
    versioned('mesh-invite-spend', [
        { name: 'grantKey', type: 'fixed32', required: true },
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'spentAt', type: 'uint' }
    ]);
    versioned('put-mesh-invite-grant-operation', [
        { name: 'grant', type: '@qvac/mesh-invite-grant', required: true }
    ]);
    versioned('invite-claim', [
        { name: 'signature', type: 'buffer', required: true },
        { name: 'device', type: '@qvac/device' },
        { name: 'deviceId', type: 'fixed32' },
        { name: 'claimedMemberId', type: 'fixed32' },
        { name: 'inviteToken', type: 'fixed32' },
        { name: 'deviceSignature', type: 'buffer' },
        { name: 'grantKey', type: 'fixed32', required: true },
        { name: 'inviteSignature', type: 'buffer', required: true },
        { name: 'member', type: '@qvac/member' },
        { name: 'memberClaim', type: 'buffer' }
    ]);
    versioned('mesh-kind', [
        { name: 'id', type: 'string', required: true },
        { name: 'kind', type: 'string', required: true }
    ]);
    versioned('reindex-devices-operation', []);
    versioned('index-backfill', [{ name: 'index', type: 'string', required: true }]);
    versioned('invite-sequence', [
        { name: 'id', type: 'string', required: true },
        { name: 'value', type: 'uint', required: true }
    ]);
    versioned('member-removal', [
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'grantSequence', type: 'uint', required: true }
    ]);
    versioned('recovery-claim', [
        { name: 'signature', type: 'buffer', required: true },
        { name: 'device', type: '@qvac/device', required: true },
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'deviceSignature', type: 'buffer' },
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'proof', type: 'buffer', required: true }
    ]);
    versioned('mesh-founder', [
        { name: 'id', type: 'string', required: true },
        { name: 'memberId', type: 'fixed32', required: true }
    ]);
    versioned('purged-chat', [
        { name: 'chatId', type: 'string', required: true },
        { name: 'at', type: 'uint', required: true }
    ]);
    versioned('purge-chat-operation', [
        { name: 'chatId', type: 'string', required: true },
        { name: 'at', type: 'uint', required: true }
    ]);
    versioned('mesh-name', [
        { name: 'id', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'namedAt', type: 'uint', required: true },
        { name: 'namedBy', type: 'fixed32' }
    ]);
    versioned('name-mesh-operation', [
        { name: 'name', type: 'string', required: true },
        { name: 'namedAt', type: 'uint', required: true }
    ]);
    versioned('open-join', [
        { name: 'signature', type: 'buffer', required: true },
        { name: 'device', type: '@qvac/device' },
        { name: 'deviceId', type: 'fixed32' },
        { name: 'deviceSignature', type: 'buffer' },
        { name: 'member', type: '@qvac/member' },
        { name: 'memberClaim', type: 'buffer' }
    ]);
    versioned('mesh-seed', [
        { name: 'meshKey', type: 'fixed32', required: true },
        { name: 'seed', type: 'fixed32', required: true }
    ]);
    versioned('mesh-rules', [
        { name: 'id', type: 'string', required: true },
        { name: 'rules', type: 'uint', required: true },
        { name: 'atGenesis', type: 'bool' }
    ]);
    versioned('raise-mesh-rules-operation', [{ name: 'rules', type: 'uint', required: true }]);
    versioned('public-mesh', [
        { name: 'id', type: 'string', required: true },
        { name: 'meshKey', type: 'fixed32', required: true }
    ]);
    versioned('workspace', [
        { name: 'id', type: 'string', required: true },
        { name: 'icon', type: 'string' },
        { name: 'updatedAt', type: 'uint', required: true },
        { name: 'upgradeMemberIds', type: 'fixed32', array: true }
    ]);
    versioned('put-workspace-operation', [
        { name: 'workspace', type: '@qvac/workspace', required: true }
    ]);
    versioned('member-role', [
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'role', type: 'string', required: true }
    ]);
    versioned('public-seed', [
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'publicMeshKey', type: 'fixed32', required: true },
        { name: 'sealedSeed', type: 'buffer', required: true }
    ]);
    versioned('project', [
        { name: 'id', type: 'fixed32', required: true },
        { name: 'memberIds', type: 'fixed32', array: true },
        { name: 'createdAt', type: 'uint', required: true },
        { name: 'updatedAt', type: 'uint', required: true },
        { name: 'createdBy', type: 'fixed32' },
        { name: 'deletedAt', type: 'uint' },
        { name: 'groupId', type: 'string' }
    ]);
    versioned('put-project-operation', [{ name: 'project', type: '@qvac/project', required: true }]);
    versioned('set-project-listing-operation', [
        { name: 'projectId', type: 'fixed32', required: true },
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'removed', type: 'bool' },
        { name: 'removedAt', type: 'uint' }
    ]);
    versioned('project-member', [
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'addedAt', type: 'uint' }
    ]);
    versioned('project-order', [
        { name: 'workspaceKey', type: 'fixed32', required: true },
        { name: 'projectIds', type: 'string', array: true },
        { name: 'orderedAt', type: 'uint', required: true }
    ]);
    versioned('retry-indexing-operation', [
        { name: 'knowledgeId', type: 'string', required: true },
        { name: 'at', type: 'uint', required: true }
    ]);
    versioned('progress-indexing-operation', [
        { name: 'id', type: 'string', required: true },
        { name: 'claimId', type: 'string', required: true },
        { name: 'at', type: 'uint', required: true }
    ]);
    versioned('chat-read', [
        { name: 'chatId', type: 'string', required: true },
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'readThrough', type: 'uint', required: true }
    ]);
    versioned('delete-project-operation', [{ name: 'projectId', type: 'fixed32', required: true }]);
    versioned('knowledge-cap', [
        { name: 'id', type: 'string', required: true },
        { name: 'bytes', type: 'uint', required: true },
        { name: 'setAt', type: 'uint', required: true },
        { name: 'setBy', type: 'fixed32' }
    ]);
    versioned('set-knowledge-cap-operation', [
        { name: 'bytes', type: 'uint', required: true },
        { name: 'setAt', type: 'uint', required: true }
    ]);
    versioned('upgrade-to-workspace-operation', [
        { name: 'upgradedAt', type: 'uint', required: true }
    ]);
    versioned('model-request-operation', [
        { name: 'id', type: 'string', required: true },
        { name: 'at', type: 'uint', required: true }
    ]);
    versioned('take-run-request-operation', [
        { name: 'id', type: 'string', required: true },
        { name: 'at', type: 'uint', required: true }
    ]);
    versioned('settle-model-request-operation', [
        { name: 'id', type: 'string', required: true },
        { name: 'state', type: '@qvac/model-request-state', required: true },
        { name: 'result', type: 'json' },
        { name: 'reason', type: 'string' },
        { name: 'at', type: 'uint', required: true }
    ]);
    versioned('agent-host', [
        { name: 'writerKey', type: 'fixed32', required: true },
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'agentId', type: 'string', required: true }
    ]);
    versioned('agent-user', [
        { name: 'agentId', type: 'string', required: true },
        { name: 'userId', type: 'fixed32', required: true },
        { name: 'project', type: 'bool' }
    ]);
    versioned('put-agent-user-operation', [
        { name: 'agentId', type: 'string', required: true },
        { name: 'memberId', type: 'fixed32' },
        { name: 'projectId', type: 'fixed32' },
        { name: 'removed', type: 'bool' }
    ]);
    versioned('member-key', [
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'boxKey', type: 'fixed32', required: true }
    ]);
    versioned('project-key', [
        { name: 'projectId', type: 'fixed32', required: true },
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'boxKey', type: 'fixed32', required: true },
        { name: 'sealedSeed', type: 'buffer', required: true }
    ]);
    versioned('project-host-key', [
        { name: 'projectId', type: 'fixed32', required: true },
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'agentId', type: 'string', required: true },
        { name: 'sealedSeed', type: 'buffer', required: true }
    ]);
    versioned('agent-join', [
        { name: 'agentId', type: 'string', required: true },
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'at', type: 'uint', required: true },
        { name: 'deviceSignature', type: 'buffer', required: true },
        { name: 'signature', type: 'buffer', required: true }
    ]);
    versioned('skill-secret', [
        { name: 'key', type: 'string', required: true },
        { name: 'sealed', type: 'buffer', required: true },
        { name: 'updatedAt', type: 'uint', required: true }
    ]);
    versioned('project-device-key', [
        { name: 'projectId', type: 'fixed32', required: true },
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'sealedSeed', type: 'buffer', required: true }
    ]);
}
export function registerQvacCollections(dbns, helpersPath) {
    dbns.require(helpersPath);
    dbns.collections.register({ name: 'chunks', schema: '@qvac/chunk', key: ['id'] });
    dbns.collections.register({
        name: 'chunk-counters',
        schema: '@qvac/chunk-counter',
        key: ['chatId']
    });
    dbns.collections.register({ name: 'agents', schema: '@qvac/agent', key: ['id'] });
    dbns.collections.register({
        name: 'approval-rules',
        schema: '@qvac/approval-rule',
        key: ['id']
    });
    dbns.collections.register({ name: 'chats', schema: '@qvac/chat', key: ['id'] });
    dbns.collections.register({ name: 'devices', schema: '@qvac/device', key: ['id'] });
    dbns.collections.register({
        name: 'mesh-blind-peers',
        schema: '@qvac/mesh-blind-peer',
        key: ['key']
    });
    dbns.collections.register({ name: 'knowledge', schema: '@qvac/knowledge', key: ['id'] });
    dbns.collections.register({
        name: 'knowledge-artifacts',
        schema: '@qvac/knowledge-artifact',
        key: ['id']
    });
    dbns.collections.register({
        name: 'indexing-status',
        schema: '@qvac/indexing-status',
        key: ['id']
    });
    dbns.collections.register({
        name: 'tool-configs',
        schema: '@qvac/tool-configs',
        key: ['agentId', 'toolName']
    });
    dbns.collections.register({
        name: 'tool-activity',
        schema: '@qvac/tool-activity',
        key: ['id']
    });
    dbns.collections.register({
        name: 'tool-activity-counter',
        schema: '@qvac/tool-activity-counter',
        key: ['agentId']
    });
    dbns.indexes.register({
        name: 'chunks-by-chat',
        collection: '@qvac/chunks',
        unique: false,
        key: ['chatId', 'seq']
    });
    dbns.indexes.register({
        name: 'chunks-by-type',
        collection: '@qvac/chunks',
        unique: false,
        key: {
            type: {
                fields: [
                    { name: 'chatId', type: 'string' },
                    { name: 'type', type: 'uint' },
                    { name: 'seq', type: 'uint' }
                ]
            },
            map: 'chunksByTypeMap'
        }
    });
    dbns.indexes.register({
        name: 'run-requests',
        collection: '@qvac/chunks',
        unique: false,
        key: {
            type: {
                fields: [
                    { name: 'chatId', type: 'string' },
                    { name: 'seq', type: 'uint' }
                ]
            },
            map: 'runRequestsMap'
        }
    });
    dbns.indexes.register({
        name: 'active-agents',
        collection: '@qvac/agents',
        unique: false,
        key: {
            type: { fields: [{ name: 'createdAt', type: 'uint' }] },
            map: 'activeAgentsMap'
        }
    });
    dbns.indexes.register({
        name: 'active-chats',
        collection: '@qvac/chats',
        unique: false,
        key: {
            type: { fields: [{ name: 'createdAt', type: 'uint' }] },
            map: 'activeChatsMap'
        }
    });
    dbns.indexes.register({
        name: 'active-chats-by-agent',
        collection: '@qvac/chats',
        unique: false,
        key: {
            type: {
                fields: [
                    { name: 'agentId', type: 'string' },
                    { name: 'createdAt', type: 'uint' }
                ]
            },
            map: 'activeChatsByAgentMap'
        }
    });
    dbns.indexes.register({
        name: 'knowledge-by-chat',
        collection: '@qvac/knowledge',
        unique: false,
        key: ['chatId']
    });
    dbns.indexes.register({
        name: 'knowledge-artifacts-by-knowledge',
        collection: '@qvac/knowledge-artifacts',
        unique: false,
        key: ['knowledgeId']
    });
    dbns.indexes.register({
        name: 'indexing-status-by-knowledge',
        collection: '@qvac/indexing-status',
        unique: false,
        key: ['knowledgeId']
    });
    dbns.indexes.register({
        name: 'history-chunks',
        collection: '@qvac/chunks',
        unique: false,
        key: {
            type: {
                fields: [
                    { name: 'chatId', type: 'string' },
                    { name: 'seq', type: 'uint' }
                ]
            },
            map: 'historyChunksMap'
        }
    });
    dbns.indexes.register({
        name: 'indexing-status-by-chat',
        collection: '@qvac/indexing-status',
        unique: false,
        key: ['chatId']
    });
    dbns.indexes.register({
        name: 'active-knowledge-by-chat',
        collection: '@qvac/knowledge',
        unique: false,
        key: {
            type: { fields: [{ name: 'chatId', type: 'string' }] },
            map: 'activeKnowledgeByChatMap'
        }
    });
    dbns.indexes.register({
        name: 'active-tool-configs-by-agent',
        collection: '@qvac/tool-configs',
        unique: false,
        key: {
            type: { fields: [{ name: 'agentId', type: 'string' }] },
            map: 'activeToolConfigsByAgentMap'
        }
    });
    dbns.indexes.register({
        name: 'attachments-by-media-kind',
        collection: '@qvac/chunks',
        unique: false,
        key: {
            type: {
                fields: [
                    { name: 'mediaKind', type: 'uint' },
                    { name: 'createdAt', type: 'uint' }
                ]
            },
            map: 'attachmentsByMediaKindMap'
        }
    });
    dbns.indexes.register({
        name: 'attachments-by-media-kind-origin',
        collection: '@qvac/chunks',
        unique: false,
        key: {
            type: {
                fields: [
                    { name: 'mediaKind', type: 'uint' },
                    { name: 'generated', type: 'uint' },
                    { name: 'createdAt', type: 'uint' }
                ]
            },
            map: 'attachmentsByMediaKindOriginMap'
        }
    });
    dbns.indexes.register({
        name: 'tool-activity-by-agent',
        collection: '@qvac/tool-activity',
        unique: false,
        key: {
            type: {
                fields: [
                    { name: 'agentId', type: 'string' },
                    { name: 'seq', type: 'uint' }
                ]
            },
            map: 'toolActivityByAgentMap'
        }
    });
    dbns.collections.register({
        name: 'writer-activity',
        schema: '@qvac/writer-activity',
        key: ['writerKey']
    });
    dbns.indexes.register({
        name: 'devices-by-writer-key',
        collection: '@qvac/devices',
        unique: false,
        key: {
            type: { fields: [{ name: 'writerKey', type: 'fixed32' }] },
            map: 'devicesByWriterKeyMap'
        }
    });
    dbns.indexes.register({
        name: 'writers-by-most-recent',
        collection: '@qvac/writer-activity',
        unique: false,
        key: ['clock']
    });
    dbns.collections.register({
        name: 'device-attestations',
        schema: '@qvac/device-attestation',
        key: ['deviceId']
    });
    dbns.collections.register({ name: 'members', schema: '@qvac/member', key: ['id'] });
    dbns.collections.register({ name: 'chat-groups', schema: '@qvac/chat-group', key: ['id'] });
    dbns.indexes.register({
        name: 'active-chat-groups',
        collection: '@qvac/chat-groups',
        unique: false,
        key: {
            type: { fields: [{ name: 'createdAt', type: 'uint' }] },
            map: 'activeChatGroupsMap'
        }
    });
    dbns.indexes.register({
        name: 'live-writers-by-most-recent',
        collection: '@qvac/writer-activity',
        unique: false,
        key: {
            type: { fields: [{ name: 'clock', type: 'uint' }] },
            map: 'liveWritersByMostRecentMap'
        }
    });
    dbns.collections.register({
        name: 'joined-meshes',
        schema: '@qvac/joined-mesh',
        key: ['meshKey']
    });
    dbns.indexes.register({
        name: 'agents-by-provider',
        collection: '@qvac/agents',
        unique: false,
        key: {
            type: {
                fields: [
                    { name: 'providerDeviceId', type: 'fixed32' },
                    { name: 'createdAt', type: 'uint' }
                ]
            },
            map: 'agentsByProviderMap'
        }
    });
    dbns.indexes.register({
        name: 'default-agents',
        collection: '@qvac/agents',
        unique: false,
        key: {
            type: {
                fields: [
                    { name: 'providerDeviceId', type: 'fixed32' },
                    { name: 'createdAt', type: 'uint' }
                ]
            },
            map: 'defaultAgentsMap'
        }
    });
    dbns.collections.register({
        name: 'mesh-invite-grants',
        schema: '@qvac/mesh-invite-grant',
        key: ['grantKey']
    });
    dbns.collections.register({
        name: 'mesh-invite-spends',
        schema: '@qvac/mesh-invite-spend',
        key: ['grantKey', 'deviceId']
    });
    dbns.collections.register({ name: 'mesh-kinds', schema: '@qvac/mesh-kind', key: ['id'] });
    dbns.indexes.register({
        name: 'live-devices-by-writer-key',
        collection: '@qvac/devices',
        unique: false,
        key: {
            type: { fields: [{ name: 'writerKey', type: 'fixed32' }] },
            map: 'liveDevicesByWriterKeyMap'
        }
    });
    dbns.collections.register({
        name: 'index-backfills',
        schema: '@qvac/index-backfill',
        key: ['index']
    });
    dbns.collections.register({
        name: 'invite-sequences',
        schema: '@qvac/invite-sequence',
        key: ['id']
    });
    dbns.collections.register({
        name: 'member-removals',
        schema: '@qvac/member-removal',
        key: ['memberId']
    });
    dbns.collections.register({ name: 'mesh-founders', schema: '@qvac/mesh-founder', key: ['id'] });
    dbns.collections.register({ name: 'purged-chats', schema: '@qvac/purged-chat', key: ['chatId'] });
    dbns.collections.register({ name: 'mesh-names', schema: '@qvac/mesh-name', key: ['id'] });
    dbns.collections.register({ name: 'mesh-seeds', schema: '@qvac/mesh-seed', key: ['meshKey'] });
    dbns.collections.register({ name: 'mesh-rules', schema: '@qvac/mesh-rules', key: ['id'] });
    dbns.collections.register({ name: 'public-meshes', schema: '@qvac/public-mesh', key: ['id'] });
    dbns.collections.register({ name: 'workspace', schema: '@qvac/workspace', key: ['id'] });
    dbns.collections.register({
        name: 'member-roles',
        schema: '@qvac/member-role',
        key: ['memberId']
    });
    dbns.collections.register({
        name: 'public-seeds',
        schema: '@qvac/public-seed',
        key: ['memberId', 'deviceId']
    });
    dbns.collections.register({ name: 'projects', schema: '@qvac/project', key: ['id'] });
    dbns.collections.register({
        name: 'project-members',
        schema: '@qvac/project-member',
        key: ['memberId']
    });
    dbns.indexes.register({
        name: 'active-knowledge-base',
        collection: '@qvac/knowledge',
        unique: false,
        key: {
            type: { fields: [{ name: 'createdAt', type: 'uint' }] },
            map: 'activeKnowledgeBaseMap'
        }
    });
    dbns.collections.register({
        name: 'project-order',
        schema: '@qvac/project-order',
        key: ['workspaceKey']
    });
    dbns.indexes.register({
        name: 'run-request-by-run',
        collection: '@qvac/chunks',
        unique: false,
        key: {
            type: {
                fields: [
                    { name: 'chatId', type: 'string' },
                    { name: 'runId', type: 'string' }
                ]
            },
            map: 'runRequestByRunMap'
        }
    });
    dbns.collections.register({
        name: 'chat-reads',
        schema: '@qvac/chat-read',
        key: ['chatId', 'memberId']
    });
    dbns.collections.register({ name: 'knowledge-caps', schema: '@qvac/knowledge-cap', key: ['id'] });
    dbns.indexes.register({
        name: 'live-model-requests',
        collection: '@qvac/chunks',
        unique: false,
        key: {
            type: {
                fields: [
                    { name: 'chatId', type: 'string' },
                    { name: 'seq', type: 'uint' }
                ]
            },
            map: 'liveModelRequestsMap'
        }
    });
    dbns.collections.register({
        name: 'agent-hosts',
        schema: '@qvac/agent-host',
        key: ['writerKey', 'agentId']
    });
    dbns.collections.register({
        name: 'agent-users',
        schema: '@qvac/agent-user',
        key: ['agentId', 'userId']
    });
    dbns.collections.register({ name: 'member-keys', schema: '@qvac/member-key', key: ['memberId'] });
    dbns.collections.register({
        name: 'project-keys',
        schema: '@qvac/project-key',
        key: ['projectId', 'memberId']
    });
    dbns.collections.register({
        name: 'project-host-keys',
        schema: '@qvac/project-host-key',
        key: ['projectId', 'deviceId']
    });
    dbns.collections.register({
        name: 'project-device-keys',
        schema: '@qvac/project-device-key',
        key: ['projectId', 'deviceId']
    });
    dbns.collections.register({ name: 'skill-secrets', schema: '@qvac/skill-secret', key: ['key'] });
}
export function registerQvacDispatch(ds) {
    ds.register({ name: 'append-chunk', requestType: '@qvac/append-chunk-operation' });
    ds.register({ name: 'update-chunk', requestType: '@qvac/update-chunk-operation' });
    ds.register({ name: 'resolve-approval', requestType: '@qvac/resolve-approval-operation' });
    ds.register({ name: 'add-writer', requestType: '@qvac/writer' });
    ds.register({ name: 'remove-writer', requestType: '@qvac/remove-writer-operation' });
    ds.register({ name: 'join', requestType: '@qvac/writer-claim' });
    ds.register({ name: 'register-device', requestType: '@qvac/register-device-operation' });
    ds.register({ name: 'update-device', requestType: '@qvac/update-device-operation' });
    ds.register({ name: 'put-agent', requestType: '@qvac/put-agent-operation' });
    ds.register({ name: 'put-approval-rule', requestType: '@qvac/put-approval-rule-operation' });
    ds.register({ name: 'seed-defaults', requestType: '@qvac/seed-defaults-operation' });
    ds.register({ name: 'add-knowledge', requestType: '@qvac/add-knowledge-operation' });
    ds.register({ name: 'remove-knowledge', requestType: '@qvac/remove-knowledge-operation' });
    ds.register({
        name: 'add-knowledge-artifact',
        requestType: '@qvac/add-knowledge-artifact-operation'
    });
    ds.register({
        name: 'report-device-capabilities',
        requestType: '@qvac/report-device-capabilities-operation'
    });
    ds.register({ name: 'claim-indexing', requestType: '@qvac/claim-indexing-operation' });
    ds.register({ name: 'resolve-indexing', requestType: '@qvac/resolve-indexing-operation' });
    ds.register({ name: 'put-chat', requestType: '@qvac/put-chat-operation' });
    ds.register({
        name: 'update-device-profile',
        requestType: '@qvac/update-device-profile-operation'
    });
    ds.register({
        name: 'report-device-version',
        requestType: '@qvac/report-device-version-operation'
    });
    ds.register({ name: 'put-tool-configs', requestType: '@qvac/put-tool-configs-operation' });
    ds.register({ name: 'append-tool-activity', requestType: '@qvac/append-tool-activity-operation' });
    ds.register({ name: 'attest-device', requestType: '@qvac/device-attestation' });
    ds.register({ name: 'mint-member', requestType: '@qvac/mint-member-operation' });
    ds.register({
        name: 'attest-member-device',
        requestType: '@qvac/attest-member-device-operation'
    });
    ds.register({ name: 'update-member', requestType: '@qvac/update-member-operation' });
    ds.register({
        name: 'migrate-agent-catalog',
        requestType: '@qvac/put-agent-operation'
    });
    ds.register({ name: 'put-chat-group', requestType: '@qvac/put-chat-group-operation' });
    ds.register({ name: 'join-member', requestType: '@qvac/join-member-operation' });
    ds.register({
        name: 'put-joined-mesh',
        requestType: '@qvac/put-joined-mesh-operation'
    });
    ds.register({ name: 'remove-member', requestType: '@qvac/remove-member-operation' });
    ds.register({ name: 'reindex-agents', requestType: '@qvac/reindex-agents-operation' });
    ds.register({
        name: 'put-mesh-invite-grant',
        requestType: '@qvac/put-mesh-invite-grant-operation'
    });
    ds.register({ name: 'claim-invite', requestType: '@qvac/invite-claim' });
    ds.register({ name: 'mint-mesh-kind', requestType: '@qvac/mesh-kind' });
    ds.register({ name: 'vouched-join', requestType: '@qvac/vouched-join' });
    ds.register({ name: 'reindex-devices', requestType: '@qvac/reindex-devices-operation' });
    ds.register({ name: 'recover-device', requestType: '@qvac/recovery-claim' });
    ds.register({ name: 'purge-chat', requestType: '@qvac/purge-chat-operation' });
    ds.register({ name: 'name-mesh', requestType: '@qvac/name-mesh-operation' });
    ds.register({ name: 'open-join', requestType: '@qvac/open-join' });
    ds.register({ name: 'put-mesh-seed', requestType: '@qvac/mesh-seed' });
    ds.register({ name: 'raise-mesh-rules', requestType: '@qvac/raise-mesh-rules-operation' });
    ds.register({ name: 'put-public-mesh', requestType: '@qvac/public-mesh' });
    ds.register({ name: 'put-mesh-blind-peer', requestType: '@qvac/mesh-blind-peer' });
    ds.register({ name: 'put-workspace', requestType: '@qvac/put-workspace-operation' });
    ds.register({ name: 'set-member-role', requestType: '@qvac/member-role' });
    ds.register({ name: 'put-public-seed', requestType: '@qvac/public-seed' });
    ds.register({ name: 'put-project', requestType: '@qvac/put-project-operation' });
    ds.register({ name: 'set-project-listing', requestType: '@qvac/set-project-listing-operation' });
    ds.register({ name: 'put-project-member', requestType: '@qvac/project-member' });
    ds.register({ name: 'put-project-order', requestType: '@qvac/project-order' });
    ds.register({ name: 'retry-indexing', requestType: '@qvac/retry-indexing-operation' });
    ds.register({ name: 'progress-indexing', requestType: '@qvac/progress-indexing-operation' });
    ds.register({ name: 'mark-chat-read', requestType: '@qvac/chat-read' });
    ds.register({ name: 'delete-project', requestType: '@qvac/delete-project-operation' });
    ds.register({ name: 'set-knowledge-cap', requestType: '@qvac/set-knowledge-cap-operation' });
    ds.register({
        name: 'upgrade-to-workspace',
        requestType: '@qvac/upgrade-to-workspace-operation'
    });
    ds.register({ name: 'take-model-request', requestType: '@qvac/model-request-operation' });
    ds.register({
        name: 'settle-model-request',
        requestType: '@qvac/settle-model-request-operation'
    });
    ds.register({ name: 'cancel-model-request', requestType: '@qvac/model-request-operation' });
    ds.register({ name: 'reopen-model-request', requestType: '@qvac/model-request-operation' });
    ds.register({ name: 'put-agent-user', requestType: '@qvac/put-agent-user-operation' });
    ds.register({ name: 'put-member-key', requestType: '@qvac/member-key' });
    ds.register({ name: 'put-project-key', requestType: '@qvac/project-key' });
    ds.register({ name: 'put-project-host-key', requestType: '@qvac/project-host-key' });
    ds.register({ name: 'agent-join', requestType: '@qvac/agent-join' });
    ds.register({ name: 'put-project-device-key', requestType: '@qvac/project-device-key' });
    ds.register({ name: 'take-run-request', requestType: '@qvac/take-run-request-operation' });
    ds.register({ name: 'put-skill-secret', requestType: '@qvac/skill-secret' });
}
