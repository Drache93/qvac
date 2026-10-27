import { QvacErrorBase } from '@qvac/error';
export declare const NO_ARCHIVE_HELD = "No archive is held for this mesh";
export declare const MESH_JOINING = "This mesh is still joining: it accepts writes once it is joined";
export declare const DEVICE_INVITE_CHAIN_TOO_LONG = "This device cannot invite another one: invite from another of your devices, or recover from your phrase";
export declare const DEVICE_UNREACHABLE = "the device is not reachable";
export declare const LINK_SOURCES_ONLY = "A model added from another device must come from a link: a path would name a file on this device.";
export declare const MODEL_SETTINGS_ONLY = "Another device may read and change only the model settings of this one.";
export declare const NO_SUCH_AGENT = "no agent with that id";
export declare const NOT_THE_HOST = "this device does not host that agent";
export declare const HOST_REVOKED = "the device hosting this agent is no longer in the mesh";
export declare const HOST_UNREACHABLE = "the device hosting this agent is not connected";
export declare const HOST_SILENT = "the device hosting this agent did not answer";
export declare const SENDER_REVOKED = "the sending device is no longer in the mesh";
export declare const NOT_A_SETUP_FIELD = "that skill declares no such setup field";
export declare const LOAN_UNREACHABLE = "the device lending its model is not connected";
export declare const TURN_RUNNING = "a turn up to the fork point is still running; fork once it has finished";
export declare const NO_SUCH_TURN = "no turn of this chat has that run id";
export declare const NOTHING_BEFORE = "nothing comes before the first turn, so there is nothing to fork";
export declare const FILE_NOT_HERE = "a file in this chat is not on this device yet; open it here first";
export declare const UPLOAD_NAMES_NO_MESH = "an upload must name its mesh on its first frame";
declare const DEFINITIONS: {
    readonly CORE_CLOSING: {
        readonly code: 100001;
        readonly message: (subject?: 'core' | 'Core') => string;
    };
    readonly COMPUTE_ROUTE_DROPPED: {
        readonly code: 100101;
        readonly message: (route: string) => string;
    };
    readonly MESH_NOT_FOUND: {
        readonly code: 100102;
        readonly message: (meshId: string) => string;
    };
    readonly MESH_TRANSITION_IN_PROGRESS: {
        readonly code: 100103;
        readonly message: () => string;
    };
    readonly MESH_BELOW_FLOOR: {
        readonly code: 100104;
        readonly message: () => string;
    };
    readonly ACCOUNT_MESH_MISSING: {
        readonly code: 100105;
        readonly message: () => string;
    };
    readonly ACCOUNT_MEMBER_UNKNOWN: {
        readonly code: 100106;
        readonly message: () => string;
    };
    readonly MESH_WITHOUT_MEMBER: {
        readonly code: 100107;
        readonly message: () => string;
    };
    readonly ACCOUNT_NOT_WRITABLE: {
        readonly code: 100108;
        readonly message: () => string;
    };
    readonly ARCHIVE_NOT_ACCOUNT: {
        readonly code: 100109;
        readonly message: (meshId: string) => string;
    };
    readonly ARCHIVE_NOT_FOUND: {
        readonly code: 100110;
        readonly message: () => string;
    };
    readonly MESH_NAME_TOO_LONG: {
        readonly code: 100111;
        readonly message: (max: number) => string;
    };
    readonly MESH_NAME_ACCOUNT_REFUSED: {
        readonly code: 100112;
        readonly message: () => string;
    };
    readonly ACCOUNT_MESH_CLOSE_REFUSED: {
        readonly code: 100113;
        readonly message: () => string;
    };
    readonly ROUTE_RETIRED: {
        readonly code: 100114;
        readonly message: (route: string, replacement: string) => string;
    };
    readonly MESH_STILL_JOINING: {
        readonly code: 100115;
        readonly message: () => string;
    };
    readonly ROUTE_NOT_IN_ROLE: {
        readonly code: 100116;
        readonly message: (route: string, role: string) => string;
    };
    readonly MESH_RULES_FROM_A_NEWER_BUILD: {
        readonly code: 100117;
        readonly message: (rules: number, known: number) => string;
    };
    readonly NOT_A_WORKSPACE: {
        readonly code: 100118;
        readonly message: (meshId: string) => string;
    };
    readonly WORKSPACE_ADMIN_ONLY: {
        readonly code: 100119;
        readonly message: (action: string) => string;
    };
    readonly WORKSPACE_NAME_EMPTY: {
        readonly code: 100120;
        readonly message: () => string;
    };
    readonly PUBLIC_MESH_UNKNOWN: {
        readonly code: 100121;
        readonly message: () => string;
    };
    readonly PROJECT_NOT_FOUND: {
        readonly code: 100122;
        readonly message: (projectId: string) => string;
    };
    readonly PROJECT_NAME_EMPTY: {
        readonly code: 100123;
        readonly message: () => string;
    };
    readonly PROJECT_MEMBER_NOT_IN_WORKSPACE: {
        readonly code: 100124;
        readonly message: () => string;
    };
    readonly PROJECT_MEMBER_INVITE_REFUSED: {
        readonly code: 100125;
        readonly message: () => string;
    };
    readonly WORKSPACE_LAST_ADMIN: {
        readonly code: 100126;
        readonly message: () => string;
    };
    readonly PROJECT_ORDER_TOO_LONG: {
        readonly code: 100127;
        readonly message: (max: number) => string;
    };
    readonly OWN_WORKSPACE_INVITE_REFUSED: {
        readonly code: 100128;
        readonly message: () => string;
    };
    readonly OWN_WORKSPACE_LEAVE_REFUSED: {
        readonly code: 100129;
        readonly message: () => string;
    };
    readonly COMPUTE_MESH_RETIRED: {
        readonly code: 100130;
        readonly message: () => string;
    };
    readonly INVITE_INVALID: {
        readonly code: 100201;
        readonly message: () => string;
    };
    readonly MESH_JOIN_CANCELED: {
        readonly code: 100202;
        readonly message: () => string;
    };
    readonly JOIN_NOT_PERMITTED: {
        readonly code: 100203;
        readonly message: () => string;
    };
    readonly INVITE_ACCOUNT_UNREADABLE: {
        readonly code: 100204;
        readonly message: () => string;
    };
    readonly MEMBER_INVITE_ACCOUNT_REFUSED: {
        readonly code: 100205;
        readonly message: () => string;
    };
    readonly DEVICE_INVITE_MESH_REFUSED: {
        readonly code: 100206;
        readonly message: () => string;
    };
    readonly DEVICE_INVITE_CHAIN_TOO_LONG: {
        readonly code: 100207;
        readonly message: () => string;
    };
    readonly MESH_HELD_BY_SIBLING: {
        readonly code: 100208;
        readonly message: () => string;
    };
    readonly DEVICE_INVITE_UNLINKED: {
        readonly code: 100209;
        readonly message: () => string;
    };
    readonly DEVICE_INVITE_UNDELEGATED: {
        readonly code: 100210;
        readonly message: () => string;
    };
    readonly DEVICE_ADMIN_LAST: {
        readonly code: 100211;
        readonly message: () => string;
    };
    readonly RECOVERY_NO_ACCOUNT: {
        readonly code: 100301;
        readonly message: () => string;
    };
    readonly RECOVERY_PHRASE_NOT_OURS: {
        readonly code: 100302;
        readonly message: () => string;
    };
    readonly RECOVERY_PHRASE_NOT_A_MEMBER: {
        readonly code: 100303;
        readonly message: () => string;
    };
    readonly RECOVERY_NOT_ADOPTED: {
        readonly code: 100304;
        readonly message: () => string;
    };
    readonly RECOVERY_RECORD_NOT_FOUND: {
        readonly code: 100305;
        readonly message: () => string;
    };
    readonly MEMBER_RESOLVE_TIMEOUT: {
        readonly code: 100401;
        readonly message: () => string;
    };
    readonly MEMBER_NOT_FOUND: {
        readonly code: 100402;
        readonly message: (id: string) => string;
    };
    readonly MEMBER_NAME_EMPTY: {
        readonly code: 100403;
        readonly message: () => string;
    };
    readonly MEMBER_RENAME_NO_ACCOUNT: {
        readonly code: 100404;
        readonly message: () => string;
    };
    readonly OWN_MEMBER_UNKNOWN: {
        readonly code: 100405;
        readonly message: (scope: 'its account' | 'this mesh') => string;
    };
    readonly MEMBER_REMOVE_SELF: {
        readonly code: 100406;
        readonly message: () => string;
    };
    readonly MEMBER_ROLE_UNKNOWN: {
        readonly code: 100407;
        readonly message: (role: string) => string;
    };
    readonly MEMBER_ROLE_SELF: {
        readonly code: 100408;
        readonly message: () => string;
    };
    readonly DEVICE_NOT_FOUND: {
        readonly code: 100501;
        readonly message: (id: string) => string;
    };
    readonly DEVICE_REMOVE_SELF: {
        readonly code: 100502;
        readonly message: () => string;
    };
    readonly DEVICE_NO_WRITER_KEY: {
        readonly code: 100503;
        readonly message: () => string;
    };
    readonly DEVICE_NAME_EMPTY: {
        readonly code: 100504;
        readonly message: () => string;
    };
    readonly DEVICE_NAME_TOO_LONG: {
        readonly code: 100505;
        readonly message: (max: number) => string;
    };
    readonly DEVICE_ID_UNAVAILABLE: {
        readonly code: 100506;
        readonly message: () => string;
    };
    readonly DEVICE_ROUTE_NOT_SERVED: {
        readonly code: 100507;
        readonly message: (route: string) => string;
    };
    readonly DEVICE_UNREACHABLE: {
        readonly code: 100508;
        readonly message: () => string;
    };
    readonly DEVICE_REVOKED: {
        readonly code: 100509;
        readonly message: () => string;
    };
    readonly LINK_SOURCES_ONLY: {
        readonly code: 100510;
        readonly message: () => string;
    };
    readonly MODEL_SETTINGS_ONLY: {
        readonly code: 100511;
        readonly message: () => string;
    };
    readonly AGENT_NOT_FOUND: {
        readonly code: 100601;
        readonly message: (agentId: string) => string;
    };
    readonly AGENT_HOST_AGENT_UNKNOWN: {
        readonly code: 100602;
        readonly message: () => string;
    };
    readonly AGENT_LAST_DEFAULT: {
        readonly code: 100603;
        readonly message: () => string;
    };
    readonly AGENT_DEFAULT_UNDELETABLE: {
        readonly code: 100604;
        readonly message: () => string;
    };
    readonly AGENT_DELETED: {
        readonly code: 100605;
        readonly message: (agentId: string) => string;
    };
    readonly AGENT_NOT_HOSTED_HERE: {
        readonly code: 100606;
        readonly message: () => string;
    };
    readonly AGENT_HOST_REVOKED: {
        readonly code: 100607;
        readonly message: () => string;
    };
    readonly AGENT_HOST_UNREACHABLE: {
        readonly code: 100608;
        readonly message: () => string;
    };
    readonly AGENT_HOST_SILENT: {
        readonly code: 100609;
        readonly message: () => string;
    };
    readonly PEER_SENDER_REVOKED: {
        readonly code: 100610;
        readonly message: () => string;
    };
    readonly SKILL_SETUP_FIELD_UNKNOWN: {
        readonly code: 100611;
        readonly message: () => string;
    };
    readonly SKILL_OVERLAY_OP_UNKNOWN: {
        readonly code: 100612;
        readonly message: (op: string) => string;
    };
    readonly INFERENCE_RECORDING_OFF: {
        readonly code: 100613;
        readonly message: () => string;
    };
    readonly INFERENCE_CHAT_NOT_FOUND: {
        readonly code: 100614;
        readonly message: () => string;
    };
    readonly LOAN_UNREACHABLE: {
        readonly code: 100615;
        readonly message: () => string;
    };
    readonly LOAN_REVOKED: {
        readonly code: 100616;
        readonly message: () => string;
    };
    readonly AGENT_FOLDER_NOT_ABSOLUTE: {
        readonly code: 100617;
        readonly message: (path: string) => string;
    };
    readonly AGENT_FOLDER_MISSING: {
        readonly code: 100618;
        readonly message: (path: string) => string;
    };
    readonly AGENT_FOLDER_IS_FILE: {
        readonly code: 100619;
        readonly message: (path: string) => string;
    };
    readonly AGENT_FOLDER_IN_STORAGE: {
        readonly code: 100620;
        readonly message: (path: string) => string;
    };
    readonly AGENT_FOLDER_NOT_SHARED: {
        readonly code: 100621;
        readonly message: (path: string) => string;
    };
    readonly AGENT_NOT_OURS: {
        readonly code: 100622;
        readonly message: () => string;
    };
    readonly AGENT_HOST_NOT_IN_WORKSPACE: {
        readonly code: 100623;
        readonly message: () => string;
    };
    readonly AGENT_NOT_SHARED: {
        readonly code: 100624;
        readonly message: (agentId: string) => string;
    };
    readonly CHAT_AGENT_UNAVAILABLE: {
        readonly code: 100625;
        readonly message: () => string;
    };
    readonly CHAT_NOT_FOUND: {
        readonly code: 100701;
        readonly message: (chatId: string) => string;
    };
    readonly CHAT_ANCHOR_SELF: {
        readonly code: 100702;
        readonly message: (chatId: string) => string;
    };
    readonly CHAT_ANCHOR_MISPLACED: {
        readonly code: 100703;
        readonly message: (anchor: string, groupId: string | undefined) => string;
    };
    readonly CHAT_GROUP_NOT_FOUND: {
        readonly code: 100704;
        readonly message: (groupId: string) => string;
    };
    readonly CHAT_GROUP_NAME_EMPTY: {
        readonly code: 100705;
        readonly message: () => string;
    };
    readonly CHAT_GROUP_NAME_TOO_LONG: {
        readonly code: 100706;
        readonly message: (max: number) => string;
    };
    readonly CHAT_GROUP_ANCHOR_SELF: {
        readonly code: 100707;
        readonly message: (groupId: string) => string;
    };
    readonly CHUNK_NOT_FOUND: {
        readonly code: 100708;
        readonly message: (chunkId: string) => string;
    };
    readonly CHUNK_PAYLOAD_INVALID: {
        readonly code: 100709;
        readonly message: (detail: string) => string;
    };
    readonly CHUNK_TYPES_UNMAPPED: {
        readonly code: 100710;
        readonly message: () => string;
    };
    readonly SEND_AGENT_REQUIRED: {
        readonly code: 100711;
        readonly message: () => string;
    };
    readonly RUN_NOT_FOUND: {
        readonly code: 100712;
        readonly message: (runId: string) => string;
    };
    readonly NOTIFICATION_ACK_AMBIGUOUS: {
        readonly code: 100713;
        readonly message: () => string;
    };
    readonly NOTIFICATION_CHAT_ACK_INCOMPLETE: {
        readonly code: 100714;
        readonly message: () => string;
    };
    readonly CHAT_FORK_NO_DEVICE: {
        readonly code: 100715;
        readonly message: () => string;
    };
    readonly CHAT_FORK_TURN_RUNNING: {
        readonly code: 100716;
        readonly message: () => string;
    };
    readonly CHAT_FORK_NO_SUCH_TURN: {
        readonly code: 100717;
        readonly message: () => string;
    };
    readonly CHAT_FORK_NOTHING_BEFORE: {
        readonly code: 100718;
        readonly message: () => string;
    };
    readonly CHAT_FORK_FILE_ARRIVING: {
        readonly code: 100720;
        readonly message: () => string;
    };
    readonly CHAT_FORK_FILE_NOT_HERE: {
        readonly code: 100721;
        readonly message: () => string;
    };
    readonly CHAT_PROJECT_LINK_NOT_PRIVATE: {
        readonly code: 100722;
        readonly message: () => string;
    };
    readonly RUN_NOT_OURS: {
        readonly code: 100723;
        readonly message: (runId: string) => string;
    };
    readonly CHAT_SHARED_NEEDS_PROJECT: {
        readonly code: 100724;
        readonly message: () => string;
    };
    readonly MODEL_REQUEST_NOT_OURS: {
        readonly code: 100725;
        readonly message: (chunkId: string) => string;
    };
    readonly MODEL_REQUEST_CLOSED: {
        readonly code: 100726;
        readonly message: (chunkId: string) => string;
    };
    readonly CHAT_PROJECT_OTHER_WORKSPACE: {
        readonly code: 100727;
        readonly message: () => string;
    };
    readonly CHAT_AGENT_SWITCH_NO_DEVICE: {
        readonly code: 100728;
        readonly message: () => string;
    };
    readonly RUN_REQUEST_NOT_OURS: {
        readonly code: 100729;
        readonly message: (chunkId: string) => string;
    };
    readonly RUN_REQUEST_TAKEN: {
        readonly code: 100730;
        readonly message: (chunkId: string) => string;
    };
    readonly CHAT_MOVE_NOT_FOUND: {
        readonly code: 100801;
        readonly message: () => string;
    };
    readonly CHAT_MOVE_SAME_MESH: {
        readonly code: 100802;
        readonly message: () => string;
    };
    readonly CHAT_MOVE_ID_CONFLICT: {
        readonly code: 100803;
        readonly message: () => string;
    };
    readonly CHAT_COMPUTE_MESH: {
        readonly code: 100804;
        readonly message: () => string;
    };
    readonly CHAT_TARGET_NOT_WRITER: {
        readonly code: 100805;
        readonly message: () => string;
    };
    readonly CHAT_MOVE_STILL_ARRIVING: {
        readonly code: 100806;
        readonly message: () => string;
    };
    readonly UPLOAD_MESH_MISSING: {
        readonly code: 100901;
        readonly message: () => string;
    };
    readonly UPLOAD_FIRST_FRAME_INCOMPLETE: {
        readonly code: 100902;
        readonly message: (kind: 'attachment' | 'knowledge') => string;
    };
    readonly UPLOAD_METADATA_INCOMPLETE: {
        readonly code: 100903;
        readonly message: () => string;
    };
    readonly FILE_ID_EXISTS: {
        readonly code: 100904;
        readonly message: () => string;
    };
    readonly UPLOAD_MIME_MISMATCH: {
        readonly code: 100905;
        readonly message: (route: string, mimeType: string) => string;
    };
    readonly KNOWLEDGE_TYPE_UNSUPPORTED: {
        readonly code: 100906;
        readonly message: (fileName: string) => string;
    };
    readonly IMAGE_INVALID: {
        readonly code: 100907;
        readonly message: (mimeType: string) => string;
    };
    readonly IMAGE_DECODE_FAILED: {
        readonly code: 100908;
        readonly message: (mimeType: string) => string;
    };
    readonly UPLOAD_TOO_LARGE: {
        readonly code: 100909;
        readonly message: (kind: 'attachment' | 'knowledge', maxBytes: number) => string;
    };
    readonly UPLOAD_TIMEOUT: {
        readonly code: 100910;
        readonly message: () => string;
    };
    readonly NOT_AN_ATTACHMENT: {
        readonly code: 100911;
        readonly message: (chunkId: string) => string;
    };
    readonly ATTACHMENT_DELETE_NOT_ORIGIN: {
        readonly code: 100912;
        readonly message: () => string;
    };
    readonly ATTACHMENT_DELETE_DROPPED: {
        readonly code: 100913;
        readonly message: () => string;
    };
    readonly KNOWLEDGE_NOT_FOUND: {
        readonly code: 100914;
        readonly message: (knowledgeId: string) => string;
    };
    readonly BLOB_UNAVAILABLE: {
        readonly code: 100915;
        readonly message: () => string;
    };
    readonly KNOWLEDGE_BASE_NOT_A_PROJECT: {
        readonly code: 100916;
        readonly message: () => string;
    };
    readonly KNOWLEDGE_CAP_REACHED: {
        readonly code: 100917;
        readonly message: (capBytes: number) => string;
    };
    readonly KNOWLEDGE_CAP_INVALID: {
        readonly code: 100918;
        readonly message: () => string;
    };
    readonly TOOL_CONFIGS_INVALID: {
        readonly code: 101001;
        readonly message: () => string;
    };
    readonly TOOL_CONFIGS_SECRET: {
        readonly code: 101002;
        readonly message: (hit: string) => string;
    };
    readonly TOOL_CONFIGS_TOO_LARGE: {
        readonly code: 101003;
        readonly message: (max: number) => string;
    };
    readonly TOOL_CONFIGS_NOT_FOUND: {
        readonly code: 101004;
        readonly message: (agentId: string, toolName: string) => string;
    };
    readonly CAPABILITY_UNBOUND: {
        readonly code: 101101;
        readonly message: (capability: string) => string;
    };
    readonly MODEL_RUNTIME_UNBOUND: {
        readonly code: 101102;
        readonly message: () => string;
    };
    readonly CAPABILITY_UNSUPPORTED: {
        readonly code: 101103;
        readonly message: (capability: string) => string;
    };
    readonly MODEL_RUNTIME_UNSUPPORTED: {
        readonly code: 101104;
        readonly message: (action: 'preload' | 'unload') => string;
    };
    readonly MODEL_NOT_DOWNLOADED: {
        readonly code: 101105;
        readonly message: (name: string) => string;
    };
    readonly MODEL_DOWNLOAD_UNAVAILABLE: {
        readonly code: 101106;
        readonly message: () => string;
    };
    readonly CUSTOM_MODEL_SOURCE_REFUSED: {
        readonly code: 101107;
        readonly message: (reason: string | null | undefined) => string;
    };
    readonly CUSTOM_MODEL_AMBIGUOUS: {
        readonly code: 101108;
        readonly message: () => string;
    };
    readonly CUSTOM_MODEL_TASK_UNSUPPORTED: {
        readonly code: 101109;
        readonly message: (task: string) => string;
    };
    readonly CUSTOM_MODEL_LABEL_TAKEN: {
        readonly code: 101110;
        readonly message: (label: string) => string;
    };
    readonly MODEL_DOWNLOAD_CLOSED: {
        readonly code: 101111;
        readonly message: () => string;
    };
    readonly OAUTH_LAUNCHER_UNAVAILABLE: {
        readonly code: 101201;
        readonly message: () => string;
    };
    readonly OAUTH_STATE_MISMATCH: {
        readonly code: 101202;
        readonly message: () => string;
    };
    readonly OAUTH_CANCELLED: {
        readonly code: 101203;
        readonly message: () => string;
    };
    readonly OAUTH_LOOPBACK_PORT_INVALID: {
        readonly code: 101204;
        readonly message: (port: number) => string;
    };
    readonly OAUTH_SUPERSEDED: {
        readonly code: 101205;
        readonly message: () => string;
    };
    readonly OAUTH_LOOPBACK_BUSY: {
        readonly code: 101206;
        readonly message: (port: number, state: string) => string;
    };
    readonly OAUTH_CALLBACK_TIMEOUT: {
        readonly code: 101207;
        readonly message: () => string;
    };
    readonly OAUTH_LOOPBACK_CLOSED: {
        readonly code: 101208;
        readonly message: () => string;
    };
    readonly OAUTH_LOOPBACK_PORT_IN_USE: {
        readonly code: 101209;
        readonly message: (port: number) => string;
    };
    readonly OAUTH_PROVIDER_ERROR: {
        readonly code: 101210;
        readonly message: (error: string) => string;
    };
    readonly OAUTH_CALLBACK_INVALID: {
        readonly code: 101211;
        readonly message: () => string;
    };
    readonly OAUTH_CLIENT_SECRET_MISSING: {
        readonly code: 101212;
        readonly message: (provider: string) => string;
    };
    readonly OAUTH_REGISTRATION_UNAVAILABLE: {
        readonly code: 101213;
        readonly message: () => string;
    };
    readonly OAUTH_REGISTRATION_FAILED: {
        readonly code: 101214;
        readonly message: (status: number, text: string) => string;
    };
    readonly OAUTH_TOKEN_ERROR: {
        readonly code: 101215;
        readonly message: (error: string, detail: string | undefined) => string;
    };
    readonly OAUTH_TOKEN_EXCHANGE_FAILED: {
        readonly code: 101216;
        readonly message: (status: number, text: string) => string;
    };
    readonly OAUTH_TOKEN_REFRESH_TIMEOUT: {
        readonly code: 101217;
        readonly message: () => string;
    };
    readonly OAUTH_TOKEN_REFRESH_FAILED: {
        readonly code: 101218;
        readonly message: (status: number, text: string) => string;
    };
    readonly OAUTH_TOKEN_EXCHANGE_TIMEOUT: {
        readonly code: 101219;
        readonly message: () => string;
    };
    readonly OAUTH_REGISTRATION_TIMEOUT: {
        readonly code: 101220;
        readonly message: () => string;
    };
    readonly SIDECAR_ENTRY_MISSING: {
        readonly code: 101301;
        readonly message: () => string;
    };
    readonly SIDECAR_EXITED: {
        readonly code: 101302;
        readonly message: (code: number) => string;
    };
    readonly RUN_STREAM_ENDED: {
        readonly code: 101303;
        readonly message: (chatId: string) => string;
    };
    readonly ASSISTANT_CLOSING: {
        readonly code: 101304;
        readonly message: () => string;
    };
    readonly RUN_LOG_NOT_ASSIGNED: {
        readonly code: 101401;
        readonly message: (runId: string) => string;
    };
    readonly RUN_LOG_SETTLED: {
        readonly code: 101402;
        readonly message: (runId: string) => string;
    };
    readonly RUN_LOG_STALE_GENERATION: {
        readonly code: 101403;
        readonly message: (runId: string) => string;
    };
    readonly RUN_LOG_STEP_OUT_OF_ORDER: {
        readonly code: 101404;
        readonly message: (runId: string, expected: number) => string;
    };
    readonly RUN_LOG_STEP_INVALID: {
        readonly code: 101405;
        readonly message: (runId: string) => string;
    };
};
export type CoreErrorName = keyof typeof DEFINITIONS;
type Adds<N extends CoreErrorName> = Parameters<(typeof DEFINITIONS)[N]['message']>;
interface CoreErrorOptions {
    readonly cause?: Error | undefined;
}
type CoreErrorArgs<N extends CoreErrorName> = [
] extends Adds<N> ? [adds?: Adds<N>, opts?: CoreErrorOptions] : [adds: Adds<N>, opts?: CoreErrorOptions];
export declare class CoreError<N extends CoreErrorName = CoreErrorName> extends QvacErrorBase {
    constructor(name: N, ...[adds, opts]: CoreErrorArgs<N>);
}
export declare function coreErrorCode(name: CoreErrorName): number;
export declare function coreErrorCodes(): ReadonlyArray<number>;
export declare function coreErrorCodeOf(err: unknown): number;
export declare function coreErrorFrom(code: number, message: string): Error;
export declare function isCoreError(err: unknown, name: CoreErrorName): boolean;
export {};
