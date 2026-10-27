export const CHUNK_TYPES = [
    'user-message',
    'content',
    'thinking',
    'tool-call',
    'tool-result',
    'attachment',
    'approval-request',
    'run-status',
    'run-request',
    'sources',
    'compaction',
    'context',
    'model-request',
    'round-reset',
    'agent-switch'
];
export const RUN_STATES = [
    'executing',
    'completed',
    'failed',
    'canceled',
    'paused',
    'recovery-required'
];
export const APPROVAL_STATUSES = ['pending', 'approved', 'denied'];
export const ENHANCE_MODES = ['never', 'auto'];
export const MODEL_REQUEST_STATES = ['open', 'taken', 'done', 'failed', 'cancelled'];
export const CHUNK_PAYLOAD_FIELDS = {
    'user-message': 'userMessage',
    content: 'content',
    thinking: 'thinking',
    'tool-call': 'toolCall',
    'tool-result': 'toolResult',
    attachment: 'attachment',
    'approval-request': 'approvalRequest',
    'run-status': 'runStatus',
    'run-request': 'runRequest',
    sources: 'sources',
    compaction: 'compaction',
    context: 'context',
    'model-request': 'modelRequest',
    'round-reset': 'roundReset',
    'agent-switch': 'agentSwitch'
};
export function versionedRegistrar(ns, namespace) {
    return (name, ...versions) => {
        versions.forEach((fields, i) => ns.register({ name: `${name}-v${i + 1}`, fields }));
        ns.register({
            name,
            framed: false,
            versions: versions.map((_, i) => ({
                version: i + 1,
                type: `@${namespace}/${name}-v${i + 1}`
            }))
        });
    };
}
export function registerContentTypes(ns, namespace) {
    const ref = (name) => `@${namespace}/${name}`;
    const versioned = versionedRegistrar(ns, namespace);
    ns.register({ name: 'chunk-type', enum: CHUNK_TYPES, strings: true });
    ns.register({ name: 'run-state', enum: RUN_STATES, strings: true });
    ns.register({ name: 'approval-status', enum: APPROVAL_STATUSES, strings: true });
    ns.register({ name: 'enhance-mode', enum: ENHANCE_MODES, strings: true });
    ns.register({
        name: 'resource-descriptor',
        fields: [
            { name: 'kind', type: 'string', required: true },
            { name: 'label', type: 'string', required: true }
        ]
    });
    ns.register({
        name: 'progress-phase',
        enum: [
            'loading',
            'downloading',
            'queued',
            'generating',
            'transcribing',
            'compacting',
            'awaiting-download'
        ],
        strings: true
    });
    ns.register({
        name: 'run-progress',
        fields: [
            { name: 'phase', type: ref('progress-phase'), required: true },
            { name: 'model', type: 'string' },
            { name: 'percentage', type: 'uint' },
            { name: 'busyChatId', type: 'string' }
        ]
    });
    versioned('chunk-content-run-status', [
        { name: 'state', type: ref('run-state'), required: true },
        { name: 'model', type: 'string' },
        { name: 'percentage', type: 'uint' },
        { name: 'reason', type: 'string' },
        { name: 'metrics', type: 'json' },
        { name: 'progress', type: ref('run-progress') }
    ]);
    versioned('chunk-content-approval-request', [
        { name: 'status', type: ref('approval-status'), required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'arguments', type: 'json', required: true },
        { name: 'resource', type: ref('resource-descriptor') },
        { name: 'agentId', type: 'string' }
    ]);
    versioned('chunk-content-user-message', [{ name: 'text', type: 'string', required: true }]);
    versioned('chunk-content-assistant', [{ name: 'text', type: 'string', required: true }]);
    versioned('chunk-content-thinking', [{ name: 'text', type: 'string', required: true }]);
    versioned('chunk-content-tool-call', [
        { name: 'name', type: 'string', required: true },
        { name: 'arguments', type: 'json' }
    ]);
    versioned('chunk-content-tool-result', [
        { name: 'name', type: 'string', required: true },
        { name: 'result', type: 'json' }
    ]);
    const attachment = [
        { name: 'id', type: 'string', required: true },
        { name: 'fileName', type: 'string', required: true },
        { name: 'mimeType', type: 'string', required: true },
        { name: 'byteLength', type: 'uint', required: true },
        { name: 'blobId', type: 'string', required: true },
        { name: 'createdAt', type: 'uint', required: true },
        { name: 'deletedAt', type: 'uint' }
    ];
    if (namespace === 'assistant') {
        attachment.push({ name: 'url', type: 'string' });
    }
    versioned('chunk-content-attachment', attachment);
    versioned('chunk-content-run-request', [{ name: 'agentId', type: 'string', required: true }]);
    versioned('chunk-content-compaction', [
        { name: 'summary', type: 'string', required: true },
        { name: 'throughId', type: 'string', required: true }
    ]);
    ns.register({
        name: 'rag-source',
        fields: [
            { name: 'documentId', type: 'string' },
            { name: 'title', type: 'string', required: true },
            { name: 'chunkIndex', type: 'uint', required: true },
            { name: 'excerpt', type: 'string', required: true },
            { name: 'attachmentId', type: 'string' },
            { name: 'artifactId', type: 'string' },
            { name: 'score', type: 'float64', required: true },
            { name: 'url', type: 'string' },
            { name: 'page', type: 'uint' }
        ]
    });
    const sources = [
        { name: 'sources', type: ref('rag-source'), array: true, required: true },
        { name: 'notice', type: 'string' }
    ];
    versioned('chunk-content-sources', sources, [
        ...sources,
        { name: 'chatFilesNotReady', type: 'uint' },
        { name: 'projectFilesNotReady', type: 'uint' }
    ]);
    ns.register({ name: 'model-request-state', enum: MODEL_REQUEST_STATES, strings: true });
    versioned('chunk-content-context', [
        { name: 'turn', type: 'json' },
        { name: 'toolSetHash', type: 'string' }
    ]);
    versioned('chunk-content-model-request', [
        { name: 'round', type: 'uint', required: true },
        { name: 'agents', type: 'string', array: true },
        { name: 'options', type: 'json' },
        { name: 'toolTurns', type: 'json' },
        { name: 'cacheKey', type: 'string' },
        { name: 'promptPrefix', type: 'string' },
        { name: 'state', type: ref('model-request-state'), required: true },
        { name: 'takenBy', type: 'fixed32' },
        { name: 'takenAt', type: 'uint' },
        { name: 'result', type: 'json' },
        { name: 'reason', type: 'string' },
        { name: 'hostDeviceId', type: 'fixed32' }
    ]);
    versioned('chunk-content-round-reset', [
        { name: 'replacedTypes', type: ref('chunk-type'), array: true }
    ]);
    versioned('chunk-content-agent-switch', [
        { name: 'agentId', type: 'string', required: true },
        { name: 'name', type: 'string', required: true }
    ]);
}
