export function registerHarnessTypes(ns) {
    ns.register({ name: 'empty', fields: [] });
    ns.register({ name: 'ok-response', fields: [{ name: 'ok', type: 'bool', required: true }] });
    ns.register({ name: 'reasoning', enum: ['inherit', 'enabled', 'disabled'], strings: true });
    ns.register({ name: 'embedding-device', enum: ['gpu', 'cpu'], strings: true });
    ns.register({ name: 'approval-mode', enum: ['ask', 'skip-all'], strings: true });
    ns.register({
        name: 'agent-handoff',
        fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'description', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'agent-knobs',
        fields: [
            { name: 'id', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'bio', type: 'string' },
            { name: 'reasoning', type: '@harness/reasoning' },
            { name: 'enabledTools', type: 'string', array: true },
            { name: 'enabledSkills', type: 'string', array: true },
            { name: 'ctxSize', type: 'uint' },
            { name: 'kvCacheK', type: 'string' },
            { name: 'kvCacheV', type: 'string' },
            { name: 'toolsScope', type: 'string' },
            { name: 'skillsScope', type: 'string' },
            { name: 'imageModelChoice', type: 'string' },
            { name: 'imageSteps', type: 'uint' },
            { name: 'imageWidth', type: 'uint' },
            { name: 'imageHeight', type: 'uint' },
            { name: 'approvalMode', type: '@harness/approval-mode' },
            { name: 'disabledToolsets', type: 'string', array: true },
            { name: 'sandboxMode', type: 'bool' },
            { name: 'handoffs', type: '@harness/agent-handoff', array: true },
            { name: 'plan', type: 'bool' },
            { name: 'model', type: 'string' },
            { name: 'policy', type: 'json' }
        ]
    });
    ns.register({
        name: 'message-role',
        enum: ['system', 'user', 'assistant', 'tool'],
        strings: true
    });
    ns.register({
        name: 'message-attachment',
        fields: [{ name: 'path', type: 'string', required: true }]
    });
    ns.register({
        name: 'message',
        fields: [
            { name: 'role', type: '@harness/message-role', required: true },
            { name: 'content', type: 'string', required: true },
            { name: 'attachments', type: '@harness/message-attachment', array: true },
            { name: 'sentAt', type: 'uint' },
            { name: 'toolCalls', type: 'json' },
            { name: 'toolCallId', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'id', type: 'string' },
            { name: 'context', type: 'json' }
        ]
    });
    ns.register({
        name: 'resource',
        fields: [
            { name: 'kind', type: 'string', required: true },
            { name: 'label', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'attachment-record',
        fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'fileName', type: 'string', required: true },
            { name: 'mimeType', type: 'string', required: true },
            { name: 'byteLength', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'completion-frame-type',
        enum: [
            'start',
            'decision',
            'attach-result',
            'fetch-result',
            'rag-result',
            'question-result',
            'drive-result',
            'invoke',
            'run-log-result',
            'pause',
            'steer',
            'follow-up',
            'model-round-ask',
            'model-round-chunk',
            'model-round-retake',
            'model-round-result',
            'round-cut'
        ],
        strings: true
    });
    ns.register({
        name: 'granted-drive',
        fields: [
            { name: 'key', type: 'string', required: true },
            { name: 'writable', type: 'bool' },
            { name: 'search', type: 'bool' }
        ]
    });
    ns.register({
        name: 'completion-frame',
        fields: [
            { name: 'type', type: '@harness/completion-frame-type', required: true },
            { name: 'model', type: 'string' },
            { name: 'agent', type: '@harness/agent-knobs' },
            { name: 'messages', type: '@harness/message', array: true },
            { name: 'callId', type: 'string' },
            { name: 'approved', type: 'bool' },
            { name: 'attachment', type: '@harness/attachment-record' },
            { name: 'path', type: 'string' },
            { name: 'fileName', type: 'string' },
            { name: 'mimeType', type: 'string' },
            { name: 'attachmentId', type: 'string' },
            { name: 'message', type: 'string' },
            { name: 'result', type: 'json' },
            { name: 'answer', type: 'string' },
            { name: 'cacheKey', type: 'string' },
            { name: 'thinkingDefault', type: 'string' },
            { name: 'byteLength', type: 'uint' },
            { name: 'meta', type: 'bool' },
            { name: 'size', type: 'uint' },
            { name: 'toolConfigs', type: 'json' },
            { name: 'generationParams', type: 'json' },
            { name: 'responseFormat', type: 'json' },
            { name: 'grantedDirs', type: 'string', array: true },
            { name: 'grantedDrives', type: '@harness/granted-drive', array: true },
            { name: 'payload', type: 'json' },
            { name: 'grantedWriteDirs', type: 'string', array: true },
            { name: 'captureInferenceCalls', type: 'bool' },
            { name: 'capability', type: 'string' },
            { name: 'arguments', type: 'json' },
            { name: 'enhance', type: 'string' },
            { name: 'session', type: 'string' },
            { name: 'runId', type: 'string' }
        ]
    });
    ns.register({
        name: 'completion-event-type',
        enum: [
            'content',
            'thinking',
            'tool-call',
            'tool-result',
            'approval-ask',
            'metrics',
            'error',
            'aborted',
            'attach-ask',
            'fetch-ask',
            'progress',
            'rag-ask',
            'question-ask',
            'done',
            'tool-activity',
            'drive-ask',
            'inference-call',
            'inference-sent',
            'run-started',
            'run-resumed',
            'paused',
            'recovery-required',
            'round-reset',
            'run-log-append',
            'input',
            'goal',
            'fold',
            'input-rejected',
            'context',
            'model-round-ask',
            'model-round-cancel',
            'model-round-retake',
            'model-round-result'
        ],
        strings: true
    });
    ns.register({
        name: 'completion-event',
        fields: [
            { name: 'type', type: '@harness/completion-event-type', required: true },
            { name: 'text', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'arguments', type: 'json' },
            { name: 'result', type: 'json' },
            { name: 'callId', type: 'string' },
            { name: 'resource', type: '@harness/resource' },
            { name: 'message', type: 'string' },
            { name: 'metrics', type: 'json' },
            { name: 'path', type: 'string' },
            { name: 'fileName', type: 'string' },
            { name: 'mimeType', type: 'string' },
            { name: 'raw', type: 'bool' },
            { name: 'attachmentId', type: 'string' },
            { name: 'percentage', type: 'uint' },
            { name: 'cleared', type: 'bool' },
            { name: 'query', type: 'string' },
            { name: 'limit', type: 'uint' },
            { name: 'question', type: 'string' },
            { name: 'options', type: 'json' },
            { name: 'meta', type: 'bool' },
            { name: 'effect', type: 'string' },
            { name: 'decision', type: 'string' },
            { name: 'op', type: 'string' },
            { name: 'payload', type: 'json' },
            { name: 'intent', type: 'string' },
            { name: 'display', type: 'json' },
            { name: 'rawCall', type: 'string' },
            { name: 'runId', type: 'string' },
            { name: 'round', type: 'uint' },
            { name: 'replacedTypes', type: 'string', array: true }
        ]
    });
    ns.register({
        name: 'model-event-status',
        enum: [
            'loading',
            'downloading',
            'ready',
            'error',
            'unloading',
            'unloaded',
            'downloaded',
            'held'
        ],
        strings: true
    });
    ns.register({
        name: 'load-fit-verdict',
        enum: ['fit', 'does-not-fit', 'unknown'],
        strings: true
    });
    ns.register({
        name: 'load-fit-plan',
        fields: [
            { name: 'nCtx', type: 'int', required: true },
            { name: 'nGpuLayers', type: 'int', required: true },
            { name: 'nGpuDevices', type: 'int', required: true }
        ]
    });
    ns.register({
        name: 'load-fit',
        fields: [
            { name: 'verdict', type: '@harness/load-fit-verdict', required: true },
            { name: 'reason', type: 'string', required: true },
            { name: 'plan', type: '@harness/load-fit-plan' },
            { name: 'deviceBytes', type: 'float64' },
            { name: 'hostBytes', type: 'float64' }
        ]
    });
    ns.register({
        name: 'loaded-model',
        fields: [
            { name: 'model', type: 'string', required: true },
            { name: 'refs', type: 'uint', required: true },
            { name: 'fit', type: '@harness/load-fit' }
        ]
    });
    ns.register({
        name: 'model-event',
        fields: [
            { name: 'status', type: '@harness/model-event-status', required: true },
            { name: 'model', type: 'string' },
            { name: 'percentage', type: 'uint' },
            { name: 'message', type: 'string' },
            { name: 'loaded', type: '@harness/loaded-model', array: true },
            { name: 'catalogChanged', type: 'bool' },
            { name: 'downloaded', type: 'uint' },
            { name: 'total', type: 'uint' },
            { name: 'addon', type: 'string' }
        ]
    });
    ns.register({
        name: 'download-request',
        fields: [
            { name: 'model', type: 'string', required: true },
            { name: 'addon', type: 'string' },
            { name: 'seed', type: 'bool' }
        ]
    });
    ns.register({
        name: 'download-event-type',
        enum: ['progress', 'complete', 'error', 'aborted'],
        strings: true
    });
    ns.register({
        name: 'download-event',
        fields: [
            { name: 'type', type: '@harness/download-event-type', required: true },
            { name: 'progress', type: 'json' },
            { name: 'assetId', type: 'string' },
            { name: 'message', type: 'string' },
            { name: 'downloaded', type: 'bool', useDefault: false }
        ]
    });
    ns.register({
        name: 'embed-request',
        fields: [
            { name: 'model', type: 'string', required: true },
            { name: 'texts', type: 'string', array: true, required: true }
        ]
    });
    ns.register({
        name: 'embed-response',
        fields: [
            { name: 'dimensions', type: 'uint', required: true },
            { name: 'vectors', type: 'buffer', required: true }
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
            { name: 'binaries', type: '@harness/skill-binary-requirement', array: true },
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
        name: 'skill-setup-route',
        fields: [
            { name: 'kind', type: 'string', required: true },
            { name: 'label', type: 'string', required: true },
            { name: 'provider', type: 'string' },
            { name: 'credentialKey', type: 'string' },
            { name: 'description', type: 'string' },
            { name: 'helpUrl', type: 'string' },
            { name: 'steps', type: 'string', array: true },
            { name: 'configSteps', type: 'string', array: true },
            { name: 'fields', type: '@harness/skill-setup-field', array: true },
            { name: 'satisfied', type: 'bool' }
        ]
    });
    ns.register({
        name: 'skill-setup',
        fields: [
            { name: 'summary', type: 'string' },
            { name: 'routes', type: '@harness/skill-setup-route', array: true }
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
            { name: 'requirements', type: '@harness/skill-requirements' },
            { name: 'install', type: '@harness/skill-install-step', array: true },
            { name: 'setup', type: '@harness/skill-setup' },
            { name: 'status', type: 'string', required: true },
            { name: 'stub', type: 'bool' },
            { name: 'surfaceWhenUnsupported', type: 'bool' },
            { name: 'minCapabilityProfile', type: 'string' },
            { name: 'emoji', type: 'string' },
            { name: 'setupV2', type: '@harness/skill-setup-v2' },
            { name: 'displayName', type: 'string' }
        ]
    });
    ns.register({
        name: 'skill-request',
        fields: [
            { name: 'agentId', type: 'string' },
            { name: 'modelName', type: 'string' },
            { name: 'refresh', type: 'bool' },
            { name: 'skipCredentialProbe', type: 'bool' }
        ]
    });
    ns.register({
        name: 'skill-response',
        fields: [{ name: 'skills', type: '@harness/skill', array: true, required: true }]
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
            { name: 'supportsImages', type: 'bool', required: true },
            { name: 'expectedSize', type: 'uint', required: true },
            { name: 'actualSize', type: 'uint' },
            { name: 'label', type: 'string' },
            { name: 'isLoading', type: 'bool' },
            { name: 'memoryBytes', type: 'uint' },
            { name: 'fit', type: 'string' },
            { name: 'fitBasis', type: 'string' },
            { name: 'fitEvidence', type: 'string' }
        ]
    });
    ns.register({
        name: 'list-models-request',
        fields: [
            { name: 'type', type: 'string' },
            { name: 'cachedOnly', type: 'bool' },
            { name: 'fullRegistry', type: 'bool' }
        ]
    });
    ns.register({
        name: 'list-models-response',
        fields: [{ name: 'models', type: '@harness/model-info', array: true, required: true }]
    });
    ns.register({
        name: 'delete-model-request',
        fields: [{ name: 'name', type: 'string', required: true }]
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
            { name: 'status', type: '@harness/kv-cache-deletion-status', required: true },
            { name: 'error', type: 'string' }
        ]
    });
    ns.register({
        name: 'embedding-device-response',
        fields: [{ name: 'device', type: '@harness/embedding-device', required: true }]
    });
    ns.register({
        name: 'set-embedding-device-request',
        fields: [{ name: 'device', type: '@harness/embedding-device', required: true }]
    });
    ns.register({
        name: 'harness-info',
        fields: [
            { name: 'toolNames', type: 'string', array: true },
            { name: 'skills', type: 'string', array: true },
            { name: 'supportsImages', type: 'bool' },
            { name: 'supportsKvCacheDeletion', type: 'bool' }
        ]
    });
    ns.register({
        name: 'harness-diagnostics',
        fields: [
            { name: 'models', type: '@harness/loaded-model', array: true },
            { name: 'suspended', type: 'bool' },
            { name: 'sdkLoaded', type: 'bool' },
            { name: 'toolNames', type: 'string', array: true },
            { name: 'skills', type: 'string', array: true },
            { name: 'device', type: '@harness/embedding-device' }
        ]
    });
    ns.register({
        name: 'capability-profile',
        enum: ['tiny', 'low', 'mid', 'high', 'xhigh'],
        strings: true
    });
    ns.register({
        name: 'memory-budget-source',
        enum: ['vram', 'shared', 'mobile', 'integrated', 'no-gpu'],
        strings: true
    });
    ns.register({
        name: 'gpu-class',
        enum: ['discrete', 'integrated'],
        strings: true
    });
    ns.register({
        name: 'memory-budget',
        fields: [
            { name: 'totalBytes', type: 'uint', required: true },
            { name: 'availableBytes', type: 'uint', required: true },
            { name: 'source', type: '@harness/memory-budget-source', required: true },
            { name: 'gpuClass', type: '@harness/gpu-class' }
        ]
    });
    ns.register({
        name: 'infra-model',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'addon', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'infra-models-request',
        fields: [{ name: 'profile', type: '@harness/capability-profile', required: true }]
    });
    ns.register({
        name: 'infra-models-response',
        fields: [{ name: 'models', type: '@harness/infra-model', array: true, required: true }]
    });
    ns.register({
        name: 'capability-response',
        fields: [
            { name: 'capabilityProfile', type: '@harness/capability-profile', required: true },
            { name: 'recommendedModelName', type: 'string', required: true },
            { name: 'memoryBudget', type: '@harness/memory-budget' },
            { name: 'mobile', type: 'bool' },
            { name: 'completionRecovery', type: 'bool' },
            { name: 'hostRunLog', type: 'bool' },
            { name: 'hostRunLogVersion', type: 'uint' }
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
        fields: [{ name: 'languages', type: '@harness/detected-language', array: true, required: true }]
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
        fields: [{ name: 'tools', type: '@harness/tool-catalog-entry', array: true, required: true }]
    });
    ns.register({
        name: 'skill-setup-route-kind',
        enum: ['oauth', 'token', 'install', 'picker', 'instructions'],
        strings: true
    });
    ns.register({
        name: 'skill-setup-route-v2',
        fields: [
            { name: 'kind', type: '@harness/skill-setup-route-kind', required: true },
            { name: 'label', type: 'string', required: true },
            { name: 'provider', type: 'string' },
            { name: 'credentialKey', type: 'string' },
            { name: 'description', type: 'string' },
            { name: 'helpUrl', type: 'string' },
            { name: 'steps', type: 'string', array: true },
            { name: 'configSteps', type: 'string', array: true },
            { name: 'fields', type: '@harness/skill-setup-field', array: true },
            { name: 'satisfied', type: 'bool' },
            { name: 'oauth', type: '@harness/skill-oauth-config' }
        ]
    });
    ns.register({
        name: 'skill-setup-v2',
        fields: [
            { name: 'summary', type: 'string' },
            { name: 'routes', type: '@harness/skill-setup-route-v2', array: true }
        ]
    });
    ns.register({
        name: 'speak-stream-frame',
        fields: [{ name: 'text', type: 'string', required: true }]
    });
    ns.register({
        name: 'credential-entry',
        fields: [
            { name: 'key', type: 'string', required: true },
            { name: 'token', type: 'string' },
            { name: 'expiresAt', type: 'uint' },
            { name: 'agentId', type: 'string' },
            { name: 'skill', type: 'string' }
        ]
    });
    ns.register({
        name: 'set-credentials-request',
        fields: [{ name: 'entries', type: '@harness/credential-entry', array: true }]
    });
    ns.register({
        name: 'custom-model',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'src', type: 'string', required: true },
            { name: 'projectionSrc', type: 'string' },
            { name: 'taskType', type: 'string' },
            { name: 'expectedSize', type: 'uint' },
            { name: 'label', type: 'string' },
            { name: 'contextLength', type: 'uint' }
        ]
    });
    ns.register({
        name: 'set-custom-models-request',
        fields: [{ name: 'models', type: '@harness/custom-model', array: true }]
    });
    ns.register({
        name: 'state',
        enum: ['RESUME', 'WAKEUP', 'PRESUSPEND', 'SUSPEND']
    });
    ns.register({
        name: 'warm-model-request',
        fields: [
            { name: 'model', type: 'string', required: true },
            { name: 'agent', type: '@harness/agent-knobs' }
        ]
    });
    ns.register({
        name: 'skill-setting-entry',
        fields: [
            { name: 'skill', type: 'string', required: true },
            { name: 'key', type: 'string', required: true },
            { name: 'value', type: 'string', required: true },
            { name: 'agentId', type: 'string' }
        ]
    });
    ns.register({
        name: 'set-skill-settings-request',
        fields: [{ name: 'entries', type: '@harness/skill-setting-entry', array: true }]
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
        fields: [{ name: 'skills', type: '@harness/managed-skill', array: true, required: true }]
    });
    ns.register({
        name: 'skill-name-request',
        fields: [{ name: 'name', type: 'string', required: true }]
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
            { name: 'content', type: 'string', required: true }
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
        name: 'kv-cache-delete-request',
        fields: [{ name: 'kvCacheKey', type: 'string', required: true }]
    });
    ns.register({
        name: 'skill-oauth-param',
        fields: [
            { name: 'key', type: 'string', required: true },
            { name: 'value', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'skill-oauth-verify-rule',
        fields: [
            { name: 'error', type: 'string', required: true },
            { name: 'status', type: 'uint', array: true },
            { name: 'field', type: 'string' },
            { name: 'notEqual', type: 'string' }
        ]
    });
    ns.register({
        name: 'skill-oauth-verify',
        fields: [
            { name: 'url', type: 'string', required: true },
            { name: 'method', type: 'string' },
            { name: 'body', type: 'string' },
            { name: 'reject', type: '@harness/skill-oauth-verify-rule', array: true }
        ]
    });
    ns.register({
        name: 'skill-oauth-config',
        fields: [
            { name: 'stateKey', type: 'string', required: true },
            { name: 'authUrl', type: 'string', required: true },
            { name: 'tokenUrl', type: 'string', required: true },
            { name: 'tokenAuth', type: 'string', required: true },
            { name: 'scopes', type: 'string', array: true },
            { name: 'extraAuthParams', type: '@harness/skill-oauth-param', array: true },
            { name: 'registrationEndpoint', type: 'string' },
            { name: 'port', type: 'uint' },
            { name: 'sharedIosSession', type: 'bool' },
            { name: 'verify', type: '@harness/skill-oauth-verify' }
        ]
    });
    ns.register({
        name: 'preview-model-source-request',
        fields: [
            { name: 'src', type: 'string', required: true },
            { name: 'mmprojSrc', type: 'string' }
        ]
    });
    ns.register({
        name: 'model-source-file',
        fields: [
            { name: 'src', type: 'string', required: true },
            { name: 'label', type: 'string', required: true },
            { name: 'sizeBytes', type: 'uint' }
        ]
    });
    ns.register({
        name: 'preview-model-source-response',
        fields: [
            { name: 'ok', type: 'bool', required: true },
            { name: 'refusal', type: 'string' },
            { name: 'reason', type: 'string' },
            { name: 'src', type: 'string' },
            { name: 'files', type: '@harness/model-source-file', array: true },
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
    ns.register({
        name: 'set-model-idle-timeout-request',
        fields: [{ name: 'ms', type: 'uint', required: true }]
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
        fields: [{ name: 'model', type: 'string', required: true }]
    });
    ns.register({
        name: 'unload-model-response',
        fields: [{ name: 'unloaded', type: 'bool', required: true }]
    });
    ns.register({
        name: 'set-model-memory-cap-request',
        fields: [{ name: 'percent', type: 'uint', required: true }]
    });
    ns.register({
        name: 'memory-usage',
        fields: [{ name: 'usedBytes', type: 'uint', required: true }]
    });
    ns.register({
        name: 'set-downloads-allowed-request',
        fields: [{ name: 'allowed', type: 'bool', required: true }]
    });
    ns.register({
        name: 'knowledge-chunk',
        fields: [
            { name: 'id', type: 'string', required: true },
            { name: 'text', type: 'string', required: true },
            { name: 'metadata', type: 'json' }
        ]
    });
    ns.register({
        name: 'knowledge-upsert-request',
        fields: [
            { name: 'artifactId', type: 'string', required: true },
            { name: 'version', type: 'string' },
            { name: 'scope', type: 'string', required: true },
            { name: 'chunks', type: '@harness/knowledge-chunk', array: true, required: true },
            { name: 'model', type: 'string' },
            { name: 'dimensions', type: 'uint' },
            { name: 'vectors', type: 'buffer' }
        ]
    });
    ns.register({
        name: 'knowledge-upsert-response',
        fields: [
            { name: 'added', type: 'uint', required: true },
            { name: 'model', type: 'string' },
            { name: 'dimensions', type: 'uint' },
            { name: 'vectors', type: 'buffer' }
        ]
    });
    ns.register({
        name: 'knowledge-remove-request',
        fields: [{ name: 'artifactId', type: 'string', required: true }]
    });
    ns.register({
        name: 'knowledge-remove-response',
        fields: [{ name: 'removed', type: 'uint', required: true }]
    });
    ns.register({
        name: 'knowledge-search-request',
        fields: [
            { name: 'text', type: 'string', required: true },
            { name: 'scopes', type: 'string', array: true, required: true },
            { name: 'k', type: 'uint' }
        ]
    });
    ns.register({
        name: 'knowledge-hit',
        fields: [
            { name: 'artifactId', type: 'string', required: true },
            { name: 'chunkId', type: 'string', required: true },
            { name: 'scope', type: 'string', required: true },
            { name: 'text', type: 'string', required: true },
            { name: 'score', type: 'float64', required: true },
            { name: 'metadata', type: 'json' }
        ]
    });
    ns.register({
        name: 'knowledge-search-response',
        fields: [{ name: 'hits', type: '@harness/knowledge-hit', array: true, required: true }]
    });
    ns.register({
        name: 'knowledge-artifact-status',
        fields: [
            { name: 'artifactId', type: 'string', required: true },
            { name: 'version', type: 'string' },
            { name: 'scope', type: 'string', required: true },
            { name: 'chunks', type: 'uint', required: true }
        ]
    });
    ns.register({
        name: 'knowledge-status-response',
        fields: [
            { name: 'model', type: 'string', required: true },
            { name: 'dimensions', type: 'uint', required: true },
            { name: 'chunks', type: 'uint', required: true },
            {
                name: 'artifacts',
                type: '@harness/knowledge-artifact-status',
                array: true,
                required: true
            }
        ]
    });
}
export function registerHarnessApi(api) {
    api.register({
        name: 'completion',
        request: { name: '@harness/completion-frame', stream: true },
        response: { name: '@harness/completion-event', stream: true }
    });
    api.register({
        name: 'model-events',
        request: { name: '@harness/empty', stream: false },
        response: { name: '@harness/model-event', stream: true }
    });
    api.register({
        name: 'download',
        request: { name: '@harness/download-request', stream: false },
        response: { name: '@harness/download-event', stream: true }
    });
    api.register({
        name: 'embed',
        request: { name: '@harness/embed-request', stream: false },
        response: { name: '@harness/embed-response', stream: false }
    });
    api.register({
        name: 'skills',
        request: { name: '@harness/skill-request', stream: false },
        response: { name: '@harness/skill-response', stream: false }
    });
    api.register({
        name: 'get-embedding-device',
        request: { name: '@harness/empty', stream: false },
        response: { name: '@harness/embedding-device-response', stream: false }
    });
    api.register({
        name: 'set-embedding-device',
        request: { name: '@harness/set-embedding-device-request', stream: false },
        response: { name: '@harness/ok-response', stream: false }
    });
    api.register({
        name: 'list-models',
        request: { name: '@harness/list-models-request', stream: false },
        response: { name: '@harness/list-models-response', stream: false }
    });
    api.register({
        name: 'delete-model',
        request: { name: '@harness/delete-model-request', stream: false },
        response: { name: '@harness/delete-model-response', stream: false }
    });
    api.register({
        name: 'describe',
        request: { name: '@harness/empty', stream: false },
        response: { name: '@harness/harness-info', stream: false }
    });
    api.register({
        name: 'infra-models',
        request: { name: '@harness/infra-models-request', stream: false },
        response: { name: '@harness/infra-models-response', stream: false }
    });
    api.register({
        name: 'capability',
        request: { name: '@harness/empty', stream: false },
        response: { name: '@harness/capability-response', stream: false }
    });
    api.register({
        name: 'transcribe',
        request: { name: '@harness/transcribe-request', stream: false },
        response: { name: '@harness/transcribe-response', stream: false }
    });
    api.register({
        name: 'speak',
        request: { name: '@harness/speak-request', stream: false },
        response: { name: '@harness/speak-response', stream: false }
    });
    api.register({
        name: 'diagnostics',
        request: { name: '@harness/empty', stream: false },
        response: { name: '@harness/harness-diagnostics', stream: false }
    });
    api.register({
        name: 'tools',
        request: { name: '@harness/empty', stream: false },
        response: { name: '@harness/tool-catalog-response', stream: false }
    });
    api.register({
        name: 'speak-stream',
        request: { name: '@harness/speak-stream-frame', stream: true },
        response: { name: '@harness/speak-response', stream: true }
    });
    api.register({
        name: 'set-credentials',
        request: { name: '@harness/set-credentials-request', stream: false },
        response: { name: '@harness/ok-response', stream: false }
    });
    api.register({
        name: 'warm-model',
        request: { name: '@harness/warm-model-request', stream: false },
        response: { name: '@harness/ok-response', stream: false }
    });
    api.register({
        name: 'set-custom-models',
        request: { name: '@harness/set-custom-models-request', stream: false },
        response: { name: '@harness/ok-response', stream: false }
    });
    api.register({
        name: 'clear-kv-cache',
        request: { name: '@harness/empty', stream: false },
        response: { name: '@harness/kv-cache-deletion-response', stream: false }
    });
    api.register({
        name: 'set-skill-settings',
        request: { name: '@harness/set-skill-settings-request', stream: false },
        response: { name: '@harness/ok-response', stream: false }
    });
    api.register({
        name: 'list-managed-skills',
        request: { name: '@harness/empty', stream: false },
        response: { name: '@harness/managed-skills-response', stream: false }
    });
    api.register({
        name: 'read-skill-file',
        request: { name: '@harness/skill-name-request', stream: false },
        response: { name: '@harness/skill-file-response', stream: false }
    });
    api.register({
        name: 'write-skill-file',
        request: { name: '@harness/write-skill-request', stream: false },
        response: { name: '@harness/ok-response', stream: false }
    });
    api.register({
        name: 'copy-skill-for-edit',
        request: { name: '@harness/skill-name-request', stream: false },
        response: { name: '@harness/copy-skill-response', stream: false }
    });
    api.register({
        name: 'delete-overlay-skill',
        request: { name: '@harness/skill-name-request', stream: false },
        response: { name: '@harness/delete-skill-response', stream: false }
    });
    api.register({
        name: 'delete-kv-cache',
        request: { name: '@harness/kv-cache-delete-request', stream: false },
        response: { name: '@harness/kv-cache-deletion-response', stream: false }
    });
    api.register({
        name: 'detect-language',
        request: { name: '@harness/detect-language-request', stream: false },
        response: { name: '@harness/detect-language-response', stream: false }
    });
    api.register({
        name: 'preview-model-source',
        request: { name: '@harness/preview-model-source-request', stream: false },
        response: { name: '@harness/preview-model-source-response', stream: false }
    });
    api.register({
        name: 'set-model-idle-timeout',
        request: { name: '@harness/set-model-idle-timeout-request', stream: false },
        response: { name: '@harness/ok-response', stream: false }
    });
    api.register({
        name: 'load-model',
        request: { name: '@harness/warm-model-request', stream: false },
        response: { name: '@harness/load-model-response', stream: false }
    });
    api.register({
        name: 'unload-model',
        request: { name: '@harness/unload-model-request', stream: false },
        response: { name: '@harness/unload-model-response', stream: false }
    });
    api.register({
        name: 'set-model-memory-cap',
        request: { name: '@harness/set-model-memory-cap-request', stream: false },
        response: { name: '@harness/ok-response', stream: false }
    });
    api.register({
        name: 'memory-usage',
        request: { name: '@harness/empty', stream: false },
        response: { name: '@harness/memory-usage', stream: false }
    });
    api.register({
        name: 'set-downloads-allowed',
        request: { name: '@harness/set-downloads-allowed-request', stream: false },
        response: { name: '@harness/ok-response', stream: false }
    });
    api.register({
        name: 'knowledge-upsert',
        request: { name: '@harness/knowledge-upsert-request', stream: false },
        response: { name: '@harness/knowledge-upsert-response', stream: false }
    });
    api.register({
        name: 'knowledge-remove',
        request: { name: '@harness/knowledge-remove-request', stream: false },
        response: { name: '@harness/knowledge-remove-response', stream: false }
    });
    api.register({
        name: 'knowledge-search',
        request: { name: '@harness/knowledge-search-request', stream: false },
        response: { name: '@harness/knowledge-search-response', stream: false }
    });
    api.register({
        name: 'knowledge-status',
        request: { name: '@harness/empty', stream: false },
        response: { name: '@harness/knowledge-status-response', stream: false }
    });
}
