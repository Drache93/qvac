// for strict consumers without allowJs; the *Map emitters return record rows, never a Map
export function chunkTypeOrdinal(type: string): number
export function chunksByTypeMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function activeAgentsMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function activeChatsMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function agentsByProviderMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function defaultAgentsMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function activeChatsByAgentMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function activeChatGroupsMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function activeKnowledgeByChatMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function activeKnowledgeBaseMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function activeToolConfigsByAgentMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function toolActivityByAgentMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function runRequestsMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function liveModelRequestsMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function runRequestByRunMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function liveFilesMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function reclaimableFilesMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function attachmentsByMediaKindMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function attachmentsByMediaKindOriginMap(
  record: unknown
): ReadonlyArray<Record<string, unknown>>
export function historyChunksMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function liveDevicesByWriterKeyMap(record: unknown): ReadonlyArray<Record<string, unknown>>
export function liveWritersByMostRecentMap(record: unknown): ReadonlyArray<Record<string, unknown>>
