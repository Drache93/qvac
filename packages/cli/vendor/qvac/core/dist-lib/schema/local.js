import { versionedRegistrar } from './content.js';
import { CAPABILITY_PROFILES } from './qvac.js';
export function registerLocalTypes(ns) {
    const versioned = versionedRegistrar(ns, 'local');
    ns.register({
        name: 'qvac-state',
        enum: ['RESUME', 'WAKEUP', 'PRESUSPEND', 'SUSPEND']
    });
    versioned('config', [
        { name: 'key', type: 'string', required: true },
        { name: 'value', type: 'json' }
    ]);
    versioned('mesh-session', [
        { name: 'deviceId', type: 'buffer', required: true },
        { name: 'meshCreator', type: 'bool' },
        { name: 'meshKey', type: 'buffer' },
        { name: 'meshSeed', type: 'buffer' }
    ]);
    versioned('mesh-history', [
        { name: 'key', type: 'buffer', required: true },
        { name: 'seed', type: 'buffer', required: true },
        { name: 'creator', type: 'bool' },
        { name: 'writerSeed', type: 'string' }
    ]);
    versioned('device', [
        { name: 'publicKey', type: 'buffer', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'capabilityProfile', type: '@local/capability-profile', required: true },
        { name: 'recommendedModelName', type: 'string', required: true },
        { name: 'platform', type: 'string' }
    ]);
    versioned('app-config', [
        { name: 'id', type: 'string', required: true },
        { name: 'activeAgentId', type: 'string' },
        { name: 'activeChatId', type: 'string' },
        { name: 'thinkingEnabled', type: 'bool' },
        { name: 'ctxSize', type: 'uint' },
        { name: 'lastModelName', type: 'string' },
        { name: 'onboardingCompleted', type: 'bool' },
        { name: 'delegation', type: 'json' },
        { name: 'pausedModels', type: 'string', array: true },
        { name: 'releasedModels', type: 'string', array: true },
        { name: 'manualModelDownloads', type: 'bool' }
    ]);
    ns.register({
        name: 'model-download-phase',
        enum: ['queued', 'downloading', 'paused', 'error', 'held'],
        strings: true
    });
    versioned('model-download', [
        { name: 'name', type: 'string', required: true },
        { name: 'phase', type: '@local/model-download-phase', required: true },
        { name: 'percentage', type: 'uint' },
        { name: 'error', type: 'string' },
        { name: 'updatedAt', type: 'uint', required: true },
        { name: 'downloaded', type: 'uint' },
        { name: 'total', type: 'uint' },
        { name: 'bytesPerSecond', type: 'uint' }
    ]);
    versioned('custom-model', [
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
    ]);
    versioned('identity', [
        { name: 'id', type: 'string', required: true },
        { name: 'publicKey', type: 'buffer', required: true },
        { name: 'proof', type: 'buffer', required: true },
        { name: 'createdAt', type: 'uint', required: true },
        { name: 'displayName', type: 'string' },
        { name: 'displayNameAt', type: 'uint' }
    ]);
    versioned('membership', [
        { name: 'id', type: 'string', required: true },
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'proof', type: 'buffer', required: true },
        { name: 'attestedAt', type: 'uint', required: true }
    ]);
    versioned('chat-notify', [
        { name: 'chatId', type: 'string', required: true },
        { name: 'ackedThrough', type: 'uint', required: true }
    ]);
    versioned('model-notify', [
        { name: 'name', type: 'string', required: true },
        { name: 'transferId', type: 'string', required: true },
        { name: 'notificationId', type: 'string' },
        { name: 'completedAt', type: 'uint' },
        { name: 'acknowledged', type: 'bool' },
        { name: 'transferred', type: 'bool' }
    ]);
    versioned('mesh-departure', [
        { name: 'key', type: 'buffer', required: true },
        { name: 'seed', type: 'buffer', required: true },
        { name: 'creator', type: 'bool' },
        { name: 'writerSeed', type: 'string' },
        { name: 'role', type: 'string' }
    ]);
    versioned('active-mesh', [
        { name: 'deviceId', type: 'fixed32', required: true },
        { name: 'activeMeshKey', type: 'fixed32' },
        { name: 'homeMeshKey', type: 'fixed32' }
    ]);
    versioned('mesh-membership', [
        { name: 'key', type: 'fixed32', required: true },
        { name: 'seed', type: 'fixed32', required: true },
        { name: 'writerSeed', type: 'string' },
        { name: 'leftAt', type: 'uint' },
        { name: 'wasHome', type: 'bool' },
        { name: 'migratedAt', type: 'uint' },
        { name: 'compute', type: 'bool' },
        { name: 'awaitingAdmission', type: 'bool' },
        { name: 'role', type: 'string' },
        { name: 'workspaceKey', type: 'fixed32' }
    ]);
    versioned('member-proof', [
        { name: 'meshKey', type: 'fixed32', required: true },
        { name: 'memberId', type: 'fixed32', required: true },
        { name: 'proof', type: 'buffer', required: true },
        { name: 'attestedAt', type: 'uint', required: true }
    ]);
    versioned('account-recovery', [
        { name: 'meshKey', type: 'fixed32', required: true },
        { name: 'coreKey', type: 'fixed32', required: true },
        { name: 'publishedAt', type: 'uint', required: true }
    ]);
    versioned('chat-order', [
        { name: 'meshKey', type: 'fixed32', required: true },
        { name: 'chatId', type: 'string', required: true },
        { name: 'sortKey', type: 'buffer', required: true }
    ]);
    versioned('file', [
        { name: 'meshKey', type: 'fixed32', required: true },
        { name: 'coreKey', type: 'fixed32', required: true },
        { name: 'blockOffset', type: 'uint', required: true },
        { name: 'blobId', type: 'string', required: true },
        { name: 'chatId', type: 'string' },
        { name: 'attachmentId', type: 'string' },
        { name: 'fileName', type: 'string' },
        { name: 'mimeType', type: 'string' },
        { name: 'byteLength', type: 'uint' },
        { name: 'own', type: 'bool', required: true },
        { name: 'lastAccessed', type: 'uint', required: true },
        { name: 'cleared', type: 'bool', required: true },
        { name: 'deletedAt', type: 'uint' }
    ]);
    versioned('chat-move', [
        { name: 'meshKey', type: 'fixed32', required: true },
        { name: 'chatId', type: 'string', required: true },
        { name: 'targetMeshKey', type: 'fixed32', required: true },
        { name: 'targetChatId', type: 'string', required: true },
        { name: 'agentId', type: 'string', required: true },
        { name: 'carried', type: 'uint', required: true },
        { name: 'restartRunId', type: 'string' },
        { name: 'startedAt', type: 'uint', required: true },
        { name: 'completedAt', type: 'uint' },
        { name: 'failure', type: 'string' }
    ]);
    ns.register({ name: 'capability-profile', enum: CAPABILITY_PROFILES, strings: true });
    versioned('mesh-update', [
        { name: 'meshKey', type: 'fixed32', required: true },
        { name: 'fromKey', type: 'fixed32' },
        { name: 'fromLength', type: 'uint' },
        { name: 'incremental', type: 'bool', required: true }
    ]);
    versioned('mesh-purge', [
        { name: 'key', type: 'fixed32', required: true },
        { name: 'cores', type: 'fixed32', array: true }
    ]);
    versioned('mesh-name', [
        { name: 'meshKey', type: 'fixed32', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'namedAt', type: 'uint', required: true }
    ]);
    versioned('run-log', [
        { name: 'meshKey', type: 'fixed32', required: true },
        { name: 'runId', type: 'string', required: true },
        { name: 'generation', type: 'string' },
        { name: 'nextSeq', type: 'uint', required: true },
        { name: 'length', type: 'uint', required: true },
        { name: 'digestKey', type: 'fixed32', required: true },
        { name: 'updatedAt', type: 'uint', required: true }
    ]);
    versioned('run-log-step', [
        { name: 'meshKey', type: 'fixed32', required: true },
        { name: 'runId', type: 'string', required: true },
        { name: 'seq', type: 'uint', required: true },
        { name: 'step', type: 'json', required: true }
    ]);
}
export function registerLocalCollections(dbns, helpersPath) {
    dbns.require(helpersPath);
    dbns.collections.register({ name: 'config', schema: '@local/config', key: ['key'] });
    dbns.collections.register({
        name: 'mesh-session',
        schema: '@local/mesh-session',
        key: ['deviceId']
    });
    dbns.collections.register({
        name: 'mesh-history',
        schema: '@local/mesh-history',
        key: ['key']
    });
    dbns.collections.register({ name: 'device', schema: '@local/device', key: ['publicKey'] });
    dbns.collections.register({ name: 'app-config', schema: '@local/app-config', key: ['id'] });
    dbns.collections.register({
        name: 'model-download',
        schema: '@local/model-download',
        key: ['name']
    });
    dbns.collections.register({
        name: 'custom-model',
        schema: '@local/custom-model',
        key: ['name']
    });
    dbns.collections.register({ name: 'identity', schema: '@local/identity', key: ['id'] });
    dbns.collections.register({ name: 'membership', schema: '@local/membership', key: ['id'] });
    dbns.collections.register({ name: 'chat-notify', schema: '@local/chat-notify', key: ['chatId'] });
    dbns.collections.register({ name: 'model-notify', schema: '@local/model-notify', key: ['name'] });
    dbns.collections.register({
        name: 'mesh-departure',
        schema: '@local/mesh-departure',
        key: ['key']
    });
    dbns.collections.register({
        name: 'active-mesh',
        schema: '@local/active-mesh',
        key: ['deviceId']
    });
    dbns.collections.register({
        name: 'mesh-membership',
        schema: '@local/mesh-membership',
        key: ['key']
    });
    dbns.collections.register({
        name: 'member-proof',
        schema: '@local/member-proof',
        key: ['meshKey']
    });
    dbns.collections.register({
        name: 'account-recovery',
        schema: '@local/account-recovery',
        key: ['meshKey']
    });
    dbns.collections.register({
        name: 'chat-order',
        schema: '@local/chat-order',
        key: ['meshKey', 'chatId']
    });
    dbns.indexes.register({
        name: 'chat-order-by-key',
        collection: '@local/chat-order',
        unique: false,
        key: ['meshKey', 'sortKey', 'chatId']
    });
    dbns.collections.register({
        name: 'files',
        schema: '@local/file',
        key: ['meshKey', 'coreKey', 'blockOffset']
    });
    dbns.indexes.register({
        name: 'files-by-blob',
        collection: '@local/files',
        unique: false,
        key: ['coreKey', 'blockOffset']
    });
    dbns.indexes.register({
        name: 'reclaimable-files-by-last-accessed',
        collection: '@local/files',
        unique: false,
        key: {
            type: { fields: [{ name: 'lastAccessed', type: 'uint' }] },
            map: 'reclaimableFilesMap'
        }
    });
    dbns.indexes.register({
        name: 'live-files',
        collection: '@local/files',
        unique: false,
        key: {
            type: {
                fields: [
                    { name: 'meshKey', type: 'fixed32' },
                    { name: 'coreKey', type: 'fixed32' },
                    { name: 'blockOffset', type: 'uint' }
                ]
            },
            map: 'liveFilesMap'
        }
    });
    dbns.collections.register({
        name: 'chat-moves',
        schema: '@local/chat-move',
        key: ['meshKey', 'chatId']
    });
    dbns.collections.register({
        name: 'mesh-updates',
        schema: '@local/mesh-update',
        key: ['meshKey']
    });
    dbns.collections.register({ name: 'mesh-purges', schema: '@local/mesh-purge', key: ['key'] });
    dbns.collections.register({ name: 'mesh-names', schema: '@local/mesh-name', key: ['meshKey'] });
    dbns.collections.register({
        name: 'run-logs',
        schema: '@local/run-log',
        key: ['meshKey', 'runId']
    });
    dbns.collections.register({
        name: 'run-log-steps',
        schema: '@local/run-log-step',
        key: ['meshKey', 'runId', 'seq']
    });
}
