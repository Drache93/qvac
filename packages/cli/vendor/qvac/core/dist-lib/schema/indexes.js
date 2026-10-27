// imported by the generated spec at runtime (dbns.require embeds a relative path) — stays plain .js
import { mediaKindOf, mediaKindOrdinal } from './media-kind.js'

const historyChunkTypes = [
  'user-message',
  'run-request',
  'content',
  'attachment',
  'compaction',
  'round-reset'
]

// index keys hold the ordinal, kept in sync by hand with CHUNK_TYPES order in content.ts
export function chunkTypeOrdinal(type) {
  switch (type) {
    case 'user-message':
      return 1
    case 'content':
      return 2
    case 'thinking':
      return 3
    case 'tool-call':
      return 4
    case 'tool-result':
      return 5
    case 'attachment':
      return 6
    case 'approval-request':
      return 7
    case 'run-status':
      return 8
    case 'run-request':
      return 9
    case 'sources':
      return 10
    case 'compaction':
      return 11
    case 'context':
      return 12
    case 'model-request':
      return 13
    case 'round-reset':
      return 14
    case 'agent-switch':
      return 15
    default:
      throw new Error('Unknown chunk type: ' + type)
  }
}

export function chunksByTypeMap(record) {
  if (record.type === undefined) return []
  return [{ chatId: record.chatId, type: chunkTypeOrdinal(record.type), seq: record.seq }]
}

export function activeAgentsMap(record) {
  if (record.deletedAt) return []
  return [{ createdAt: record.createdAt }]
}

export function agentsByProviderMap(record) {
  if (record.deletedAt) return []
  return [{ providerDeviceId: record.providerDeviceId, createdAt: record.createdAt }]
}

export function defaultAgentsMap(record) {
  if (record.deletedAt || !record.isDefault) return []
  return [{ providerDeviceId: record.providerDeviceId, createdAt: record.createdAt }]
}

export function activeChatsMap(record) {
  if (record.deletedAt) return []
  return [{ createdAt: record.createdAt }]
}

export function activeChatGroupsMap(record) {
  if (record.deletedAt) return []
  return [{ createdAt: record.createdAt }]
}

export function activeChatsByAgentMap(record) {
  if (record.deletedAt) return []
  return [{ agentId: record.agentId, createdAt: record.createdAt }]
}

export function activeKnowledgeByChatMap(record) {
  if (record.deletedAt || !record.chatId) return []
  return [{ chatId: record.chatId }]
}

// a row with no chat is its project's knowledge base
export function activeKnowledgeBaseMap(record) {
  if (record.deletedAt || record.chatId) return []
  return [{ createdAt: record.createdAt }]
}

export function activeToolConfigsByAgentMap(record) {
  if (record.deletedAt) return []
  return [{ agentId: record.agentId }]
}

// keyed by seq, not wall clock, for a peer-consistent order; no tombstone filter, it is immutable
export function toolActivityByAgentMap(record) {
  if (!record.agentId) return []
  return [{ agentId: record.agentId, seq: record.seq }]
}

export function runRequestsMap(record) {
  if (record.type !== 'run-request') return []
  return [{ chatId: record.chatId, seq: record.seq }]
}

// a round leaves the queue once it ends, so a host reads only what it may still take
export function liveModelRequestsMap(record) {
  const state = record.modelRequest?.state
  if (record.type !== 'model-request' || (state !== 'open' && state !== 'taken')) {
    return []
  }

  return [{ chatId: record.chatId, seq: record.seq }]
}

export function runRequestByRunMap(record) {
  if (record.type !== 'run-request' || !record.runId) return []
  return [{ chatId: record.chatId, runId: record.runId }]
}

// not chatId-prefixed, so one range lists every audio attachment in the mesh without filtering
export function attachmentsByMediaKindMap(record) {
  if (record.type !== 'attachment' || record.sourceId) return []
  const attachment = record.attachment
  if (!attachment || attachment.deletedAt) {
    return []
  }

  return [
    {
      mediaKind: mediaKindOrdinal(mediaKindOf(attachment.mimeType, attachment.fileName)),
      createdAt: record.createdAt
    }
  ]
}

// generated output always carries a runId and an upload never does, so runId presence is origin
function attachmentGenerated(record) {
  return record.runId ? 1 : 0
}

// origin in the key makes "only generated audio" a range query, not a post-filter
export function attachmentsByMediaKindOriginMap(record) {
  if (record.type !== 'attachment' || record.sourceId) return []
  const attachment = record.attachment
  if (!attachment || attachment.deletedAt) {
    return []
  }

  return [
    {
      mediaKind: mediaKindOrdinal(mediaKindOf(attachment.mimeType, attachment.fileName)),
      generated: attachmentGenerated(record),
      createdAt: record.createdAt
    }
  ]
}

export function devicesByWriterKeyMap(record) {
  if (!record.writerKey) return []
  return [{ writerKey: record.writerKey }]
}

export function liveDevicesByWriterKeyMap(record) {
  if (record.revoked || !record.writerKey) return []
  return [{ writerKey: record.writerKey }]
}

export function historyChunksMap(record) {
  if (!historyChunkTypes.includes(record.type)) return []
  return [{ chatId: record.chatId, seq: record.seq }]
}

export function liveWritersByMostRecentMap(record) {
  if (record.revoked) return []
  return [{ clock: record.clock }]
}

export function liveFilesMap(record) {
  if (record.deletedAt) return []
  return [{ meshKey: record.meshKey, coreKey: record.coreKey, blockOffset: record.blockOffset }]
}

export function reclaimableFilesMap(record) {
  if (record.cleared || record.deletedAt) return []
  return [{ lastAccessed: record.lastAccessed }]
}
