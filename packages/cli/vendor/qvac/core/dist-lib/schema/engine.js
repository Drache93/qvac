import { registerContentTypes, versionedRegistrar } from './content.js';
import { MEDIA_KINDS } from './media-kind.js';
import { APP_CHANNELS, CAPABILITY_PROFILES, INDEXING_STATES } from './qvac.js';
export const MODEL_TASK_TYPES = [
    'llm',
    'embeddings',
    'speech-to-text',
    'text-to-speech',
    'image-generation',
    'audio-generation',
    'translation',
    'text-recognition',
    'other'
];
export const INDEXING_FAILURES = [
    'empty',
    'no-text',
    'password-protected',
    'out-of-space',
    'unsupported',
    'failed'
];
const rangeBounds = () => [
    { name: 'gt', type: 'uint' },
    { name: 'gte', type: 'uint' },
    { name: 'lt', type: 'uint' },
    { name: 'lte', type: 'uint' }
];
export function registerEngineTypes(ns) {
    const versioned = versionedRegistrar(ns, 'assistant');
    ns.register({ name: 'empty', fields: [] });
    ns.register({ name: 'ok-response', fields: [{ name: 'ok', type: 'bool', required: true }] });
    ns.register({
        name: 'config-key',
        fields: [
            { name: 'key', type: 'string', required: true },
            { name: 'deviceId', type: 'fixed32' }
        ]
    });
    ns.register({ name: 'config-value', fields: [{ name: 'value', type: 'json' }] });
    ns.register({
        name: 'config-set-request',
        fields: [
            { name: 'key', type: 'string', required: true },
            { name: 'value', type: 'json', required: true },
            { name: 'deviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'config-set-response',
        fields: [{ name: 'ok', type: 'bool', required: true }]
    });
    ns.register({ name: 'agent-reasoning', enum: ['inherit', 'enabled', 'disabled'], strings: true });
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
    ns.register({ name: 'capability-profile', enum: CAPABILITY_PROFILES, strings: true });
    ns.register({ name: 'app-channel', enum: APP_CHANNELS, strings: true });
    ns.register({
        name: 'agent',
        fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'name', type: 'string', required: true },
            { name: 'bio', type: 'string', required: true },
            { name: 'providerDeviceId', type: 'fixed32', required: true },
            { name: 'modelName', type: 'string', required: true },
            { name: 'reasoning', type: '@assistant/agent-reasoning', required: true },
            { name: 'enabledSkills', type: 'string', array: true },
            { name: 'enabledTools', type: 'string', array: true },
            { name: 'installedSkills', type: 'string', array: true },
            { name: 'isDefault', type: 'bool' },
            { name: 'createdAt', type: 'uint', required: true },
            { name: 'updatedAt', type: 'uint', required: true },
            { name: 'deletedAt', type: 'uint' },
            { name: 'imageModelChoice', type: '@assistant/image-model-choice' },
            { name: 'kvCacheK', type: 'string' },
            { name: 'kvCacheV', type: 'string' },
            { name: 'iconName', type: '@assistant/agent-icon-name' },
            { name: 'ctxSize', type: 'uint' },
            { name: 'orphaned', type: 'bool' },
            { name: 'toolsScope', type: '@assistant/tools-access-scope' },
            { name: 'skillsScope', type: '@assistant/skills-access-scope' },
            { name: 'imageSteps', type: 'uint' },
            { name: 'imageWidth', type: 'uint' },
            { name: 'imageHeight', type: 'uint' },
            { name: 'approvalMode', type: '@assistant/approval-mode' },
            { name: 'disabledToolsets', type: 'string', array: true },
            { name: 'lenderDeviceId', type: 'fixed32' },
            { name: 'hostReachable', type: 'bool' },
            { name: 'ownerMemberId', type: 'fixed32' },
            { name: 'shared', type: 'bool' }
        ]
    });
    ns.register({
        name: 'agent-list',
        fields: [{ name: 'agents', type: '@assistant/agent', array: true }]
    });
    ns.register({
        name: 'agent-id',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'list-agents-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'providerDeviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'default-agent-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'providerDeviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'default-agent',
        fields: [{ name: 'agent', type: '@assistant/agent' }]
    });
    ns.register({
        name: 'agent-config',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'bio', type: 'string', required: true },
            { name: 'providerDeviceId', type: 'fixed32', required: true },
            { name: 'modelName', type: 'string', required: true },
            { name: 'reasoning', type: '@assistant/agent-reasoning' },
            { name: 'enabledSkills', type: 'string', array: true },
            { name: 'enabledTools', type: 'string', array: true },
            { name: 'installedSkills', type: 'string', array: true },
            { name: 'imageModelChoice', type: '@assistant/image-model-choice' },
            { name: 'kvCacheK', type: 'string' },
            { name: 'kvCacheV', type: 'string' },
            { name: 'iconName', type: '@assistant/agent-icon-name' },
            { name: 'ctxSize', type: 'uint' },
            { name: 'toolsScope', type: '@assistant/tools-access-scope' },
            { name: 'skillsScope', type: '@assistant/skills-access-scope' },
            { name: 'imageSteps', type: 'uint' },
            { name: 'imageWidth', type: 'uint' },
            { name: 'imageHeight', type: 'uint' },
            { name: 'approvalMode', type: '@assistant/approval-mode' },
            { name: 'disabledToolsets', type: 'string', array: true },
            { name: 'isDefault', type: 'bool' },
            { name: 'lenderDeviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'agent-update-config',
        fields: [
            { name: 'name', type: 'string' },
            { name: 'bio', type: 'string' },
            { name: 'providerDeviceId', type: 'fixed32' },
            { name: 'modelName', type: 'string' },
            { name: 'reasoning', type: '@assistant/agent-reasoning' },
            { name: 'enabledSkills', type: 'string', array: true },
            { name: 'enabledTools', type: 'string', array: true },
            { name: 'installedSkills', type: 'string', array: true },
            { name: 'imageModelChoice', type: '@assistant/image-model-choice' },
            { name: 'kvCacheK', type: 'string' },
            { name: 'kvCacheV', type: 'string' },
            { name: 'iconName', type: '@assistant/agent-icon-name' },
            { name: 'ctxSize', type: 'uint' },
            { name: 'toolsScope', type: '@assistant/tools-access-scope' },
            { name: 'skillsScope', type: '@assistant/skills-access-scope' },
            { name: 'imageSteps', type: 'uint' },
            { name: 'imageWidth', type: 'uint' },
            { name: 'imageHeight', type: 'uint' },
            { name: 'clearImageSettings', type: 'bool' },
            { name: 'clearCtxSize', type: 'bool' },
            { name: 'approvalMode', type: '@assistant/approval-mode' },
            { name: 'disabledToolsets', type: 'string', array: true },
            { name: 'isDefault', type: 'bool' },
            { name: 'clearIsDefault', type: 'bool' },
            { name: 'lenderDeviceId', type: 'fixed32' },
            { name: 'clearLenderDeviceId', type: 'bool' }
        ]
    });
    ns.register({
        name: 'create-agent-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'config', type: '@assistant/agent-config', required: true }
        ]
    });
    ns.register({
        name: 'update-agent-request',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true },
            { name: 'config', type: '@assistant/agent-update-config', required: true }
        ]
    });
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
    ns.register({
        name: 'chat',
        fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'agentId', type: 'string', required: true },
            { name: 'title', type: 'string', required: true },
            { name: 'createdAt', type: 'uint', required: true },
            { name: 'deletedAt', type: 'uint' },
            { name: 'ragEnabled', type: 'bool' },
            { name: 'webSearchEnabled', type: 'bool' },
            { name: 'updatedAt', type: 'uint' },
            { name: 'lastActivityAt', type: 'uint' },
            { name: 'groupId', type: 'string' },
            { name: 'readThrough', type: 'uint' },
            { name: 'forkedFrom', type: '@assistant/chat-fork-source' },
            { name: 'projectId', type: 'string' },
            { name: 'meshId', type: 'string' },
            { name: 'knowledgeSourcesOff', type: 'string', array: true },
            { name: 'suggestion', type: '@assistant/chat-suggestion' }
        ]
    });
    ns.register({
        name: 'chat-group',
        fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'name', type: 'string', required: true },
            { name: 'createdAt', type: 'uint', required: true },
            { name: 'updatedAt', type: 'uint', required: true },
            { name: 'deletedAt', type: 'uint' }
        ]
    });
    ns.register({
        name: 'chat-list',
        fields: [
            { name: 'chats', type: '@assistant/chat', array: true },
            { name: 'groups', type: '@assistant/chat-group', array: true },
            { name: 'nextCursor', type: 'string' }
        ]
    });
    ns.register({
        name: 'list-chats-request',
        fields: [
            { name: 'limit', type: 'uint' },
            { name: 'cursor', type: 'string' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'chat-group-list',
        fields: [{ name: 'groups', type: '@assistant/chat-group', array: true }]
    });
    ns.register({
        name: 'chat-activity-state',
        enum: [
            'queued',
            'running',
            'generating-image',
            'generating-audio',
            'transcribing-audio',
            'awaiting-approval',
            'awaiting-download',
            'paused',
            'recovery-required'
        ],
        strings: true
    });
    ns.register({
        name: 'chat-activity',
        fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'activityState', type: '@assistant/chat-activity-state', required: true }
        ]
    });
    ns.register({
        name: 'chat-activity-list',
        fields: [{ name: 'activities', type: '@assistant/chat-activity', array: true }]
    });
    ns.register({
        name: 'chat-activity-request',
        fields: [
            { name: 'chatIds', type: 'string', array: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({ name: 'search-chats-match', enum: ['title', 'content'], strings: true });
    ns.register({
        name: 'search-chats-request',
        fields: [
            { name: 'query', type: 'string', required: true },
            { name: 'limit', type: 'uint' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'search-chats-hit',
        fields: [
            { name: 'chat', type: '@assistant/chat', required: true },
            { name: 'match', type: '@assistant/search-chats-match', required: true },
            { name: 'snippet', type: 'string', required: true },
            { name: 'chunkId', type: 'string', required: true },
            { name: 'runId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'search-chats-response',
        fields: [{ name: 'hits', type: '@assistant/search-chats-hit', array: true }]
    });
    ns.register({
        name: 'kv-cache-chat-id',
        fields: [{ name: 'chatId', type: 'string', required: true }]
    });
    ns.register({
        name: 'chat-id',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'chat-config',
        fields: [{ name: 'title', type: 'string', required: true }]
    });
    ns.register({
        name: 'create-chat-request',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true },
            { name: 'config', type: '@assistant/chat-config', required: true },
            { name: 'projectId', type: 'string' },
            { name: 'shared', type: 'bool' }
        ]
    });
    ns.register({
        name: 'set-chat-suggestion-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true },
            { name: 'suggestion', type: '@assistant/chat-suggestion', required: true }
        ]
    });
    ns.register({
        name: 'rename-chat-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true },
            { name: 'config', type: '@assistant/chat-config', required: true }
        ]
    });
    ns.register({
        name: 'chat-move-state',
        enum: ['carrying', 'leaving', 'complete', 'failed'],
        strings: true
    });
    ns.register({
        name: 'move-chat-to-mesh-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true },
            { name: 'targetMeshId', type: 'string', required: true },
            { name: 'agentId', type: 'string' }
        ]
    });
    ns.register({
        name: 'chat-move',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'chatId', type: 'string', required: true },
            { name: 'targetMeshId', type: 'string', required: true },
            { name: 'targetChatId', type: 'string', required: true },
            { name: 'state', type: '@assistant/chat-move-state', required: true },
            { name: 'files', type: 'uint', required: true },
            { name: 'carried', type: 'uint', required: true },
            { name: 'waiting', type: 'string', array: true },
            { name: 'restarted', type: 'bool', required: true },
            { name: 'failure', type: 'string' }
        ]
    });
    ns.register({
        name: 'fork-chat-config',
        fields: [{ name: 'title', type: 'string' }]
    });
    ns.register({
        name: 'fork-chat-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true },
            { name: 'runId', type: 'string' },
            { name: 'exclusive', type: 'bool' },
            { name: 'targetMeshId', type: 'string' },
            { name: 'agentId', type: 'string' },
            { name: 'config', type: '@assistant/fork-chat-config' }
        ]
    });
    ns.register({
        name: 'set-chat-agent-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'agentId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'set-chat-flag-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'enabled', type: 'bool', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'chat-group-id',
        fields: [
            { name: 'groupId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'chat-group-config',
        fields: [{ name: 'name', type: 'string', required: true }]
    });
    ns.register({
        name: 'create-chat-group-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'config', type: '@assistant/chat-group-config', required: true }
        ]
    });
    ns.register({
        name: 'rename-chat-group-request',
        fields: [
            { name: 'groupId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true },
            { name: 'config', type: '@assistant/chat-group-config', required: true }
        ]
    });
    ns.register({
        name: 'set-chat-group-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'groupId', type: 'string' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'move-chat-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'groupId', type: 'string' },
            { name: 'afterId', type: 'string' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'move-chat-group-request',
        fields: [
            { name: 'groupId', type: 'string', required: true },
            { name: 'afterId', type: 'string' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
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
    ns.register({
        name: 'device',
        fields: [
            { name: 'id', type: 'fixed32', required: true },
            { name: 'name', type: 'string', required: true },
            { name: 'joinedAt', type: 'uint', required: true },
            { name: 'revoked', type: 'bool' },
            { name: 'installedToolNames', type: 'string', array: true },
            { name: 'installedSkillNames', type: 'string', array: true },
            { name: 'capabilityProfile', type: '@assistant/capability-profile', required: true },
            { name: 'recommendedModelName', type: 'string', required: true },
            { name: 'installedModelNames', type: 'string', array: true },
            { name: 'cachedModelNames', type: 'string', array: true },
            { name: 'appVersion', type: 'string' },
            { name: 'appBuild', type: 'string' },
            { name: 'appChannel', type: '@assistant/app-channel' },
            { name: 'platform', type: 'string' },
            { name: 'readySkillNames', type: 'string', array: true },
            { name: 'toolCatalog', type: '@assistant/tool-report-entry', array: true },
            { name: 'memberId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'device-list',
        fields: [{ name: 'devices', type: '@assistant/device', array: true }]
    });
    ns.register({
        name: 'member',
        fields: [
            { name: 'id', type: 'fixed32', required: true },
            { name: 'name', type: 'string', required: true },
            { name: 'joinedAt', type: 'uint', required: true },
            { name: 'removed', type: 'bool' },
            { name: 'role', type: 'string' }
        ]
    });
    ns.register({
        name: 'member-list',
        fields: [{ name: 'members', type: '@assistant/member', array: true }]
    });
    ns.register({
        name: 'mesh-invite-request',
        fields: [
            { name: 'member', type: 'bool' },
            { name: 'meshId', type: 'string' }
        ]
    });
    ns.register({
        name: 'save-device-capabilities-request',
        fields: [
            { name: 'installedToolNames', type: 'string', array: true },
            { name: 'installedSkillNames', type: 'string', array: true },
            { name: 'installedModelNames', type: 'string', array: true },
            { name: 'cachedModelNames', type: 'string', array: true },
            { name: 'readySkillNames', type: 'string', array: true },
            { name: 'toolCatalog', type: '@assistant/tool-report-entry', array: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'device-id',
        fields: [
            { name: 'deviceId', type: 'fixed32', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'device-config',
        fields: [{ name: 'name', type: 'string', required: true }]
    });
    ns.register({
        name: 'rename-device-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'config', type: '@assistant/device-config', required: true }
        ]
    });
    ns.register({
        name: 'save-device-profile-request',
        fields: [
            { name: 'capabilityProfile', type: '@assistant/capability-profile', required: true },
            { name: 'recommendedModelName', type: 'string', required: true },
            { name: 'platform', type: 'string' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    registerContentTypes(ns, 'assistant');
    ns.register({ name: 'chunk-id', fields: [{ name: 'id', type: 'string', required: true }] });
    versioned('chunk', [
        { name: 'id', type: 'string', required: true },
        { name: 'chatId', type: 'string', required: true },
        { name: 'runId', type: 'string' },
        { name: 'type', type: '@assistant/chunk-type', required: true },
        { name: 'seq', type: 'uint', required: true },
        { name: 'originDeviceId', type: 'fixed32', required: true },
        { name: 'createdAt', type: 'uint', required: true },
        { name: 'updatedAt', type: 'uint' },
        { name: 'userMessage', type: '@assistant/chunk-content-user-message' },
        { name: 'content', type: '@assistant/chunk-content-assistant' },
        { name: 'thinking', type: '@assistant/chunk-content-thinking' },
        { name: 'toolCall', type: '@assistant/chunk-content-tool-call' },
        { name: 'toolResult', type: '@assistant/chunk-content-tool-result' },
        { name: 'attachment', type: '@assistant/chunk-content-attachment' },
        { name: 'approvalRequest', type: '@assistant/chunk-content-approval-request' },
        { name: 'runStatus', type: '@assistant/chunk-content-run-status' },
        { name: 'runRequest', type: '@assistant/chunk-content-run-request' },
        { name: 'sources', type: '@assistant/chunk-content-sources' },
        { name: 'parentId', type: 'string' },
        { name: 'effect', type: 'string' },
        { name: 'intent', type: 'string' },
        { name: 'display', type: 'json' },
        { name: 'rawCall', type: 'string' },
        { name: 'compaction', type: '@assistant/chunk-content-compaction' },
        { name: 'senderMemberId', type: 'fixed32' },
        { name: 'capability', type: 'string' },
        { name: 'capabilityArgs', type: 'json' },
        { name: 'enhance', type: '@assistant/enhance-mode' },
        { name: 'sourceId', type: 'string' },
        { name: 'requesterMemberId', type: 'fixed32' },
        { name: 'senderName', type: 'string' },
        { name: 'senderNotInProject', type: 'bool' },
        { name: 'senderFormerMember', type: 'bool' },
        { name: 'senderCopiedBy', type: 'fixed32' },
        { name: 'senderNameAtSend', type: 'string' },
        { name: 'context', type: '@assistant/chunk-content-context' },
        { name: 'modelRequest', type: '@assistant/chunk-content-model-request' },
        { name: 'round', type: 'uint' },
        { name: 'callId', type: 'string' },
        { name: 'resumed', type: 'bool' },
        { name: 'roundReset', type: '@assistant/chunk-content-round-reset' },
        { name: 'agentSwitch', type: '@assistant/chunk-content-agent-switch' },
        { name: 'runnerDeviceId', type: 'fixed32' },
        { name: 'runTakenBy', type: 'fixed32' },
        { name: 'runTakenAt', type: 'uint' }
    ]);
    ns.register({
        name: 'chunk-list',
        fields: [{ name: 'chunks', type: '@assistant/chunk', array: true }]
    });
    ns.register({
        name: 'append-chunk-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'runId', type: 'string' },
            { name: 'type', type: '@assistant/chunk-type', required: true },
            { name: 'originDeviceId', type: 'fixed32', required: true },
            { name: 'userMessage', type: '@assistant/chunk-content-user-message' },
            { name: 'content', type: '@assistant/chunk-content-assistant' },
            { name: 'thinking', type: '@assistant/chunk-content-thinking' },
            { name: 'toolCall', type: '@assistant/chunk-content-tool-call' },
            { name: 'toolResult', type: '@assistant/chunk-content-tool-result' },
            { name: 'attachment', type: '@assistant/chunk-content-attachment' },
            { name: 'approvalRequest', type: '@assistant/chunk-content-approval-request' },
            { name: 'runStatus', type: '@assistant/chunk-content-run-status' },
            { name: 'runRequest', type: '@assistant/chunk-content-run-request' },
            { name: 'sources', type: '@assistant/chunk-content-sources' },
            { name: 'parentId', type: 'string' },
            { name: 'effect', type: 'string' },
            { name: 'intent', type: 'string' },
            { name: 'display', type: 'json' },
            { name: 'rawCall', type: 'string' },
            { name: 'compaction', type: '@assistant/chunk-content-compaction' },
            { name: 'meshId', type: 'string', required: true },
            { name: 'capability', type: 'string' },
            { name: 'capabilityArgs', type: 'json' },
            { name: 'enhance', type: '@assistant/enhance-mode' },
            { name: 'context', type: '@assistant/chunk-content-context' },
            { name: 'modelRequest', type: '@assistant/chunk-content-model-request' },
            { name: 'round', type: 'uint' },
            { name: 'callId', type: 'string' },
            { name: 'resumed', type: 'bool' },
            { name: 'roundReset', type: '@assistant/chunk-content-round-reset' },
            { name: 'agentSwitch', type: '@assistant/chunk-content-agent-switch' }
        ]
    });
    ns.register({
        name: 'update-chunk-request',
        fields: [
            { name: 'chunkId', type: 'string', required: true },
            { name: 'runStatus', type: '@assistant/chunk-content-run-status' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'resolve-approval-request',
        fields: [
            { name: 'chunkId', type: 'string', required: true },
            { name: 'approved', type: 'bool', required: true },
            { name: 'scope', type: '@assistant/approval-scope' },
            { name: 'expiresAt', type: 'uint' },
            { name: 'agentId', type: 'string' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({ name: 'approval-scope', enum: ['once', 'always'], strings: true });
    ns.register({ name: 'approval-decision', enum: ['allow', 'deny'], strings: true });
    ns.register({
        name: 'approval-rule',
        fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'toolName', type: 'string' },
            { name: 'resourceKind', type: 'string' },
            { name: 'resourcePattern', type: 'string' },
            { name: 'decision', type: '@assistant/approval-decision', required: true },
            { name: 'createdAt', type: 'uint', required: true },
            { name: 'updatedAt', type: 'uint', required: true },
            { name: 'expiresAt', type: 'uint' },
            { name: 'agentId', type: 'string' },
            { name: 'effect', type: 'string' },
            { name: 'memberId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'approval-rule-list',
        fields: [
            { name: 'rules', type: '@assistant/approval-rule', array: true },
            { name: 'ourMemberId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'chunks-by-chat-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'type', type: '@assistant/chunk-type' },
            { name: 'types', type: '@assistant/chunk-type', array: true },
            ...rangeBounds(),
            { name: 'reverse', type: 'bool' },
            { name: 'limit', type: 'uint' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({ name: 'media-kind', enum: MEDIA_KINDS, strings: true });
    ns.register({ name: 'attachment-origin', enum: ['uploaded', 'generated'], strings: true });
    ns.register({
        name: 'attachments-by-kind-request',
        fields: [
            { name: 'kind', type: '@assistant/media-kind', required: true },
            ...rangeBounds(),
            { name: 'reverse', type: 'bool' },
            { name: 'limit', type: 'uint' },
            { name: 'origin', type: '@assistant/attachment-origin' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'upload-attachment-request',
        fields: [
            { name: 'chatId', type: 'string' },
            { name: 'runId', type: 'string' },
            { name: 'originDeviceId', type: 'fixed32' },
            { name: 'fileName', type: 'string' },
            { name: 'mimeType', type: 'string' },
            { name: 'data', type: 'buffer' },
            { name: 'raw', type: 'bool' },
            { name: 'fileId', type: 'string' },
            { name: 'totalBytes', type: 'uint' },
            { name: 'meshId', type: 'string' },
            { name: 'sourceId', type: 'string' }
        ]
    });
    ns.register({
        name: 'upload-attachment-response',
        fields: [
            { name: 'bytesWritten', type: 'uint', required: true },
            { name: 'attachment', type: '@assistant/chunk-content-attachment' }
        ]
    });
    ns.register({
        name: 'download-attachment-request',
        fields: [
            { name: 'blobId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'delete-attachment-request',
        fields: [
            { name: 'chunkId', type: 'string', required: true },
            { name: 'at', type: 'uint', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'download-attachment-response',
        fields: [
            { name: 'data', type: 'buffer', required: true },
            { name: 'bytesRead', type: 'uint', required: true },
            { name: 'byteLength', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'transcode-image-request',
        fields: [{ name: 'bytes', type: 'buffer', required: true }]
    });
    ns.register({
        name: 'transcode-image-response',
        fields: [{ name: 'bytes', type: 'buffer' }]
    });
    ns.register({
        name: 'knowledge',
        fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'chatId', type: 'string' },
            { name: 'fileName', type: 'string', required: true },
            { name: 'mimeType', type: 'string', required: true },
            { name: 'byteLength', type: 'uint', required: true },
            { name: 'blobId', type: 'string', required: true },
            { name: 'createdAt', type: 'uint', required: true },
            { name: 'updatedAt', type: 'uint', required: true },
            { name: 'deletedAt', type: 'uint' },
            { name: 'deletedBy', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'knowledge-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'knowledgeId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'knowledge-list',
        fields: [{ name: 'knowledge', type: '@assistant/knowledge', array: true }]
    });
    ns.register({
        name: 'file-knowledge-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'chatId', type: 'string', required: true },
            { name: 'fileId', type: 'string', required: true }
        ]
    });
    ns.register({ name: 'rag-search-mode', enum: ['injection', 'tool'], strings: true });
    ns.register({
        name: 'rag-search-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'query', type: 'string', required: true },
            { name: 'limit', type: 'uint' },
            { name: 'mode', type: '@assistant/rag-search-mode' },
            { name: 'attachmentIds', type: 'string', array: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'vector-hit',
        fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'content', type: 'string', required: true },
            { name: 'metadataJson', type: 'string', required: true },
            { name: 'score', type: 'float64', required: true }
        ]
    });
    ns.register({
        name: 'rag-search-response',
        fields: [
            { name: 'enabled', type: 'bool', required: true },
            { name: 'searchedCount', type: 'uint', required: true },
            { name: 'indexEmpty', type: 'bool', required: true },
            { name: 'hasKnowledge', type: 'bool', required: true },
            { name: 'targetDocumentId', type: 'string' },
            { name: 'errorMessage', type: 'string' },
            { name: 'availableFiles', type: 'string', array: true },
            { name: 'hits', type: '@assistant/vector-hit', array: true },
            { name: 'pendingReferenced', type: 'bool' },
            { name: 'failedFiles', type: 'string', array: true },
            { name: 'pendingFiles', type: 'string', array: true },
            { name: 'chatFilesNotReady', type: 'uint' },
            { name: 'projectFilesNotReady', type: 'uint' }
        ]
    });
    ns.register({
        name: 'upload-knowledge-request',
        fields: [
            { name: 'chatId', type: 'string' },
            { name: 'fileName', type: 'string' },
            { name: 'mimeType', type: 'string' },
            { name: 'data', type: 'buffer' },
            { name: 'fileId', type: 'string' },
            { name: 'totalBytes', type: 'uint' },
            { name: 'meshId', type: 'string' }
        ]
    });
    ns.register({
        name: 'upload-knowledge-response',
        fields: [
            { name: 'bytesWritten', type: 'uint', required: true },
            { name: 'knowledge', type: '@assistant/knowledge' }
        ]
    });
    ns.register({
        name: 'knowledge-by-chat-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'remove-knowledge-request',
        fields: [
            { name: 'knowledgeId', type: 'string', required: true },
            { name: 'at', type: 'uint', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({ name: 'indexing-state', enum: INDEXING_STATES, strings: true });
    ns.register({
        name: 'indexing-status',
        fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'knowledgeId', type: 'string', required: true },
            { name: 'chatId', type: 'string', required: true },
            { name: 'status', type: '@assistant/indexing-state', required: true },
            { name: 'claimId', type: 'string', required: true },
            { name: 'claimedBy', type: 'buffer', required: true },
            { name: 'at', type: 'uint', required: true },
            { name: 'expiresAt', type: 'uint', required: true },
            { name: 'error', type: 'string' },
            { name: 'claimLive', type: 'bool', required: true }
        ]
    });
    ns.register({
        name: 'indexing-status-list',
        fields: [{ name: 'statuses', type: '@assistant/indexing-status', array: true }]
    });
    ns.register({ name: 'indexing-failure', enum: INDEXING_FAILURES, strings: true });
    ns.register({
        name: 'knowledge-base-entry',
        fields: [
            { name: 'knowledge', type: '@assistant/knowledge', required: true },
            { name: 'status', type: '@assistant/indexing-state', required: true },
            { name: 'error', type: 'string' },
            { name: 'loaded', type: 'bool', required: true },
            { name: 'reason', type: '@assistant/indexing-failure' },
            { name: 'failedOn', type: 'string' }
        ]
    });
    ns.register({
        name: 'knowledge-base-list',
        fields: [
            { name: 'entries', type: '@assistant/knowledge-base-entry', array: true },
            { name: 'usedBytes', type: 'uint' },
            { name: 'capBytes', type: 'uint' }
        ]
    });
    ns.register({
        name: 'indexing-progress-stage',
        enum: ['embedding', 'ready', 'failed'],
        strings: true
    });
    ns.register({
        name: 'indexing-progress',
        fields: [
            { name: 'knowledgeId', type: 'string', required: true },
            { name: 'chatId', type: 'string', required: true },
            { name: 'stage', type: '@assistant/indexing-progress-stage', required: true },
            { name: 'processedChunks', type: 'uint', required: true },
            { name: 'totalChunks', type: 'uint', required: true },
            { name: 'error', type: 'string' }
        ]
    });
    ns.register({
        name: 'indexing-progress-list',
        fields: [{ name: 'entries', type: '@assistant/indexing-progress', array: true }]
    });
    ns.register({
        name: 'run-agent-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'agentId', type: 'string', required: true },
            { name: 'parentRunId', type: 'string' },
            { name: 'meshId', type: 'string', required: true },
            { name: 'capability', type: 'string' },
            { name: 'capabilityArgs', type: 'json' },
            { name: 'enhance', type: '@assistant/enhance-mode' }
        ]
    });
    ns.register({
        name: 'send-message-request',
        fields: [
            { name: 'text', type: 'string', required: true },
            { name: 'chatId', type: 'string' },
            { name: 'agentId', type: 'string' },
            { name: 'title', type: 'string' },
            { name: 'parentRunId', type: 'string' },
            { name: 'meshId', type: 'string', required: true },
            { name: 'capability', type: 'string' },
            { name: 'capabilityArgs', type: 'json' },
            { name: 'enhance', type: '@assistant/enhance-mode' }
        ]
    });
    ns.register({
        name: 'send-message-response',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'chunkId', type: 'string', required: true },
            { name: 'runId', type: 'string', required: true },
            { name: 'chat', type: '@assistant/chat' }
        ]
    });
    ns.register({
        name: 'stop-run-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'runId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'device-info',
        fields: [
            { name: 'id', type: 'fixed32', required: true },
            { name: 'supportsKvCacheDeletion', type: 'bool' },
            { name: 'computeLenderId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'identity-phrase',
        fields: [
            { name: 'phrase', type: 'string', required: true },
            { name: 'timeout', type: 'uint' }
        ]
    });
    ns.register({
        name: 'diagnostics',
        fields: [{ name: 'stats', type: 'json', required: true }]
    });
    ns.register({
        name: 'mesh-status-state',
        enum: ['idle', 'joining', 'joined', 'leaving', 'error', 'kicked', 'needs-upgrade'],
        strings: true
    });
    ns.register({
        name: 'mesh-status',
        fields: [
            { name: 'state', type: '@assistant/mesh-status-state', required: true },
            { name: 'peerCount', type: 'uint', required: true },
            { name: 'peerDeviceIds', type: 'string', array: true },
            { name: 'kickedPending', type: 'bool' },
            { name: 'error', type: 'string' },
            { name: 'blindPeersConnected', type: 'uint' },
            { name: 'blindPeersTotal', type: 'uint' }
        ]
    });
    ns.register({
        name: 'network-status-state',
        enum: ['online', 'degraded', 'offline'],
        strings: true
    });
    ns.register({
        name: 'network-status',
        fields: [
            { name: 'state', type: '@assistant/network-status-state', required: true },
            { name: 'peerCount', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'blind-peering',
        fields: [{ name: 'enabled', type: 'bool', required: true }]
    });
    ns.register({
        name: 'sync-status-state',
        enum: ['idle', 'syncing', 'synced'],
        strings: true
    });
    ns.register({
        name: 'sync-device',
        fields: [
            { name: 'writerKey', type: 'fixed32', required: true },
            { name: 'deviceId', type: 'fixed32' },
            { name: 'applied', type: 'uint', required: true },
            { name: 'known', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'sync-status',
        fields: [
            { name: 'state', type: '@assistant/sync-status-state', required: true },
            { name: 'pendingOps', type: 'uint', required: true },
            { name: 'devices', type: '@assistant/sync-device', array: true },
            { name: 'pendingUploads', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'mesh-invite-response',
        fields: [
            { name: 'invite', type: 'string' },
            { name: 'meshId', type: 'string' },
            { name: 'notice', type: 'string' }
        ]
    });
    ns.register({
        name: 'join-mesh-request',
        fields: [{ name: 'invite', type: 'string', required: true }]
    });
    ns.register({ name: 'model-task-type', enum: [...MODEL_TASK_TYPES], strings: true });
    ns.register({
        name: 'list-models-request',
        fields: [
            { name: 'type', type: 'string' },
            { name: 'cachedOnly', type: 'bool' },
            { name: 'fullRegistry', type: 'bool' },
            { name: 'taskType', type: '@assistant/model-task-type' },
            { name: 'excludeCustom', type: 'bool' },
            { name: 'deviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'model-info',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'type', type: 'string', required: true },
            { name: 'registryPath', type: 'string', required: true },
            { name: 'registrySource', type: 'string', required: true },
            { name: 'isCached', type: 'bool', required: true },
            { name: 'isLoaded', type: 'bool', required: true },
            { name: 'expectedSize', type: 'uint', required: true },
            { name: 'actualSize', type: 'uint' },
            { name: 'supportsImages', type: 'bool' },
            { name: 'taskType', type: '@assistant/model-task-type' },
            { name: 'isLoading', type: 'bool' },
            { name: 'memoryBytes', type: 'uint' }
        ]
    });
    ns.register({
        name: 'model-info-list',
        fields: [
            { name: 'models', type: '@assistant/model-info', array: true },
            { name: 'memory', type: '@assistant/model-memory' }
        ]
    });
    ns.register({
        name: 'delete-model-request',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'deviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'delete-model-response',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'removed', type: 'uint', required: true },
            { name: 'freedBytes', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'kv-cache-deletion-status',
        enum: ['success', 'failure', 'unsupported'],
        strings: true
    });
    ns.register({
        name: 'kv-cache-deletion-response',
        fields: [
            { name: 'status', type: '@assistant/kv-cache-deletion-status', required: true },
            { name: 'error', type: 'string' }
        ]
    });
    ns.register({
        name: 'model-catalog-revision',
        fields: [{ name: 'revision', type: 'uint', required: true }]
    });
    ns.register({
        name: 'skill-request',
        fields: [
            { name: 'agentId', type: 'string' },
            { name: 'modelName', type: 'string' },
            { name: 'refresh', type: 'bool' },
            { name: 'meshId', type: 'string' }
        ]
    });
    ns.register({
        name: 'skill-response',
        fields: [{ name: 'skills', type: 'json', required: true }]
    });
    ns.register({
        name: 'download-knowledge-request',
        fields: [
            { name: 'blobId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'download-knowledge-response',
        fields: [
            { name: 'data', type: 'buffer', required: true },
            { name: 'bytesRead', type: 'uint', required: true },
            { name: 'byteLength', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'delegation-capabilities',
        fields: [
            { name: 'chat', type: 'bool', required: true },
            { name: 'transcription', type: 'bool', required: true },
            { name: 'tts', type: 'bool', required: true },
            { name: 'embeddings', type: 'bool', required: true },
            { name: 'knowledge', type: 'bool', required: true }
        ]
    });
    ns.register({
        name: 'delegation',
        fields: [
            { name: 'enabled', type: 'bool', required: true },
            { name: 'targetDeviceId', type: 'string' },
            { name: 'targetAgentId', type: 'string' },
            { name: 'capabilities', type: '@assistant/delegation-capabilities', required: true }
        ]
    });
    ns.register({
        name: 'app-config',
        fields: [
            { name: 'activeAgentId', type: 'string' },
            { name: 'activeChatId', type: 'string' },
            { name: 'thinkingEnabled', type: 'bool', required: true },
            { name: 'ctxSize', type: 'uint' },
            { name: 'lastModelName', type: 'string' },
            { name: 'onboardingCompleted', type: 'bool', required: true },
            { name: 'delegation', type: '@assistant/delegation', required: true },
            { name: 'pausedModels', type: 'string', array: true },
            { name: 'releasedModels', type: 'string', array: true },
            { name: 'autoDownloadModels', type: 'bool', required: true }
        ]
    });
    ns.register({
        name: 'app-config-update',
        fields: [
            { name: 'activeAgentId', type: 'string' },
            { name: 'activeChatId', type: 'string' },
            { name: 'thinkingEnabled', type: 'bool', required: true },
            { name: 'ctxSize', type: 'uint' },
            { name: 'onboardingCompleted', type: 'bool', required: true },
            { name: 'delegation', type: '@assistant/delegation', required: true }
        ]
    });
    ns.register({
        name: 'set-model-paused-request',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'paused', type: 'bool', required: true },
            { name: 'deviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'set-model-released-request',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'released', type: 'bool', required: true }
        ]
    });
    ns.register({
        name: 'set-auto-download-models-request',
        fields: [{ name: 'enabled', type: 'bool', required: true }]
    });
    ns.register({
        name: 'model-download-phase',
        enum: ['queued', 'downloading', 'paused', 'error', 'held'],
        strings: true
    });
    ns.register({
        name: 'model-download',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'phase', type: '@assistant/model-download-phase', required: true },
            { name: 'percentage', type: 'uint' },
            { name: 'error', type: 'string' },
            { name: 'updatedAt', type: 'uint', required: true },
            { name: 'downloaded', type: 'uint' },
            { name: 'total', type: 'uint' },
            { name: 'bytesPerSecond', type: 'uint' }
        ]
    });
    ns.register({
        name: 'model-download-list',
        fields: [{ name: 'downloads', type: '@assistant/model-download', array: true }]
    });
    ns.register({
        name: 'set-model-download-status-request',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'phase', type: '@assistant/model-download-phase', required: true },
            { name: 'percentage', type: 'uint' },
            { name: 'error', type: 'string' },
            { name: 'downloaded', type: 'uint' },
            { name: 'total', type: 'uint' },
            { name: 'bytesPerSecond', type: 'uint' }
        ]
    });
    ns.register({
        name: 'clear-model-download-request',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'deviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'custom-model',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'src', type: 'string', required: true },
            { name: 'mmprojSrc', type: 'string' },
            { name: 'supportsTools', type: 'bool' },
            { name: 'supportsThinking', type: 'bool' },
            { name: 'supportsVision', type: 'bool' },
            { name: 'expectedSize', type: 'uint' },
            { name: 'createdAt', type: 'uint', required: true },
            { name: 'contextLength', type: 'uint' },
            { name: 'taskType', type: 'string' },
            { name: 'license', type: 'string' },
            { name: 'label', type: 'string' }
        ]
    });
    ns.register({
        name: 'custom-model-list',
        fields: [{ name: 'models', type: '@assistant/custom-model', array: true }]
    });
    ns.register({
        name: 'add-custom-model-request',
        fields: [
            { name: 'label', type: 'string', required: true },
            { name: 'src', type: 'string', required: true },
            { name: 'mmprojSrc', type: 'string' },
            { name: 'supportsTools', type: 'bool' },
            { name: 'supportsThinking', type: 'bool' },
            { name: 'supportsVision', type: 'bool' },
            { name: 'expectedSize', type: 'uint' },
            { name: 'deviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'add-custom-model-response',
        fields: [{ name: 'id', type: 'string', required: true }]
    });
    ns.register({
        name: 'remove-custom-model-request',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'deviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'preview-custom-model-request',
        fields: [
            { name: 'src', type: 'string', required: true },
            { name: 'mmprojSrc', type: 'string' },
            { name: 'deviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'custom-model-source-file',
        fields: [
            { name: 'src', type: 'string', required: true },
            { name: 'label', type: 'string', required: true },
            { name: 'sizeBytes', type: 'uint' }
        ]
    });
    ns.register({
        name: 'custom-model-preview',
        fields: [
            { name: 'ok', type: 'bool', required: true },
            { name: 'refusal', type: 'string' },
            { name: 'reason', type: 'string' },
            { name: 'src', type: 'string' },
            { name: 'files', type: '@assistant/custom-model-source-file', array: true },
            { name: 'sizeBytes', type: 'uint' },
            { name: 'contextLength', type: 'uint' },
            { name: 'architecture', type: 'string' },
            { name: 'sizeLabel', type: 'string' },
            { name: 'taskType', type: 'string' },
            { name: 'license', type: 'string' },
            { name: 'fit', type: 'string' },
            { name: 'fitReasons', type: 'string', array: true },
            { name: 'mmprojSrc', type: 'string' }
        ]
    });
    ns.register({ name: 'log-level', enum: ['debug', 'info', 'warn', 'error'], strings: true });
    ns.register({ name: 'log-origin', enum: ['core', 'client'], strings: true });
    ns.register({
        name: 'log-line',
        fields: [
            { name: 'seq', type: 'uint', required: true },
            { name: 'at', type: 'uint', required: true },
            { name: 'level', type: '@assistant/log-level', required: true },
            { name: 'scope', type: 'string', array: true },
            { name: 'message', type: 'string', required: true },
            { name: 'origin', type: '@assistant/log-origin', required: true },
            { name: 'originDeviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'log-line-list',
        fields: [{ name: 'lines', type: '@assistant/log-line', array: true }]
    });
    ns.register({
        name: 'logs-watch-request',
        fields: [
            { name: 'level', type: '@assistant/log-level' },
            { name: 'scope', type: 'string', array: true },
            { name: 'backfill', type: 'uint' },
            { name: 'origin', type: '@assistant/log-origin' }
        ]
    });
    ns.register({
        name: 'write-log-request',
        fields: [
            { name: 'level', type: '@assistant/log-level', required: true },
            { name: 'scope', type: 'string', array: true },
            { name: 'message', type: 'string', required: true },
            { name: 'at', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'transcribe-request',
        fields: [
            { name: 'audio', type: 'buffer', required: true },
            { name: 'model', type: 'string' }
        ]
    });
    ns.register({
        name: 'transcribe-response',
        fields: [{ name: 'text', type: 'string', required: true }]
    });
    ns.register({
        name: 'detect-language-request',
        fields: [
            { name: 'text', type: 'string', required: true },
            { name: 'topK', type: 'uint' }
        ]
    });
    ns.register({
        name: 'detected-language',
        fields: [
            { name: 'code', type: 'string', required: true },
            { name: 'language', type: 'string', required: true },
            { name: 'probability', type: 'float64' }
        ]
    });
    ns.register({
        name: 'detect-language-response',
        fields: [
            { name: 'languages', type: '@assistant/detected-language', array: true, required: true }
        ]
    });
    ns.register({
        name: 'speak-request',
        fields: [
            { name: 'text', type: 'string', required: true },
            { name: 'model', type: 'string' }
        ]
    });
    ns.register({
        name: 'speak-response',
        fields: [
            { name: 'audio', type: 'buffer', required: true },
            { name: 'sampleRate', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'skill-binary-requirement',
        fields: [
            { name: 'bin', type: 'string', required: true },
            { name: 'minVersion', type: 'string' },
            { name: 'command', type: 'string' }
        ]
    });
    ns.register({
        name: 'skill-requirements',
        fields: [
            { name: 'binaries', type: '@assistant/skill-binary-requirement', array: true },
            { name: 'credentials', type: 'string', array: true }
        ]
    });
    ns.register({
        name: 'skill-install-step',
        fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'kind', type: 'string', required: true },
            { name: 'label', type: 'string', required: true },
            { name: 'formula', type: 'string' },
            { name: 'command', type: 'string' },
            { name: 'manual', type: 'bool' },
            { name: 'bins', type: 'string', array: true }
        ]
    });
    ns.register({
        name: 'skill-setup-field',
        fields: [
            { name: 'key', type: 'string', required: true },
            { name: 'label', type: 'string', required: true },
            { name: 'placeholder', type: 'string' },
            { name: 'secret', type: 'bool' },
            { name: 'required', type: 'bool' }
        ]
    });
    ns.register({
        name: 'skill-setup-token-auth',
        enum: ['pkce-only', 'secret-in-body', 'secret-in-basic'],
        strings: true
    });
    ns.register({
        name: 'skill-setup-oauth',
        fields: [
            { name: 'stateKey', type: 'string', required: true },
            { name: 'authUrl', type: 'string', required: true },
            { name: 'tokenUrl', type: 'string', required: true },
            { name: 'tokenAuth', type: '@assistant/skill-setup-token-auth', required: true },
            { name: 'scopes', type: 'string', array: true },
            { name: 'extraAuthParams', type: 'json' },
            { name: 'registrationEndpoint', type: 'string' },
            { name: 'port', type: 'uint' },
            { name: 'sharedIosSession', type: 'bool' }
        ]
    });
    ns.register({
        name: 'skill-setup-route-kind',
        enum: ['oauth', 'token', 'install', 'picker', 'instructions'],
        strings: true
    });
    ns.register({
        name: 'skill-setup-route',
        fields: [
            { name: 'kind', type: '@assistant/skill-setup-route-kind', required: true },
            { name: 'label', type: 'string', required: true },
            { name: 'provider', type: 'string' },
            { name: 'credentialKey', type: 'string' },
            { name: 'description', type: 'string' },
            { name: 'helpUrl', type: 'string' },
            { name: 'steps', type: 'string', array: true },
            { name: 'configSteps', type: 'string', array: true },
            { name: 'fields', type: '@assistant/skill-setup-field', array: true },
            { name: 'satisfied', type: 'bool' },
            { name: 'oauth', type: '@assistant/skill-setup-oauth' }
        ]
    });
    ns.register({
        name: 'skill-setup',
        fields: [
            { name: 'summary', type: 'string' },
            { name: 'routes', type: '@assistant/skill-setup-route', array: true }
        ]
    });
    ns.register({
        name: 'skill',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'description', type: 'string', required: true },
            { name: 'tools', type: 'string', array: true },
            { name: 'credentials', type: 'string', array: true },
            { name: 'allowList', type: 'string', array: true },
            { name: 'platforms', type: 'string', array: true },
            { name: 'requirements', type: '@assistant/skill-requirements' },
            { name: 'install', type: '@assistant/skill-install-step', array: true },
            { name: 'setup', type: '@assistant/skill-setup' },
            { name: 'status', type: 'string', required: true },
            { name: 'stub', type: 'bool' },
            { name: 'minCapabilityProfile', type: 'string' },
            { name: 'emoji', type: 'string' },
            { name: 'displayName', type: 'string' }
        ]
    });
    ns.register({
        name: 'skill-catalog-response',
        fields: [{ name: 'skills', type: '@assistant/skill', array: true, required: true }]
    });
    ns.register({
        name: 'tool-catalog-entry',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'description', type: 'string', required: true },
            { name: 'skillGated', type: 'bool', required: true },
            { name: 'scopeRequired', type: 'bool', required: true },
            { name: 'toolset', type: 'string' },
            { name: 'promptChars', type: 'uint' },
            { name: 'rootsRequired', type: 'bool' },
            { name: 'writeRootsRequired', type: 'bool' }
        ]
    });
    ns.register({
        name: 'tool-catalog-response',
        fields: [{ name: 'tools', type: '@assistant/tool-catalog-entry', array: true, required: true }]
    });
    ns.register({
        name: 'speak-stream-frame',
        fields: [{ name: 'text', type: 'string', required: true }]
    });
    ns.register({
        name: 'tool-configs',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'toolName', type: 'string', required: true },
            { name: 'settings', type: 'json', required: true },
            { name: 'createdAt', type: 'uint', required: true },
            { name: 'updatedAt', type: 'uint', required: true },
            { name: 'deletedAt', type: 'uint' }
        ]
    });
    ns.register({
        name: 'tool-configs-list',
        fields: [{ name: 'configs', type: '@assistant/tool-configs', array: true }]
    });
    ns.register({
        name: 'set-tool-configs-request',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'toolName', type: 'string', required: true },
            { name: 'settings', type: 'json', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'delete-tool-configs-request',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'toolName', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'list-tool-configs-request',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'skill-secret-value',
        fields: [
            { name: 'key', type: 'string', required: true },
            { name: 'value', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'push-skill-secret-request',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'skillName', type: 'string', required: true },
            { name: 'values', type: '@assistant/skill-secret-value', array: true, required: true }
        ]
    });
    ns.register({
        name: 'skill-secret-handoff',
        fields: [
            { name: 'id', type: 'uint', required: true },
            { name: 'request', type: '@assistant/push-skill-secret-request', required: true }
        ]
    });
    ns.register({
        name: 'skill-secret-handoff-ack',
        fields: [
            { name: 'id', type: 'uint', required: true },
            { name: 'error', type: 'string' },
            { name: 'code', type: 'uint' }
        ]
    });
    ns.register({
        name: 'tool-activity-entry',
        fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'agentId', type: 'string', required: true },
            { name: 'deviceId', type: 'string', required: true },
            { name: 'chatId', type: 'string' },
            { name: 'runId', type: 'string' },
            { name: 'toolName', type: 'string', required: true },
            { name: 'arguments', type: 'json' },
            { name: 'resource', type: '@assistant/resource-descriptor' },
            { name: 'effect', type: 'string' },
            { name: 'decision', type: 'string', required: true },
            { name: 'at', type: 'uint', required: true },
            { name: 'seq', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'tool-activity-list',
        fields: [{ name: 'activities', type: '@assistant/tool-activity-entry', array: true }]
    });
    ns.register({
        name: 'list-tool-activity-request',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'limit', type: 'uint' },
            ...rangeBounds(),
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'record-tool-activity-request',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'toolName', type: 'string', required: true },
            { name: 'decision', type: 'string', required: true },
            { name: 'effect', type: 'string' },
            { name: 'arguments', type: 'json' },
            { name: 'resource', type: '@assistant/resource-descriptor' },
            { name: 'chatId', type: 'string' },
            { name: 'runId', type: 'string' },
            { name: 'at', type: 'uint', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'tool-activity-id',
        fields: [{ name: 'id', type: 'string', required: true }]
    });
    ns.register({
        name: 'managed-skill',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'origin', type: 'string', required: true },
            { name: 'overridesBase', type: 'bool', required: true }
        ]
    });
    ns.register({
        name: 'managed-skills-response',
        fields: [{ name: 'skills', type: '@assistant/managed-skill', array: true, required: true }]
    });
    ns.register({
        name: 'list-managed-skills-request',
        fields: [{ name: 'agentId', type: 'string' }]
    });
    ns.register({
        name: 'skill-name-request',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'agentId', type: 'string' }
        ]
    });
    ns.register({
        name: 'skill-file-response',
        fields: [
            { name: 'found', type: 'bool', required: true },
            { name: 'content', type: 'string' },
            { name: 'origin', type: 'string' }
        ]
    });
    ns.register({
        name: 'write-skill-request',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'content', type: 'string', required: true },
            { name: 'agentId', type: 'string' }
        ]
    });
    ns.register({
        name: 'copy-skill-response',
        fields: [{ name: 'copied', type: 'bool', required: true }]
    });
    ns.register({
        name: 'delete-skill-response',
        fields: [{ name: 'removed', type: 'bool', required: true }]
    });
    ns.register({
        name: 'skill-overlay-op',
        fields: [
            { name: 'op', type: 'string', required: true },
            { name: 'agentId', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'content', type: 'string' }
        ]
    });
    ns.register({
        name: 'skill-overlay-handoff',
        fields: [
            { name: 'id', type: 'uint', required: true },
            { name: 'request', type: '@assistant/skill-overlay-op', required: true }
        ]
    });
    ns.register({
        name: 'skill-overlay-handoff-ack',
        fields: [
            { name: 'id', type: 'uint', required: true },
            { name: 'error', type: 'string' },
            { name: 'skills', type: '@assistant/managed-skill', array: true },
            { name: 'found', type: 'bool' },
            { name: 'content', type: 'string' },
            { name: 'origin', type: 'string' },
            { name: 'ok', type: 'bool' },
            { name: 'copied', type: 'bool' },
            { name: 'removed', type: 'bool' },
            { name: 'code', type: 'uint' }
        ]
    });
    ns.register({
        name: 'file-state',
        enum: ['uploading', 'pending', 'running', 'ready', 'failed', 'cancelled', 'not-applicable'],
        strings: true
    });
    ns.register({ name: 'file-progress-unit', enum: ['bytes', 'chunks'], strings: true });
    ns.register({
        name: 'file-progress',
        fields: [
            { name: 'completed', type: 'uint', required: true },
            { name: 'total', type: 'uint' },
            { name: 'unit', type: '@assistant/file-progress-unit', required: true }
        ]
    });
    ns.register({
        name: 'file-processor-status',
        fields: [
            { name: 'processorId', type: 'string', required: true },
            { name: 'state', type: '@assistant/file-state', required: true },
            { name: 'reason', type: 'string' },
            { name: 'retryAt', type: 'uint' },
            { name: 'claimedBy', type: 'buffer' },
            { name: 'agentId', type: 'string' },
            { name: 'expiresAt', type: 'uint' },
            { name: 'progress', type: '@assistant/file-progress' },
            { name: 'published', type: 'bool', required: true },
            { name: 'outputId', type: 'string' }
        ]
    });
    ns.register({
        name: 'file-status',
        fields: [
            { name: 'fileId', type: 'string', required: true },
            { name: 'chatId', type: 'string', required: true },
            { name: 'fileName', type: 'string', required: true },
            { name: 'mimeType', type: 'string', required: true },
            { name: 'state', type: '@assistant/file-state', required: true },
            { name: 'reason', type: 'string' },
            { name: 'uploadProgress', type: '@assistant/file-progress' },
            { name: 'processors', type: '@assistant/file-processor-status', array: true, required: true },
            { name: 'readyForChat', type: 'bool', required: true }
        ]
    });
    ns.register({
        name: 'file-status-list',
        fields: [{ name: 'files', type: '@assistant/file-status', array: true, required: true }]
    });
    ns.register({
        name: 'compact-chat-response',
        fields: [
            { name: 'compacted', type: 'bool', required: true },
            { name: 'reason', type: 'string' },
            { name: 'foldedTurns', type: 'uint' }
        ]
    });
    ns.register({
        name: 'notification-kind',
        enum: [
            'assistant-reply',
            'approval-required',
            'run-failed',
            'user-message',
            'model-downloaded'
        ],
        strings: true
    });
    ns.register({
        name: 'notification',
        fields: [
            { name: 'chatId', type: 'string', useDefault: false },
            { name: 'agentId', type: 'string', useDefault: false },
            { name: 'chunkId', type: 'string', useDefault: false },
            { name: 'kind', type: '@assistant/notification-kind', required: true },
            { name: 'seq', type: 'uint' },
            { name: 'createdAt', type: 'uint', required: true },
            { name: 'preview', type: 'string' },
            { name: 'agentName', type: 'string' },
            { name: 'senderDeviceId', type: 'buffer' },
            { name: 'senderMemberId', type: 'buffer' },
            { name: 'senderName', type: 'string' },
            { name: 'chatTitle', type: 'string' },
            { name: 'notificationId', type: 'string' },
            { name: 'modelName', type: 'string' }
        ]
    });
    ns.register({
        name: 'notification-list',
        fields: [
            { name: 'notifications', type: '@assistant/notification', array: true },
            { name: 'truncated', type: 'bool' }
        ]
    });
    ns.register({
        name: 'notification-request',
        fields: [
            { name: 'limit', type: 'uint' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'notification-ack',
        fields: [
            { name: 'notificationId', type: 'string' },
            { name: 'chatId', type: 'string', useDefault: false },
            { name: 'seq', type: 'uint' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'model-transfer-start',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'transferred', type: 'bool' }
        ]
    });
    ns.register({
        name: 'model-transfer',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'transferId', type: 'string', required: true },
            { name: 'downloaded', type: 'bool' }
        ]
    });
    ns.register({
        name: 'file-read-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'fileId', type: 'string', required: true },
            { name: 'metadataOnly', type: 'bool' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'file-read-frame',
        fields: [
            { name: 'metadata', type: '@assistant/chunk-content-attachment' },
            { name: 'data', type: 'buffer' },
            { name: 'bytesRead', type: 'uint' },
            { name: 'byteLength', type: 'uint' }
        ]
    });
    ns.register({
        name: 'file-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'fileId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'file-preview-response',
        fields: [
            { name: 'outputId', type: 'string' },
            { name: 'mimeType', type: 'string' },
            { name: 'data', type: 'buffer' }
        ]
    });
    ns.register({
        name: 'file-retry-request',
        fields: [
            { name: 'chatId', type: 'string' },
            { name: 'fileId', type: 'string', required: true },
            { name: 'processorId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'mesh-entry',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'state', type: '@assistant/mesh-status-state', required: true },
            { name: 'writable', type: 'bool', required: true },
            { name: 'open', type: 'bool', required: true },
            { name: 'account', type: 'bool', required: true },
            { name: 'label', type: 'string' },
            { name: 'members', type: 'uint' },
            { name: 'shared', type: 'bool' },
            { name: 'sharedAt', type: 'uint' },
            { name: 'compute', type: 'bool' },
            { name: 'reason', type: 'string' },
            { name: 'awaitingFrom', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'workspace', type: 'bool' },
            { name: 'served', type: 'bool' }
        ]
    });
    ns.register({
        name: 'mesh-label-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'label', type: 'string' }
        ]
    });
    ns.register({
        name: 'mesh-name-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'name', type: 'string' }
        ]
    });
    ns.register({
        name: 'mesh-list',
        fields: [{ name: 'meshes', type: '@assistant/mesh-entry', array: true }]
    });
    ns.register({
        name: 'account',
        fields: [
            { name: 'meshId', type: 'string' },
            { name: 'writable', type: 'bool', required: true },
            { name: 'displayName', type: 'string' },
            { name: 'ownWorkspace', type: 'string' }
        ]
    });
    ns.register({
        name: 'mesh-target',
        fields: [{ name: 'meshId', type: 'string', required: true }]
    });
    ns.register({
        name: 'mesh-scope',
        fields: [{ name: 'meshId', type: 'string', required: true }]
    });
    ns.register({
        name: 'room-config',
        fields: [{ name: 'compute', type: 'bool' }]
    });
    ns.register({
        name: 'create-room-request',
        fields: [{ name: 'config', type: '@assistant/room-config' }]
    });
    ns.register({
        name: 'mesh-seed-request',
        fields: [{ name: 'meshKey', type: 'fixed32', required: true }]
    });
    ns.register({
        name: 'mesh-seed-handoff',
        fields: [
            { name: 'id', type: 'uint', required: true },
            { name: 'request', type: '@assistant/mesh-seed-request', required: true }
        ]
    });
    ns.register({
        name: 'mesh-seed-handoff-ack',
        fields: [
            { name: 'id', type: 'uint', required: true },
            { name: 'error', type: 'string' },
            { name: 'seed', type: 'fixed32' },
            { name: 'admitted', type: 'bool' }
        ]
    });
    ns.register({
        name: 'mesh-admission-request',
        fields: [
            { name: 'meshKey', type: 'fixed32', required: true },
            { name: 'writerKey', type: 'fixed32', required: true },
            { name: 'joinedAt', type: 'uint' },
            { name: 'deviceSignature', type: 'buffer' },
            { name: 'memberSignature', type: 'buffer' },
            { name: 'inviteToken', type: 'fixed32' },
            { name: 'name', type: 'string' },
            { name: 'capabilityProfile', type: 'string' },
            { name: 'recommendedModelName', type: 'string' }
        ]
    });
    ns.register({
        name: 'mesh-admission-handoff',
        fields: [
            { name: 'id', type: 'uint', required: true },
            { name: 'request', type: '@assistant/mesh-admission-request', required: true }
        ]
    });
    ns.register({
        name: 'member-config',
        fields: [{ name: 'name', type: 'string', required: true }]
    });
    ns.register({
        name: 'update-member-request',
        fields: [{ name: 'config', type: '@assistant/member-config', required: true }]
    });
    ns.register({
        name: 'remove-member-request',
        fields: [
            { name: 'memberId', type: 'fixed32', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'archived-mesh-contents',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'chats', type: 'uint', required: true },
            { name: 'agents', type: 'uint', required: true },
            { name: 'knowledge', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'archived-mesh-migration',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'migrated', type: 'bool', required: true },
            { name: 'migratedAt', type: 'uint', required: true },
            { name: 'chats', type: 'uint', required: true },
            { name: 'agents', type: 'uint', required: true },
            { name: 'knowledge', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'archived-mesh',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'leftAt', type: 'uint', required: true },
            { name: 'wasAccount', type: 'bool', required: true },
            { name: 'migratedAt', type: 'uint' }
        ]
    });
    ns.register({
        name: 'archived-mesh-list',
        fields: [{ name: 'meshes', type: '@assistant/archived-mesh', array: true }]
    });
    ns.register({
        name: 'account-recovery-state',
        fields: [{ name: 'recoverable', type: 'bool', required: true }]
    });
    ns.register({
        name: 'display-name',
        fields: [{ name: 'name', type: 'string' }]
    });
    ns.register({
        name: 'local-file',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'chatId', type: 'string' },
            { name: 'attachmentId', type: 'string' },
            { name: 'blobId', type: 'string', required: true },
            { name: 'fileName', type: 'string' },
            { name: 'mimeType', type: 'string' },
            { name: 'byteLength', type: 'uint' },
            { name: 'own', type: 'bool', required: true },
            { name: 'lastAccessed', type: 'uint', required: true },
            { name: 'cleared', type: 'bool', required: true }
        ]
    });
    ns.register({
        name: 'local-file-list',
        fields: [{ name: 'files', type: '@assistant/local-file', array: true }]
    });
    ns.register({
        name: 'local-files-request',
        fields: [{ name: 'meshId', type: 'string' }]
    });
    ns.register({
        name: 'inference-call-entry',
        fields: [
            { name: 'runId', type: 'string', required: true },
            { name: 'at', type: 'uint', required: true },
            { name: 'call', type: 'json', required: true }
        ]
    });
    ns.register({
        name: 'inference-call-list',
        fields: [
            { name: 'calls', type: '@assistant/inference-call-entry', array: true },
            { name: 'truncated', type: 'bool' }
        ]
    });
    ns.register({
        name: 'inference-calls-request',
        fields: [{ name: 'chatId', type: 'string', required: true }]
    });
    ns.register({
        name: 'inference-calls-query',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'inference-calls-handoff',
        fields: [
            { name: 'id', type: 'uint', required: true },
            { name: 'request', type: '@assistant/inference-calls-request', required: true }
        ]
    });
    ns.register({
        name: 'inference-calls-handoff-ack',
        fields: [
            { name: 'id', type: 'uint', required: true },
            { name: 'error', type: 'string' },
            { name: 'calls', type: '@assistant/inference-call-entry', array: true },
            { name: 'truncated', type: 'bool' },
            { name: 'code', type: 'uint' }
        ]
    });
    ns.register({
        name: 'mesh-config',
        fields: [{ name: 'compute', type: 'bool' }]
    });
    ns.register({
        name: 'create-mesh-request',
        fields: [{ name: 'config', type: '@assistant/mesh-config' }]
    });
    ns.register({
        name: 'preview-mesh-invite-request',
        fields: [{ name: 'invite', type: 'string', required: true }]
    });
    ns.register({
        name: 'preview-mesh-invite-response',
        fields: [
            { name: 'memberInvite', type: 'bool', required: true },
            { name: 'inviterName', type: 'string' },
            { name: 'workspaceName', type: 'string' }
        ]
    });
    ns.register({
        name: 'load-model-request',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'deviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'load-model-response',
        fields: [
            { name: 'loaded', type: 'bool', required: true },
            { name: 'reason', type: 'string' }
        ]
    });
    ns.register({
        name: 'unload-model-request',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'deviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'unload-model-response',
        fields: [{ name: 'unloaded', type: 'bool', required: true }]
    });
    ns.register({
        name: 'model-use',
        enum: ['chat', 'image', 'music'],
        strings: true
    });
    ns.register({
        name: 'model-users-request',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'deviceId', type: 'fixed32' }
        ]
    });
    ns.register({
        name: 'model-user',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true },
            { name: 'agentName', type: 'string', required: true },
            { name: 'via', type: '@assistant/model-use', required: true }
        ]
    });
    ns.register({
        name: 'model-users',
        fields: [{ name: 'agents', type: '@assistant/model-user', array: true }]
    });
    ns.register({
        name: 'chunk-delta',
        fields: [
            { name: 'reset', type: 'bool', required: true },
            { name: 'chunks', type: '@assistant/chunk', array: true },
            { name: 'removed', type: 'string', array: true },
            { name: 'count', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'model-memory',
        fields: [
            { name: 'usableBytes', type: 'uint', required: true },
            { name: 'capPercent', type: 'uint', required: true },
            { name: 'capBytes', type: 'uint', required: true },
            { name: 'usedBytes', type: 'uint', required: true },
            { name: 'overCap', type: 'bool', required: true }
        ]
    });
    ns.register({ name: 'device-scope', fields: [{ name: 'deviceId', type: 'fixed32' }] });
    ns.register({
        name: 'delete-agent-request',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true },
            { name: 'keepChats', type: 'bool' }
        ]
    });
    ns.register({ name: 'agent-folder-access', enum: ['read', 'write'], strings: true });
    ns.register({
        name: 'agent-folder',
        fields: [
            { name: 'path', type: 'string', required: true },
            { name: 'access', type: '@assistant/agent-folder-access', required: true }
        ]
    });
    ns.register({
        name: 'agent-folders-request',
        fields: [{ name: 'agentId', type: 'string', required: true }]
    });
    ns.register({
        name: 'agent-folders',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'folders', type: '@assistant/agent-folder', array: true }
        ]
    });
    ns.register({
        name: 'add-agent-folder-request',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'path', type: 'string', required: true },
            { name: 'access', type: '@assistant/agent-folder-access', required: true }
        ]
    });
    ns.register({
        name: 'remove-agent-folder-request',
        fields: [
            { name: 'agentId', type: 'string', required: true },
            { name: 'path', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'workspace',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'name', type: 'string', required: true },
            { name: 'icon', type: 'string' }
        ]
    });
    ns.register({
        name: 'workspace-config',
        fields: [
            { name: 'name', type: 'string' },
            { name: 'icon', type: 'string' }
        ]
    });
    ns.register({
        name: 'create-workspace-request',
        fields: [{ name: 'config', type: '@assistant/workspace-config' }]
    });
    ns.register({
        name: 'update-workspace-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'config', type: '@assistant/workspace-config', required: true }
        ]
    });
    ns.register({
        name: 'member-role-config',
        fields: [{ name: 'role', type: 'string', required: true }]
    });
    ns.register({
        name: 'set-member-role-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'memberId', type: 'fixed32', required: true },
            { name: 'config', type: '@assistant/member-role-config', required: true }
        ]
    });
    ns.register({
        name: 'project',
        fields: [
            { name: 'projectId', type: 'string', required: true },
            { name: 'name', type: 'string', required: true },
            { name: 'memberIds', type: 'fixed32', array: true },
            { name: 'createdBy', type: 'fixed32' },
            { name: 'createdAt', type: 'uint', required: true },
            { name: 'updatedAt', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'project-list',
        fields: [{ name: 'projects', type: '@assistant/project', array: true }]
    });
    ns.register({ name: 'project-config', fields: [{ name: 'name', type: 'string' }] });
    ns.register({
        name: 'create-project-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'config', type: '@assistant/project-config', required: true }
        ]
    });
    ns.register({
        name: 'update-project-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'projectId', type: 'string', required: true },
            { name: 'config', type: '@assistant/project-config', required: true }
        ]
    });
    ns.register({
        name: 'project-member-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'projectId', type: 'string', required: true },
            { name: 'memberId', type: 'fixed32', required: true }
        ]
    });
    ns.register({
        name: 'delete-project-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'projectId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'set-chat-project-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true },
            { name: 'projectId', type: 'string' }
        ]
    });
    ns.register({
        name: 'project-order-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'projectIds', type: 'string', array: true }
        ]
    });
    ns.register({
        name: 'knowledge-cap-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'bytes', type: 'uint', required: true }
        ]
    });
    ns.register({ name: 'knowledge-source', enum: ['project', 'chat'], strings: true });
    ns.register({
        name: 'set-chat-knowledge-source-request',
        fields: [
            { name: 'chatId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true },
            { name: 'source', type: '@assistant/knowledge-source', required: true },
            { name: 'enabled', type: 'bool', required: true }
        ]
    });
    ns.register({
        name: 'model-request-request',
        fields: [
            { name: 'chunkId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'run-request-request',
        fields: [
            { name: 'chunkId', type: 'string', required: true },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'settle-model-request-request',
        fields: [
            { name: 'chunkId', type: 'string', required: true },
            { name: 'state', type: '@assistant/model-request-state', required: true },
            { name: 'result', type: 'json' },
            { name: 'reason', type: 'string' },
            { name: 'meshId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'host-run-log-begin-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'runId', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'host-run-log-begin-response',
        fields: [
            { name: 'generation', type: 'string', required: true },
            { name: 'digestKey', type: 'fixed32', required: true },
            { name: 'steps', type: 'json', required: true }
        ]
    });
    ns.register({
        name: 'host-run-log-append-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'runId', type: 'string', required: true },
            { name: 'generation', type: 'string', required: true },
            { name: 'step', type: 'json', required: true }
        ]
    });
    ns.register({
        name: 'host-run-log-release-request',
        fields: [
            { name: 'meshId', type: 'string', required: true },
            { name: 'runId', type: 'string', required: true },
            { name: 'generation', type: 'string', required: true }
        ]
    });
}
export function registerEngineApi(api) {
    api.register({
        name: 'config-get',
        request: { name: '@assistant/config-key', stream: false },
        response: { name: '@assistant/config-value', stream: false }
    });
    api.register({
        name: 'config-set',
        request: { name: '@assistant/config-set-request', stream: false },
        response: { name: '@assistant/config-set-response', stream: false }
    });
    api.register({
        name: 'config-watch',
        request: { name: '@assistant/config-key', stream: false },
        response: { name: '@assistant/config-value', stream: true }
    });
    api.register({
        name: 'create-agent',
        request: { name: '@assistant/create-agent-request', stream: false },
        response: { name: '@assistant/agent', stream: false }
    });
    api.register({
        name: 'list-agents',
        request: { name: '@assistant/list-agents-request', stream: false },
        response: { name: '@assistant/agent-list', stream: false }
    });
    api.register({
        name: 'get-agent',
        request: { name: '@assistant/agent-id', stream: false },
        response: { name: '@assistant/agent', stream: false }
    });
    api.register({
        name: 'update-agent',
        request: { name: '@assistant/update-agent-request', stream: false },
        response: { name: '@assistant/agent', stream: false }
    });
    api.register({
        name: 'delete-agent',
        request: { name: '@assistant/delete-agent-request', stream: false },
        response: { name: '@assistant/agent', stream: false }
    });
    api.register({
        name: 'agents-watch',
        request: { name: '@assistant/list-agents-request', stream: false },
        response: { name: '@assistant/agent-list', stream: true }
    });
    api.register({
        name: 'create-chat',
        request: { name: '@assistant/create-chat-request', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'list-chats',
        request: { name: '@assistant/list-chats-request', stream: false },
        response: { name: '@assistant/chat-list', stream: false }
    });
    api.register({
        name: 'get-chat',
        request: { name: '@assistant/chat-id', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'rename-chat',
        request: { name: '@assistant/rename-chat-request', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'set-chat-suggestion',
        request: { name: '@assistant/set-chat-suggestion-request', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'set-chat-rag-enabled',
        request: { name: '@assistant/set-chat-flag-request', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'set-chat-web-search-enabled',
        request: { name: '@assistant/set-chat-flag-request', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'delete-chat',
        request: { name: '@assistant/chat-id', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'chats-watch',
        request: { name: '@assistant/list-chats-request', stream: false },
        response: { name: '@assistant/chat-list', stream: true }
    });
    api.register({
        name: 'create-chat-group',
        request: { name: '@assistant/create-chat-group-request', stream: false },
        response: { name: '@assistant/chat-group', stream: false }
    });
    api.register({
        name: 'list-chat-groups',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/chat-group-list', stream: false }
    });
    api.register({
        name: 'rename-chat-group',
        request: { name: '@assistant/rename-chat-group-request', stream: false },
        response: { name: '@assistant/chat-group', stream: false }
    });
    api.register({
        name: 'delete-chat-group',
        request: { name: '@assistant/chat-group-id', stream: false },
        response: { name: '@assistant/chat-group', stream: false }
    });
    api.register({
        name: 'set-chat-group',
        request: { name: '@assistant/set-chat-group-request', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'list-chat-activity',
        request: { name: '@assistant/chat-activity-request', stream: false },
        response: { name: '@assistant/chat-activity-list', stream: false }
    });
    api.register({
        name: 'chat-activity-watch',
        request: { name: '@assistant/chat-activity-request', stream: false },
        response: { name: '@assistant/chat-activity-list', stream: true }
    });
    api.register({
        name: 'list-devices',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/device-list', stream: false }
    });
    api.register({
        name: 'devices-watch',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/device-list', stream: true }
    });
    api.register({
        name: 'save-device-capabilities',
        request: { name: '@assistant/save-device-capabilities-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'model-downloads-watch',
        request: { name: '@assistant/device-scope', stream: false },
        response: { name: '@assistant/model-download-list', stream: true }
    });
    api.register({
        name: 'set-model-download-status',
        request: { name: '@assistant/set-model-download-status-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'clear-model-download',
        request: { name: '@assistant/clear-model-download-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'custom-models-watch',
        request: { name: '@assistant/device-scope', stream: false },
        response: { name: '@assistant/custom-model-list', stream: true }
    });
    api.register({
        name: 'add-custom-model',
        request: { name: '@assistant/add-custom-model-request', stream: false },
        response: { name: '@assistant/add-custom-model-response', stream: false }
    });
    api.register({
        name: 'remove-custom-model',
        request: { name: '@assistant/remove-custom-model-request', stream: false },
        response: { name: '@assistant/delete-model-response', stream: false }
    });
    api.register({
        name: 'remove-device',
        request: { name: '@assistant/device-id', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'rename-device',
        request: { name: '@assistant/rename-device-request', stream: false },
        response: { name: '@assistant/device', stream: false }
    });
    api.register({
        name: 'save-device-profile',
        request: { name: '@assistant/save-device-profile-request', stream: false },
        response: { name: '@assistant/device', stream: false }
    });
    api.register({
        name: 'append-chunk',
        request: { name: '@assistant/append-chunk-request', stream: false },
        response: { name: '@assistant/chunk-id', stream: false }
    });
    api.register({
        name: 'update-chunk',
        request: { name: '@assistant/update-chunk-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'resolve-approval',
        request: { name: '@assistant/resolve-approval-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'list-chunks',
        request: { name: '@assistant/chunks-by-chat-request', stream: false },
        response: { name: '@assistant/chunk-list', stream: false }
    });
    api.register({
        name: 'chunks-watch',
        request: { name: '@assistant/chunks-by-chat-request', stream: false },
        response: { name: '@assistant/chunk-list', stream: true }
    });
    api.register({
        name: 'upload-attachment',
        request: { name: '@assistant/upload-attachment-request', stream: true },
        response: { name: '@assistant/upload-attachment-response', stream: true }
    });
    api.register({
        name: 'download-attachment',
        request: { name: '@assistant/download-attachment-request', stream: false },
        response: { name: '@assistant/download-attachment-response', stream: true }
    });
    api.register({
        name: 'delete-attachment',
        request: { name: '@assistant/delete-attachment-request', stream: false },
        response: { name: '@assistant/chunk', stream: false }
    });
    api.register({
        name: 'upload-knowledge',
        request: { name: '@assistant/upload-knowledge-request', stream: true },
        response: { name: '@assistant/upload-knowledge-response', stream: true }
    });
    api.register({
        name: 'list-knowledge',
        request: { name: '@assistant/knowledge-by-chat-request', stream: false },
        response: { name: '@assistant/knowledge-list', stream: false }
    });
    api.register({
        name: 'knowledge-watch',
        request: { name: '@assistant/knowledge-by-chat-request', stream: false },
        response: { name: '@assistant/knowledge-list', stream: true }
    });
    api.register({
        name: 'remove-knowledge',
        request: { name: '@assistant/remove-knowledge-request', stream: false },
        response: { name: '@assistant/knowledge', stream: false }
    });
    api.register({
        name: 'rag-search',
        request: { name: '@assistant/rag-search-request', stream: false },
        response: { name: '@assistant/rag-search-response', stream: false }
    });
    api.register({
        name: 'run-agent',
        request: { name: '@assistant/run-agent-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'send-message',
        request: { name: '@assistant/send-message-request', stream: false },
        response: { name: '@assistant/send-message-response', stream: false }
    });
    api.register({
        name: 'stop-run',
        request: { name: '@assistant/stop-run-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'mesh-status-watch',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/mesh-status', stream: true }
    });
    api.register({
        name: 'network-watch',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/network-status', stream: true }
    });
    api.register({
        name: 'device-info',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/device-info', stream: false }
    });
    api.register({
        name: 'store-identity-phrase',
        request: { name: '@assistant/identity-phrase', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'leave-mesh',
        request: { name: '@assistant/mesh-target', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'acknowledge-kicked',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'join-mesh',
        request: { name: '@assistant/join-mesh-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'cancel-mesh-join',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'suspend',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'resume',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'mesh-invite',
        request: { name: '@assistant/mesh-invite-request', stream: false },
        response: { name: '@assistant/mesh-invite-response', stream: false }
    });
    api.register({
        name: 'list-approval-rules',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/approval-rule-list', stream: false }
    });
    api.register({
        name: 'diagnostics',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/diagnostics', stream: false }
    });
    api.register({
        name: 'diagnostics-watch',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/diagnostics', stream: true }
    });
    api.register({
        name: 'run-requests-watch',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/chunk-list', stream: true }
    });
    api.register({
        name: 'list-models',
        request: { name: '@assistant/list-models-request', stream: false },
        response: { name: '@assistant/model-info-list', stream: false }
    });
    api.register({
        name: 'delete-model',
        request: { name: '@assistant/delete-model-request', stream: false },
        response: { name: '@assistant/delete-model-response', stream: false }
    });
    api.register({
        name: 'model-catalog-watch',
        request: { name: '@assistant/device-scope', stream: false },
        response: { name: '@assistant/model-catalog-revision', stream: true }
    });
    api.register({
        name: 'skills',
        request: { name: '@assistant/skill-request', stream: false },
        response: { name: '@assistant/skill-response', stream: false }
    });
    api.register({
        name: 'download-knowledge',
        request: { name: '@assistant/download-knowledge-request', stream: false },
        response: { name: '@assistant/download-knowledge-response', stream: true }
    });
    api.register({
        name: 'get-config',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/app-config', stream: false }
    });
    api.register({
        name: 'set-config',
        request: { name: '@assistant/app-config-update', stream: false },
        response: { name: '@assistant/app-config', stream: false }
    });
    api.register({
        name: 'set-model-paused',
        request: { name: '@assistant/set-model-paused-request', stream: false },
        response: { name: '@assistant/app-config', stream: false }
    });
    api.register({
        name: 'retry-model-download',
        request: { name: '@assistant/clear-model-download-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'config-watch-typed',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/app-config', stream: true }
    });
    api.register({
        name: 'logs-watch',
        request: { name: '@assistant/logs-watch-request', stream: false },
        response: { name: '@assistant/log-line-list', stream: true }
    });
    api.register({
        name: 'write-log',
        request: { name: '@assistant/write-log-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'list-indexing',
        request: { name: '@assistant/knowledge-by-chat-request', stream: false },
        response: { name: '@assistant/indexing-status-list', stream: false }
    });
    api.register({
        name: 'transcribe',
        request: { name: '@assistant/transcribe-request', stream: false },
        response: { name: '@assistant/transcribe-response', stream: false }
    });
    api.register({
        name: 'speak',
        request: { name: '@assistant/speak-request', stream: false },
        response: { name: '@assistant/speak-response', stream: false }
    });
    api.register({
        name: 'skill-catalog',
        request: { name: '@assistant/skill-request', stream: false },
        response: { name: '@assistant/skill-catalog-response', stream: false }
    });
    api.register({
        name: 'tools',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/tool-catalog-response', stream: false }
    });
    api.register({
        name: 'speak-stream',
        request: { name: '@assistant/speak-stream-frame', stream: true },
        response: { name: '@assistant/speak-response', stream: true }
    });
    api.register({
        name: 'indexing-progress-watch',
        request: { name: '@assistant/knowledge-by-chat-request', stream: false },
        response: { name: '@assistant/indexing-progress-list', stream: true }
    });
    api.register({
        name: 'indexing-watch',
        request: { name: '@assistant/knowledge-by-chat-request', stream: false },
        response: { name: '@assistant/indexing-status-list', stream: true }
    });
    api.register({
        name: 'transcode-image',
        request: { name: '@assistant/transcode-image-request', stream: false },
        response: { name: '@assistant/transcode-image-response', stream: false }
    });
    api.register({
        name: 'sync-status-watch',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/sync-status', stream: true }
    });
    api.register({
        name: 'set-tool-configs',
        request: { name: '@assistant/set-tool-configs-request', stream: false },
        response: { name: '@assistant/tool-configs', stream: false }
    });
    api.register({
        name: 'delete-tool-configs',
        request: { name: '@assistant/delete-tool-configs-request', stream: false },
        response: { name: '@assistant/tool-configs', stream: false }
    });
    api.register({
        name: 'list-tool-configs',
        request: { name: '@assistant/list-tool-configs-request', stream: false },
        response: { name: '@assistant/tool-configs-list', stream: false }
    });
    api.register({
        name: 'tool-configs-watch',
        request: { name: '@assistant/list-tool-configs-request', stream: false },
        response: { name: '@assistant/tool-configs-list', stream: true }
    });
    api.register({
        name: 'list-attachments-by-kind',
        request: { name: '@assistant/attachments-by-kind-request', stream: false },
        response: { name: '@assistant/chunk-list', stream: false }
    });
    api.register({
        name: 'search-chats',
        request: { name: '@assistant/search-chats-request', stream: false },
        response: { name: '@assistant/search-chats-response', stream: false }
    });
    api.register({
        name: 'list-tool-activity',
        request: { name: '@assistant/list-tool-activity-request', stream: false },
        response: { name: '@assistant/tool-activity-list', stream: false }
    });
    api.register({
        name: 'tool-activity-watch',
        request: { name: '@assistant/list-tool-activity-request', stream: false },
        response: { name: '@assistant/tool-activity-list', stream: true }
    });
    api.register({
        name: 'record-tool-activity',
        request: { name: '@assistant/record-tool-activity-request', stream: false },
        response: { name: '@assistant/tool-activity-id', stream: false }
    });
    api.register({
        name: 'clear-kv-cache',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/kv-cache-deletion-response', stream: false }
    });
    api.register({
        name: 'list-managed-skills',
        request: { name: '@assistant/list-managed-skills-request', stream: false },
        response: { name: '@assistant/managed-skills-response', stream: false }
    });
    api.register({
        name: 'read-skill-file',
        request: { name: '@assistant/skill-name-request', stream: false },
        response: { name: '@assistant/skill-file-response', stream: false }
    });
    api.register({
        name: 'write-skill-file',
        request: { name: '@assistant/write-skill-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'copy-skill-for-edit',
        request: { name: '@assistant/skill-name-request', stream: false },
        response: { name: '@assistant/copy-skill-response', stream: false }
    });
    api.register({
        name: 'delete-overlay-skill',
        request: { name: '@assistant/skill-name-request', stream: false },
        response: { name: '@assistant/delete-skill-response', stream: false }
    });
    api.register({
        name: 'push-skill-secret',
        request: { name: '@assistant/push-skill-secret-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'file-status-watch',
        request: { name: '@assistant/knowledge-by-chat-request', stream: false },
        response: { name: '@assistant/file-status-list', stream: true }
    });
    api.register({
        name: 'compact-chat',
        request: { name: '@assistant/chat-id', stream: false },
        response: { name: '@assistant/compact-chat-response', stream: false }
    });
    api.register({
        name: 'notifications-watch',
        request: { name: '@assistant/notification-request', stream: false },
        response: { name: '@assistant/notification-list', stream: true }
    });
    api.register({
        name: 'ack-notification',
        request: { name: '@assistant/notification-ack', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'begin-model-transfer',
        request: { name: '@assistant/model-transfer-start', stream: false },
        response: { name: '@assistant/model-transfer', stream: false }
    });
    api.register({
        name: 'complete-model-transfer',
        request: { name: '@assistant/model-transfer', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'delete-chat-kv-cache',
        request: { name: '@assistant/kv-cache-chat-id', stream: false },
        response: { name: '@assistant/kv-cache-deletion-response', stream: false }
    });
    api.register({
        name: 'file-read',
        request: { name: '@assistant/file-read-request', stream: false },
        response: { name: '@assistant/file-read-frame', stream: true }
    });
    api.register({
        name: 'file-preview',
        request: { name: '@assistant/file-request', stream: false },
        response: { name: '@assistant/file-preview-response', stream: false }
    });
    api.register({
        name: 'file-retry',
        request: { name: '@assistant/file-retry-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'move-chat',
        request: { name: '@assistant/move-chat-request', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'move-chat-group',
        request: { name: '@assistant/move-chat-group-request', stream: false },
        response: { name: '@assistant/chat-group', stream: false }
    });
    api.register({
        name: 'list-members',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/member-list', stream: false }
    });
    api.register({
        name: 'list-meshes',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/mesh-list', stream: false }
    });
    api.register({
        name: 'meshes-watch',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/mesh-list', stream: true }
    });
    api.register({
        name: 'account',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/account', stream: false }
    });
    api.register({
        name: 'account-watch',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/account', stream: true }
    });
    api.register({
        name: 'open-mesh',
        request: { name: '@assistant/mesh-target', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'close-mesh',
        request: { name: '@assistant/mesh-target', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'set-mesh-label',
        request: { name: '@assistant/mesh-label-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'create-room',
        request: { name: '@assistant/create-room-request', stream: false },
        response: { name: '@assistant/mesh-target', stream: false }
    });
    api.register({
        name: 'sort-chat-groups-by-name',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/chat-group-list', stream: false }
    });
    api.register({
        name: 'members-watch',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/member-list', stream: true }
    });
    api.register({
        name: 'update-member',
        request: { name: '@assistant/update-member-request', stream: false },
        response: { name: '@assistant/member', stream: false }
    });
    api.register({
        name: 'remove-member',
        request: { name: '@assistant/remove-member-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'archived-mesh-contents',
        request: { name: '@assistant/mesh-target', stream: false },
        response: { name: '@assistant/archived-mesh-contents', stream: false }
    });
    api.register({
        name: 'migrate-archived-mesh',
        request: { name: '@assistant/mesh-target', stream: false },
        response: { name: '@assistant/archived-mesh-migration', stream: false }
    });
    api.register({
        name: 'list-archived-meshes',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/archived-mesh-list', stream: false }
    });
    api.register({
        name: 'account-recoverable',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/account-recovery-state', stream: false }
    });
    api.register({
        name: 'recovery-publish',
        request: { name: '@assistant/identity-phrase', stream: false },
        response: { name: '@assistant/account-recovery-state', stream: false }
    });
    api.register({
        name: 'recover-account',
        request: { name: '@assistant/identity-phrase', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'display-name',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/display-name', stream: false }
    });
    api.register({
        name: 'set-display-name',
        request: { name: '@assistant/display-name', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'inference-calls',
        request: { name: '@assistant/inference-calls-query', stream: false },
        response: { name: '@assistant/inference-call-list', stream: false }
    });
    api.register({
        name: 'list-local-files',
        request: { name: '@assistant/local-files-request', stream: false },
        response: { name: '@assistant/local-file-list', stream: false }
    });
    api.register({
        name: 'get-default-agent',
        request: { name: '@assistant/default-agent-request', stream: false },
        response: { name: '@assistant/default-agent', stream: false }
    });
    api.register({
        name: 'get-device',
        request: { name: '@assistant/device-id', stream: false },
        response: { name: '@assistant/device', stream: false }
    });
    api.register({
        name: 'detect-language',
        request: { name: '@assistant/detect-language-request', stream: false },
        response: { name: '@assistant/detect-language-response', stream: false }
    });
    api.register({
        name: 'create-mesh',
        request: { name: '@assistant/create-mesh-request', stream: false },
        response: { name: '@assistant/mesh-target', stream: false }
    });
    api.register({
        name: 'preview-mesh-invite',
        request: { name: '@assistant/preview-mesh-invite-request', stream: false },
        response: { name: '@assistant/preview-mesh-invite-response', stream: false }
    });
    api.register({
        name: 'load-model',
        request: { name: '@assistant/load-model-request', stream: false },
        response: { name: '@assistant/load-model-response', stream: false }
    });
    api.register({
        name: 'unload-model',
        request: { name: '@assistant/unload-model-request', stream: false },
        response: { name: '@assistant/unload-model-response', stream: false }
    });
    api.register({
        name: 'set-model-released',
        request: { name: '@assistant/set-model-released-request', stream: false },
        response: { name: '@assistant/app-config', stream: false }
    });
    api.register({
        name: 'preview-custom-model',
        request: { name: '@assistant/preview-custom-model-request', stream: false },
        response: { name: '@assistant/custom-model-preview', stream: false }
    });
    api.register({
        name: 'model-users',
        request: { name: '@assistant/model-users-request', stream: false },
        response: { name: '@assistant/model-users', stream: false }
    });
    api.register({
        name: 'mark-chat-read',
        request: { name: '@assistant/chat-id', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'models-watch',
        request: { name: '@assistant/list-models-request', stream: false },
        response: { name: '@assistant/model-info-list', stream: true }
    });
    api.register({
        name: 'set-mesh-name',
        request: { name: '@assistant/mesh-name-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'set-chat-agent',
        request: { name: '@assistant/set-chat-agent-request', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'move-chat-to-mesh',
        request: { name: '@assistant/move-chat-to-mesh-request', stream: false },
        response: { name: '@assistant/chat-move', stream: false }
    });
    api.register({
        name: 'chat-move-watch',
        request: { name: '@assistant/chat-id', stream: false },
        response: { name: '@assistant/chat-move', stream: true }
    });
    api.register({
        name: 'chunks-delta-watch',
        request: { name: '@assistant/chunks-by-chat-request', stream: false },
        response: { name: '@assistant/chunk-delta', stream: true }
    });
    api.register({
        name: 'set-auto-download-models',
        request: { name: '@assistant/set-auto-download-models-request', stream: false },
        response: { name: '@assistant/app-config', stream: false }
    });
    api.register({
        name: 'fork-chat',
        request: { name: '@assistant/fork-chat-request', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'set-blind-peering',
        request: { name: '@assistant/blind-peering', stream: false },
        response: { name: '@assistant/blind-peering', stream: false }
    });
    api.register({
        name: 'blind-peering-watch',
        request: { name: '@assistant/empty', stream: false },
        response: { name: '@assistant/blind-peering', stream: true }
    });
    api.register({
        name: 'list-agent-folders',
        request: { name: '@assistant/agent-folders-request', stream: false },
        response: { name: '@assistant/agent-folders', stream: false }
    });
    api.register({
        name: 'add-agent-folder',
        request: { name: '@assistant/add-agent-folder-request', stream: false },
        response: { name: '@assistant/agent-folders', stream: false }
    });
    api.register({
        name: 'remove-agent-folder',
        request: { name: '@assistant/remove-agent-folder-request', stream: false },
        response: { name: '@assistant/agent-folders', stream: false }
    });
    api.register({
        name: 'create-workspace',
        request: { name: '@assistant/create-workspace-request', stream: false },
        response: { name: '@assistant/workspace', stream: false }
    });
    api.register({
        name: 'get-workspace',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/workspace', stream: false }
    });
    api.register({
        name: 'workspace-watch',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/workspace', stream: true }
    });
    api.register({
        name: 'update-workspace',
        request: { name: '@assistant/update-workspace-request', stream: false },
        response: { name: '@assistant/workspace', stream: false }
    });
    api.register({
        name: 'set-member-role',
        request: { name: '@assistant/set-member-role-request', stream: false },
        response: { name: '@assistant/member', stream: false }
    });
    api.register({
        name: 'create-project',
        request: { name: '@assistant/create-project-request', stream: false },
        response: { name: '@assistant/project', stream: false }
    });
    api.register({
        name: 'list-projects',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/project-list', stream: false }
    });
    api.register({
        name: 'projects-watch',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/project-list', stream: true }
    });
    api.register({
        name: 'update-project',
        request: { name: '@assistant/update-project-request', stream: false },
        response: { name: '@assistant/project', stream: false }
    });
    api.register({
        name: 'add-project-member',
        request: { name: '@assistant/project-member-request', stream: false },
        response: { name: '@assistant/project', stream: false }
    });
    api.register({
        name: 'remove-project-member',
        request: { name: '@assistant/project-member-request', stream: false },
        response: { name: '@assistant/project', stream: false }
    });
    api.register({
        name: 'set-chat-project',
        request: { name: '@assistant/set-chat-project-request', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'leave-workspace',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'list-knowledge-base',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/knowledge-base-list', stream: false }
    });
    api.register({
        name: 'knowledge-base-watch',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/knowledge-base-list', stream: true }
    });
    api.register({
        name: 'file-knowledge',
        request: { name: '@assistant/file-knowledge-request', stream: false },
        response: { name: '@assistant/knowledge', stream: false }
    });
    api.register({
        name: 'set-project-order',
        request: { name: '@assistant/project-order-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'delete-project',
        request: { name: '@assistant/delete-project-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'set-knowledge-cap',
        request: { name: '@assistant/knowledge-cap-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'get-knowledge',
        request: { name: '@assistant/knowledge-request', stream: false },
        response: { name: '@assistant/knowledge', stream: false }
    });
    api.register({
        name: 'set-chat-knowledge-source',
        request: { name: '@assistant/set-chat-knowledge-source-request', stream: false },
        response: { name: '@assistant/chat', stream: false }
    });
    api.register({
        name: 'take-model-request',
        request: { name: '@assistant/model-request-request', stream: false },
        response: { name: '@assistant/chunk', stream: false }
    });
    api.register({
        name: 'settle-model-request',
        request: { name: '@assistant/settle-model-request-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'cancel-model-request',
        request: { name: '@assistant/model-request-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'reopen-model-request',
        request: { name: '@assistant/model-request-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'model-requests-watch',
        request: { name: '@assistant/mesh-scope', stream: false },
        response: { name: '@assistant/chunk-list', stream: true }
    });
    api.register({
        name: 'share-agent',
        request: { name: '@assistant/agent-id', stream: false },
        response: { name: '@assistant/agent', stream: false }
    });
    api.register({
        name: 'unshare-agent',
        request: { name: '@assistant/agent-id', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'host-run-log-begin',
        request: { name: '@assistant/host-run-log-begin-request', stream: false },
        response: { name: '@assistant/host-run-log-begin-response', stream: false }
    });
    api.register({
        name: 'host-run-log-append',
        request: { name: '@assistant/host-run-log-append-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'host-run-log-release',
        request: { name: '@assistant/host-run-log-release-request', stream: false },
        response: { name: '@assistant/ok-response', stream: false }
    });
    api.register({
        name: 'take-run-request',
        request: { name: '@assistant/run-request-request', stream: false },
        response: { name: '@assistant/chunk', stream: false }
    });
}
