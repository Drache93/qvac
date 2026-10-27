import { QvacErrorBase, addCodes } from '@qvac/error';
import { isRecord } from './guards.js';
export const NO_ARCHIVE_HELD = 'No archive is held for this mesh';
export const MESH_JOINING = 'This mesh is still joining: it accepts writes once it is joined';
export const DEVICE_INVITE_CHAIN_TOO_LONG = 'This device cannot invite another one: invite from another of your devices, or recover from your phrase';
export const DEVICE_UNREACHABLE = 'the device is not reachable';
export const LINK_SOURCES_ONLY = 'A model added from another device must come from a link: a path would name a file on this device.';
export const MODEL_SETTINGS_ONLY = 'Another device may read and change only the model settings of this one.';
export const NO_SUCH_AGENT = 'no agent with that id';
export const NOT_THE_HOST = 'this device does not host that agent';
export const HOST_REVOKED = 'the device hosting this agent is no longer in the mesh';
export const HOST_UNREACHABLE = 'the device hosting this agent is not connected';
export const HOST_SILENT = 'the device hosting this agent did not answer';
export const SENDER_REVOKED = 'the sending device is no longer in the mesh';
export const NOT_A_SETUP_FIELD = 'that skill declares no such setup field';
export const LOAN_UNREACHABLE = 'the device lending its model is not connected';
export const TURN_RUNNING = 'a turn up to the fork point is still running; fork once it has finished';
export const NO_SUCH_TURN = 'no turn of this chat has that run id';
export const NOTHING_BEFORE = 'nothing comes before the first turn, so there is nothing to fork';
export const FILE_NOT_HERE = 'a file in this chat is not on this device yet; open it here first';
export const UPLOAD_NAMES_NO_MESH = 'an upload must name its mesh on its first frame';
const DEFINITIONS = {
    CORE_CLOSING: {
        code: 100001,
        message: (subject = 'core') => `${subject} is closing`
    },
    COMPUTE_ROUTE_DROPPED: {
        code: 100101,
        message: (route) => `${route} is dropped on a compute mesh: it carries only delegated work`
    },
    MESH_NOT_FOUND: { code: 100102, message: (meshId) => `no such mesh: ${meshId}` },
    MESH_TRANSITION_IN_PROGRESS: {
        code: 100103,
        message: () => 'Mesh transition already in progress'
    },
    MESH_BELOW_FLOOR: { code: 100104, message: () => 'Build is below the mesh floor' },
    ACCOUNT_MESH_MISSING: {
        code: 100105,
        message: () => 'Recording a mesh needs the account mesh'
    },
    ACCOUNT_MEMBER_UNKNOWN: {
        code: 100106,
        message: () => 'This device is not part of its account yet'
    },
    MESH_WITHOUT_MEMBER: {
        code: 100107,
        message: () => 'A mesh needs this device to belong to its account member'
    },
    ACCOUNT_NOT_WRITABLE: { code: 100108, message: () => 'The account mesh is not writable' },
    ARCHIVE_NOT_ACCOUNT: {
        code: 100109,
        message: (meshId) => `Not an account this device left: ${meshId}`
    },
    ARCHIVE_NOT_FOUND: { code: 100110, message: () => NO_ARCHIVE_HELD },
    MESH_NAME_TOO_LONG: {
        code: 100111,
        message: (max) => `mesh name must be at most ${max} characters`
    },
    MESH_NAME_ACCOUNT_REFUSED: { code: 100112, message: () => 'An account mesh has no shared name' },
    ACCOUNT_MESH_CLOSE_REFUSED: {
        code: 100113,
        message: () => 'The account mesh cannot be closed'
    },
    ROUTE_RETIRED: {
        code: 100114,
        message: (route, replacement) => `${route} is retired: call ${replacement} with the same input`
    },
    MESH_STILL_JOINING: { code: 100115, message: () => MESH_JOINING },
    ROUTE_NOT_IN_ROLE: {
        code: 100116,
        message: (route, role) => `${route} is not a route of a ${role} mesh`
    },
    MESH_RULES_FROM_A_NEWER_BUILD: {
        code: 100117,
        message: (rules, known) => `mesh rules ${rules} are newer than this build's ${known}`
    },
    NOT_A_WORKSPACE: { code: 100118, message: (meshId) => `not a workspace: ${meshId}` },
    WORKSPACE_ADMIN_ONLY: {
        code: 100119,
        message: (action) => `Only an admin can ${action}`
    },
    WORKSPACE_NAME_EMPTY: { code: 100120, message: () => 'workspace name must not be empty' },
    PUBLIC_MESH_UNKNOWN: {
        code: 100121,
        message: () => "This device does not know its account's public mesh yet"
    },
    PROJECT_NOT_FOUND: {
        code: 100122,
        message: (projectId) => `project not found: ${projectId}`
    },
    PROJECT_NAME_EMPTY: { code: 100123, message: () => 'project name must not be empty' },
    PROJECT_MEMBER_NOT_IN_WORKSPACE: {
        code: 100124,
        message: () => 'Only a member of the workspace can be added to its project'
    },
    PROJECT_MEMBER_INVITE_REFUSED: {
        code: 100125,
        message: () => 'A project takes no invite: add people to it from its workspace'
    },
    WORKSPACE_LAST_ADMIN: {
        code: 100126,
        message: () => 'The last admin cannot leave while others remain: make someone else an admin first'
    },
    PROJECT_ORDER_TOO_LONG: {
        code: 100127,
        message: (max) => `A project order holds at most ${max} projects`
    },
    OWN_WORKSPACE_INVITE_REFUSED: {
        code: 100128,
        message: () => 'Your own workspace is yours alone: invite people into another workspace'
    },
    OWN_WORKSPACE_LEAVE_REFUSED: {
        code: 100129,
        message: () => 'Your own workspace cannot be left'
    },
    COMPUTE_MESH_RETIRED: {
        code: 100130,
        message: () => 'Compute meshes are retired: a model runs on the device that asks'
    },
    INVITE_INVALID: { code: 100201, message: () => 'Invalid mesh invite' },
    MESH_JOIN_CANCELED: { code: 100202, message: () => 'Mesh join canceled' },
    JOIN_NOT_PERMITTED: {
        code: 100203,
        message: () => 'Device is not permitted to join the invited mesh'
    },
    INVITE_ACCOUNT_UNREADABLE: {
        code: 100204,
        message: () => 'This device cannot reach its account to check'
    },
    MEMBER_INVITE_ACCOUNT_REFUSED: {
        code: 100205,
        message: () => 'An account mesh cannot be invited into'
    },
    DEVICE_INVITE_MESH_REFUSED: {
        code: 100206,
        message: () => 'Only an account mesh can take a device invite'
    },
    DEVICE_INVITE_CHAIN_TOO_LONG: { code: 100207, message: () => DEVICE_INVITE_CHAIN_TOO_LONG },
    MESH_HELD_BY_SIBLING: {
        code: 100208,
        message: () => 'Another of your devices holds this mesh: bring that device online, or invite from it instead'
    },
    DEVICE_INVITE_UNLINKED: {
        code: 100209,
        message: () => 'This device is not linked into your account, so it cannot invite another one: invite from another of your devices, or recover from your phrase'
    },
    DEVICE_INVITE_UNDELEGATED: {
        code: 100210,
        message: () => 'This device invite cannot pair a device into an account: mint a new one from a linked device'
    },
    DEVICE_ADMIN_LAST: {
        code: 100211,
        message: () => "An admin's last device cannot be unpaired: remove them as a member instead"
    },
    RECOVERY_NO_ACCOUNT: {
        code: 100301,
        message: () => 'This device has no account to make recoverable'
    },
    RECOVERY_PHRASE_NOT_OURS: {
        code: 100302,
        message: () => 'The phrase does not derive the identity this device holds'
    },
    RECOVERY_PHRASE_NOT_A_MEMBER: {
        code: 100303,
        message: () => "The phrase names no member of this account, so it could not recover it: publish from a device holding the account's phrase"
    },
    RECOVERY_NOT_ADOPTED: { code: 100304, message: () => 'the recovered account did not adopt' },
    RECOVERY_RECORD_NOT_FOUND: {
        code: 100305,
        message: () => 'No recovery record was found for this phrase'
    },
    MEMBER_RESOLVE_TIMEOUT: {
        code: 100401,
        message: () => 'resolving our member in this mesh timed out'
    },
    MEMBER_NOT_FOUND: {
        code: 100402,
        message: (id) => `member not found: ${id}`
    },
    MEMBER_NAME_EMPTY: {
        code: 100403,
        message: () => 'member name must not be empty'
    },
    MEMBER_RENAME_NO_ACCOUNT: {
        code: 100404,
        message: () => 'no account to rename the member in'
    },
    OWN_MEMBER_UNKNOWN: {
        code: 100405,
        message: (scope) => `this device is in no member of ${scope}`
    },
    MEMBER_REMOVE_SELF: {
        code: 100406,
        message: () => 'cannot remove own member, use leaveMesh'
    },
    MEMBER_ROLE_UNKNOWN: { code: 100407, message: (role) => `unknown role: ${role}` },
    MEMBER_ROLE_SELF: { code: 100408, message: () => 'an admin cannot change their own role' },
    DEVICE_NOT_FOUND: {
        code: 100501,
        message: (id) => `device not found: ${id}`
    },
    DEVICE_REMOVE_SELF: {
        code: 100502,
        message: () => 'cannot remove own device, use leaveMesh'
    },
    DEVICE_NO_WRITER_KEY: {
        code: 100503,
        message: () => 'device has no writer key, cannot remove'
    },
    DEVICE_NAME_EMPTY: {
        code: 100504,
        message: () => 'device name must not be empty'
    },
    DEVICE_NAME_TOO_LONG: {
        code: 100505,
        message: (max) => `device name must be at most ${max} characters`
    },
    DEVICE_ID_UNAVAILABLE: {
        code: 100506,
        message: () => 'cannot record tool activity without a device id'
    },
    DEVICE_ROUTE_NOT_SERVED: {
        code: 100507,
        message: (route) => `${route} is not served on this device`
    },
    DEVICE_UNREACHABLE: { code: 100508, message: () => DEVICE_UNREACHABLE },
    DEVICE_REVOKED: {
        code: 100509,
        message: () => 'the device no longer takes requests from this one'
    },
    LINK_SOURCES_ONLY: { code: 100510, message: () => LINK_SOURCES_ONLY },
    MODEL_SETTINGS_ONLY: { code: 100511, message: () => MODEL_SETTINGS_ONLY },
    AGENT_NOT_FOUND: {
        code: 100601,
        message: (agentId) => `agent not found: ${agentId}`
    },
    AGENT_HOST_AGENT_UNKNOWN: { code: 100602, message: () => NO_SUCH_AGENT },
    AGENT_LAST_DEFAULT: {
        code: 100603,
        message: () => 'cannot clear the last default agent of this member'
    },
    AGENT_DEFAULT_UNDELETABLE: { code: 100604, message: () => 'cannot delete the default agent' },
    AGENT_DELETED: { code: 100605, message: (agentId) => `agent is deleted: ${agentId}` },
    AGENT_NOT_HOSTED_HERE: { code: 100606, message: () => NOT_THE_HOST },
    AGENT_HOST_REVOKED: { code: 100607, message: () => HOST_REVOKED },
    AGENT_HOST_UNREACHABLE: { code: 100608, message: () => HOST_UNREACHABLE },
    AGENT_HOST_SILENT: { code: 100609, message: () => HOST_SILENT },
    PEER_SENDER_REVOKED: { code: 100610, message: () => SENDER_REVOKED },
    SKILL_SETUP_FIELD_UNKNOWN: { code: 100611, message: () => NOT_A_SETUP_FIELD },
    SKILL_OVERLAY_OP_UNKNOWN: {
        code: 100612,
        message: (op) => `unknown skill overlay op: ${op}`
    },
    INFERENCE_RECORDING_OFF: {
        code: 100613,
        message: () => 'this device is not recording prompts right now'
    },
    INFERENCE_CHAT_NOT_FOUND: {
        code: 100614,
        message: () => 'no such chat on the device hosting this agent'
    },
    LOAN_UNREACHABLE: { code: 100615, message: () => LOAN_UNREACHABLE },
    LOAN_REVOKED: { code: 100616, message: () => 'the device stopped lending its model' },
    AGENT_FOLDER_NOT_ABSOLUTE: {
        code: 100617,
        message: (path) => `a shared folder is an absolute path, not ${path}`
    },
    AGENT_FOLDER_MISSING: {
        code: 100618,
        message: (path) => `there is no folder at ${path}`
    },
    AGENT_FOLDER_IS_FILE: {
        code: 100619,
        message: (path) => `${path} is a file, not a folder`
    },
    AGENT_FOLDER_IN_STORAGE: {
        code: 100620,
        message: (path) => `${path} is inside the app's own storage, which no agent may reach`
    },
    AGENT_FOLDER_NOT_SHARED: {
        code: 100621,
        message: (path) => `${path} is not shared with this agent`
    },
    AGENT_NOT_OURS: {
        code: 100622,
        message: () => 'Only the person whose device runs an agent shares it'
    },
    AGENT_HOST_NOT_IN_WORKSPACE: {
        code: 100623,
        message: () => 'The device that runs this agent has not joined the workspace'
    },
    AGENT_NOT_SHARED: {
        code: 100624,
        message: (agentId) => `agent is not shared in this workspace: ${agentId}`
    },
    CHAT_AGENT_UNAVAILABLE: {
        code: 100625,
        message: () => "This chat's agent is no longer shared with you: pick another agent"
    },
    CHAT_NOT_FOUND: {
        code: 100701,
        message: (chatId) => `chat not found: ${chatId}`
    },
    CHAT_ANCHOR_SELF: {
        code: 100702,
        message: (chatId) => `a chat cannot be placed after itself: ${chatId}`
    },
    CHAT_ANCHOR_MISPLACED: {
        code: 100703,
        message: (anchor, groupId) => `chat ${anchor} is not in the ${groupId ? `group ${groupId}` : 'ungrouped list'}`
    },
    CHAT_GROUP_NOT_FOUND: {
        code: 100704,
        message: (groupId) => `chat group not found: ${groupId}`
    },
    CHAT_GROUP_NAME_EMPTY: {
        code: 100705,
        message: () => 'chat group name is required'
    },
    CHAT_GROUP_NAME_TOO_LONG: {
        code: 100706,
        message: (max) => `chat group name exceeds ${max} characters`
    },
    CHAT_GROUP_ANCHOR_SELF: {
        code: 100707,
        message: (groupId) => `a chat group cannot be placed after itself: ${groupId}`
    },
    CHUNK_NOT_FOUND: {
        code: 100708,
        message: (chunkId) => `chunk not found: ${chunkId}`
    },
    CHUNK_PAYLOAD_INVALID: {
        code: 100709,
        message: (detail) => `chunk payload invalid: ${detail}`
    },
    CHUNK_TYPES_UNMAPPED: {
        code: 100710,
        message: () => 'multiple chunk types require a mapped index'
    },
    SEND_AGENT_REQUIRED: {
        code: 100711,
        message: () => 'send-message: agentId is required to mint a chat'
    },
    RUN_NOT_FOUND: {
        code: 100712,
        message: (runId) => `run not found: ${runId}`
    },
    NOTIFICATION_ACK_AMBIGUOUS: {
        code: 100713,
        message: () => 'notification acknowledgement must select one source'
    },
    NOTIFICATION_CHAT_ACK_INCOMPLETE: {
        code: 100714,
        message: () => 'chat acknowledgement requires chatId and seq'
    },
    CHAT_FORK_NO_DEVICE: {
        code: 100715,
        message: () => 'this device has no identity yet, so it cannot write a fork'
    },
    CHAT_FORK_TURN_RUNNING: {
        code: 100716,
        message: () => TURN_RUNNING
    },
    CHAT_FORK_NO_SUCH_TURN: {
        code: 100717,
        message: () => NO_SUCH_TURN
    },
    CHAT_FORK_NOTHING_BEFORE: {
        code: 100718,
        message: () => NOTHING_BEFORE
    },
    CHAT_FORK_FILE_ARRIVING: {
        code: 100720,
        message: () => 'a file in this chat is still arriving; fork once it has landed'
    },
    CHAT_FORK_FILE_NOT_HERE: {
        code: 100721,
        message: () => FILE_NOT_HERE
    },
    CHAT_PROJECT_LINK_NOT_PRIVATE: {
        code: 100722,
        message: () => "only a chat in your account links to a project; a project's own chats are in it"
    },
    RUN_NOT_OURS: {
        code: 100723,
        message: (runId) => `run ${runId} is another member's; only its owner writes to it`
    },
    CHAT_SHARED_NEEDS_PROJECT: {
        code: 100724,
        message: () => 'a shared chat names the project it is written into'
    },
    MODEL_REQUEST_NOT_OURS: {
        code: 100725,
        message: (chunkId) => `model-request ${chunkId} is not this device's to change`
    },
    MODEL_REQUEST_CLOSED: {
        code: 100726,
        message: (chunkId) => `model-request ${chunkId} has already ended`
    },
    CHAT_PROJECT_OTHER_WORKSPACE: {
        code: 100727,
        message: () => "a chat links only projects of its own workspace: start one in the project's"
    },
    CHAT_AGENT_SWITCH_NO_DEVICE: {
        code: 100728,
        message: () => "this device has no identity yet, so it cannot switch a chat's agent"
    },
    RUN_REQUEST_NOT_OURS: {
        code: 100729,
        message: (chunkId) => `run-request ${chunkId} is not this device's to take`
    },
    RUN_REQUEST_TAKEN: {
        code: 100730,
        message: (chunkId) => `run-request ${chunkId} is not open to take`
    },
    CHAT_MOVE_NOT_FOUND: {
        code: 100801,
        message: () => 'no move of this chat is recorded on this device'
    },
    CHAT_MOVE_SAME_MESH: {
        code: 100802,
        message: () => 'a chat is moved to another mesh, not the one it is in'
    },
    CHAT_MOVE_ID_CONFLICT: {
        code: 100803,
        message: () => 'the target already holds this chat under another id'
    },
    CHAT_COMPUTE_MESH: {
        code: 100804,
        message: () => 'a compute mesh carries no chats'
    },
    CHAT_TARGET_NOT_WRITER: {
        code: 100805,
        message: () => 'this device cannot write to the target mesh'
    },
    CHAT_MOVE_STILL_ARRIVING: {
        code: 100806,
        message: () => 'this chat is still arriving from a move; move it once it has landed'
    },
    UPLOAD_MESH_MISSING: {
        code: 100901,
        message: () => UPLOAD_NAMES_NO_MESH
    },
    UPLOAD_FIRST_FRAME_INCOMPLETE: {
        code: 100902,
        message: (kind) => `upload${kind === 'knowledge' ? 'Knowledge' : 'Attachment'}: first frame must carry chatId, fileName, mimeType${kind === 'attachment' ? ', originDeviceId' : ''}`
    },
    UPLOAD_METADATA_INCOMPLETE: {
        code: 100903,
        message: () => 'upload metadata is incomplete'
    },
    FILE_ID_EXISTS: {
        code: 100904,
        message: () => 'file id already exists'
    },
    UPLOAD_MIME_MISMATCH: {
        code: 100905,
        message: (route, mimeType) => `${route}: bytes do not match declared mime ${mimeType}`
    },
    KNOWLEDGE_TYPE_UNSUPPORTED: {
        code: 100906,
        message: (fileName) => `${fileName} is not a supported Knowledge file.`
    },
    IMAGE_INVALID: {
        code: 100907,
        message: (mimeType) => `uploadAttachment: bytes are not a valid image for ${mimeType}`
    },
    IMAGE_DECODE_FAILED: {
        code: 100908,
        message: (mimeType) => `uploadAttachment: could not decode ${mimeType} image (it may be corrupt)`
    },
    UPLOAD_TOO_LARGE: {
        code: 100909,
        message: (kind, maxBytes) => `${kind} too large ${kind === 'attachment' ? '\u2014' : '-'} the limit is ${maxBytes} bytes`
    },
    UPLOAD_TIMEOUT: {
        code: 100910,
        message: () => 'upload source timed out'
    },
    NOT_AN_ATTACHMENT: {
        code: 100911,
        message: (chunkId) => `not an attachment chunk: ${chunkId}`
    },
    ATTACHMENT_DELETE_NOT_ORIGIN: {
        code: 100912,
        message: () => 'only the origin device may delete an attachment'
    },
    ATTACHMENT_DELETE_DROPPED: {
        code: 100913,
        message: () => 'delete-attachment dropped \u2014 only the origin device may delete an attachment'
    },
    KNOWLEDGE_NOT_FOUND: {
        code: 100914,
        message: (knowledgeId) => `knowledge not found: ${knowledgeId}`
    },
    BLOB_UNAVAILABLE: {
        code: 100915,
        message: () => 'blob unavailable'
    },
    KNOWLEDGE_BASE_NOT_A_PROJECT: {
        code: 100916,
        message: () => 'only a project has a knowledge base: name a chat to add this file to'
    },
    KNOWLEDGE_CAP_REACHED: {
        code: 100917,
        message: (capBytes) => `this project's knowledge base is full: its cap is ${capBytes} bytes`
    },
    KNOWLEDGE_CAP_INVALID: {
        code: 100918,
        message: () => 'a knowledge cap must be at least 1 byte'
    },
    TOOL_CONFIGS_INVALID: {
        code: 101001,
        message: () => 'tool configs must be a plain object'
    },
    TOOL_CONFIGS_SECRET: {
        code: 101002,
        message: (hit) => `tool configs must not carry secrets (${hit}); ` +
            'keep the secret device-local and store a mesh-safe reference instead'
    },
    TOOL_CONFIGS_TOO_LARGE: {
        code: 101003,
        message: (max) => `tool configs exceed the ${max} byte wire cap`
    },
    TOOL_CONFIGS_NOT_FOUND: {
        code: 101004,
        message: (agentId, toolName) => `tool configs not found: ${agentId}/${toolName}`
    },
    CAPABILITY_UNBOUND: {
        code: 101101,
        message: (capability) => `no ${capability} bound`
    },
    MODEL_RUNTIME_UNBOUND: {
        code: 101102,
        message: () => 'no model runtime is bound'
    },
    CAPABILITY_UNSUPPORTED: {
        code: 101103,
        message: (capability) => `harness does not support ${capability}`
    },
    MODEL_RUNTIME_UNSUPPORTED: {
        code: 101104,
        message: (action) => `the model runtime cannot ${action} a model`
    },
    MODEL_NOT_DOWNLOADED: {
        code: 101105,
        message: (name) => `${name} is not downloaded on this device`
    },
    MODEL_DOWNLOAD_UNAVAILABLE: {
        code: 101106,
        message: () => 'model download reconciler is unavailable'
    },
    CUSTOM_MODEL_SOURCE_REFUSED: {
        code: 101107,
        message: (reason) => reason || 'The model source was refused.'
    },
    CUSTOM_MODEL_AMBIGUOUS: {
        code: 101108,
        message: () => 'This repository holds several models; add one of its files.'
    },
    CUSTOM_MODEL_TASK_UNSUPPORTED: {
        code: 101109,
        message: (task) => `This is ${/^[aeiou]/i.test(task) ? 'an' : 'a'} ${task} model. Custom models run as the assistant's text model only.`
    },
    CUSTOM_MODEL_LABEL_TAKEN: {
        code: 101110,
        message: (label) => `${label} is already the name of another model you added.`
    },
    MODEL_DOWNLOAD_CLOSED: {
        code: 101111,
        message: () => 'model download reconciler is closed'
    },
    OAUTH_LAUNCHER_UNAVAILABLE: {
        code: 101201,
        message: () => 'OAuth browser launcher is unavailable; inject openUrl or createRedirect'
    },
    OAUTH_STATE_MISMATCH: {
        code: 101202,
        message: () => 'OAuth state mismatch (possible CSRF)'
    },
    OAUTH_CANCELLED: {
        code: 101203,
        message: () => 'OAuth flow cancelled'
    },
    OAUTH_LOOPBACK_PORT_INVALID: {
        code: 101204,
        message: (port) => `OAuth loopback port must be an integer in [0, 65535], got ${port}`
    },
    OAUTH_SUPERSEDED: {
        code: 101205,
        message: () => 'OAuth loopback superseded by a new connect attempt'
    },
    OAUTH_LOOPBACK_BUSY: {
        code: 101206,
        message: (port, state) => `OAuth loopback on port ${port} already has a flow on state ${state}`
    },
    OAUTH_CALLBACK_TIMEOUT: {
        code: 101207,
        message: () => 'OAuth callback timed out'
    },
    OAUTH_LOOPBACK_CLOSED: {
        code: 101208,
        message: () => 'OAuth loopback closed'
    },
    OAUTH_LOOPBACK_PORT_IN_USE: {
        code: 101209,
        message: (port) => `OAuth loopback port ${port} is already in use by another process`
    },
    OAUTH_PROVIDER_ERROR: {
        code: 101210,
        message: (error) => `OAuth error: ${error}`
    },
    OAUTH_CALLBACK_INVALID: {
        code: 101211,
        message: () => 'OAuth callback missing code'
    },
    OAUTH_CLIENT_SECRET_MISSING: {
        code: 101212,
        message: (provider) => `Client secret is required for ${provider}.`
    },
    OAUTH_REGISTRATION_UNAVAILABLE: {
        code: 101213,
        message: () => 'Dynamic client registration requested without a registration endpoint'
    },
    OAUTH_REGISTRATION_FAILED: {
        code: 101214,
        message: (status, text) => `Client registration failed (${status}): ${text}`
    },
    OAUTH_TOKEN_ERROR: {
        code: 101215,
        message: (error, detail) => `Token endpoint returned an error: ${error}${detail ? ` \u2014 ${detail}` : ''}`
    },
    OAUTH_TOKEN_EXCHANGE_FAILED: {
        code: 101216,
        message: (status, text) => `Token exchange failed (${status}): ${text}`
    },
    OAUTH_TOKEN_REFRESH_TIMEOUT: {
        code: 101217,
        message: () => 'OAuth token refresh timed out'
    },
    OAUTH_TOKEN_REFRESH_FAILED: {
        code: 101218,
        message: (status, text) => `Token refresh failed (${status}): ${text}`
    },
    OAUTH_TOKEN_EXCHANGE_TIMEOUT: {
        code: 101219,
        message: () => 'OAuth token exchange timed out'
    },
    OAUTH_REGISTRATION_TIMEOUT: {
        code: 101220,
        message: () => 'OAuth client registration timed out'
    },
    SIDECAR_ENTRY_MISSING: {
        code: 101301,
        message: () => 'sidecar mode needs a stowed bundle entry'
    },
    SIDECAR_EXITED: {
        code: 101302,
        message: (code) => `sidecar exited (${code}) before ready`
    },
    RUN_STREAM_ENDED: {
        code: 101303,
        message: (chatId) => `chunk stream ended before the run settled: ${chatId}`
    },
    ASSISTANT_CLOSING: {
        code: 101304,
        message: () => 'assistant is closing'
    },
    RUN_LOG_NOT_ASSIGNED: {
        code: 101401,
        message: (runId) => `run ${runId} is not one this device runs`
    },
    RUN_LOG_SETTLED: {
        code: 101402,
        message: (runId) => `run ${runId} has settled, so its log cannot be reopened`
    },
    RUN_LOG_STALE_GENERATION: {
        code: 101403,
        message: (runId) => `the log of run ${runId} was reopened by a newer lease`
    },
    RUN_LOG_STEP_OUT_OF_ORDER: {
        code: 101404,
        message: (runId, expected) => `run ${runId} expected step ${expected}: a step is appended once, in order`
    },
    RUN_LOG_STEP_INVALID: {
        code: 101405,
        message: (runId) => `the step for run ${runId} is not a run-log step`
    }
};
export class CoreError extends QvacErrorBase {
    constructor(name, ...[adds, opts]) {
        super({ code: DEFINITIONS[name].code, adds: adds ?? [], cause: opts?.cause });
    }
}
export function coreErrorCode(name) {
    return DEFINITIONS[name].code;
}
export function coreErrorCodes() {
    return Object.values(DEFINITIONS).map(({ code }) => code);
}
const CODES = new Set(coreErrorCodes());
export function coreErrorCodeOf(err) {
    const code = isRecord(err) ? Number(err.code) : 0;
    return CODES.has(code) ? code : 0;
}
export function coreErrorFrom(code, message) {
    if (!CODES.has(code)) {
        return new Error(message);
    }
    const err = new QvacErrorBase({ code });
    err.message = message;
    return err;
}
export function isCoreError(err, name) {
    return isRecord(err) && String(err.code) === String(DEFINITIONS[name].code);
}
function register() {
    const codes = {};
    for (const [name, { code, message }] of Object.entries(DEFINITIONS)) {
        codes[code] = { name, message };
    }
    addCodes(codes, { name: '@qvac/core', version: `${Object.keys(codes).length}.0.0` });
}
register();
