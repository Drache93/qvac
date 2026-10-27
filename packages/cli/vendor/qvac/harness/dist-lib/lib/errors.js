import { QvacErrorBase, addCodes } from '@qvac/error';
import { isRecord } from './guards.js';
const HARNESS_ERRORS = {
    ABORTED: { code: 102001, message: () => 'aborted' },
    HARNESS_CLOSING: { code: 102002, message: () => 'harness is closing' },
    HARNESS_SUSPENDED: { code: 102003, message: () => 'harness is suspended' },
    HARNESS_EXITED_BEFORE_READY: {
        code: 102004,
        message: (exitCode) => `harness exited (${exitCode}) before ready`
    },
    CAPABILITY_UNSUPPORTED: {
        code: 102005,
        message: (what) => `harness does not support ${what}`
    },
    UNKNOWN_CAPABILITY: {
        code: 102006,
        message: (capability) => `unknown capability: ${capability}`
    },
    CLIENT_GONE: { code: 102007, message: () => 'client gone' },
    RPC_STREAM_DESTROYED: { code: 102008, message: () => 'rpc stream destroyed' },
    EMBED_ABORTED: { code: 102009, message: () => 'embed aborted' },
    NO_SKILLS_OVERLAY: { code: 102010, message: () => 'no writable skills overlay is configured' },
    CHAT_MODEL_BUSY: {
        code: 102101,
        message: (output) => `the chat model is busy; try the ${output} again once the current reply finishes`
    },
    MODEL_NOT_RESIDENT: {
        code: 102102,
        message: (model) => `${model} loads for each generation and is not kept in memory`
    },
    AUDIOGEN_MODEL_NOT_FOUND: {
        code: 102103,
        message: (model) => `audiogen model not found: ${model}`
    },
    MODEL_NOT_IN_REGISTRY: {
        code: 102104,
        message: (model, addon) => `model not found in registry: ${model} (addon=${addon})`
    },
    MODEL_LOAD_CLOCK_SKEW: {
        code: 102105,
        message: (model) => `model load abandoned: system clock moved backward mid-load: ${model}`
    },
    IMAGE_LOAD_STALLED: { code: 102106, message: () => 'image model download stalled' },
    TRANSLATION_LOAD_STALLED: {
        code: 102107,
        message: () => 'translation model download stalled'
    },
    CONTEXT_WINDOW_EXCEEDED: {
        code: 102201,
        message: () => 'This message is too large for the model context window.'
    },
    TTS_NO_AUDIO: { code: 102202, message: () => 'Text-to-speech returned no audio.' },
    TTS_INCOMPLETE: { code: 102203, message: () => 'tts synthesis did not complete' },
    FETCH_TIMED_OUT: { code: 102301, message: (ms) => `Request timed out after ${ms}ms` },
    FETCH_CANCELLED: { code: 102302, message: () => 'Request cancelled' },
    RESPONSE_NOT_JSON: {
        code: 102303,
        message: (chars, detail) => `Response was not valid JSON (${chars} chars): ${detail}`
    },
    HTTP_STATUS: { code: 102304, message: (status) => `HTTP ${status}` },
    SEARCH_CAPTCHA: { code: 102305, message: (engine) => `${engine} CAPTCHA detected` },
    RESPONSE_TOO_LARGE: {
        code: 102306,
        message: (maxBytes) => `response exceeded ${maxBytes} bytes`
    },
    UNSUPPORTED_HTTP_METHOD: {
        code: 102307,
        message: (method) => `unsupported HTTP method: ${method}`
    },
    GEOCODER_HTTP_STATUS: {
        code: 102308,
        message: (status) => `geocoder answered HTTP ${status}`
    },
    EGRESS_BLOCKED: { code: 102309, message: (reason) => reason },
    OFFICE_UNSUPPORTED_DOCUMENT: {
        code: 102401,
        message: (fileName) => `Unsupported Office document: ${fileName}`
    },
    OFFICE_TOO_LARGE: {
        code: 102402,
        message: (bytes, limit) => `document is too large to extract: ${bytes} bytes, limit ${limit}`
    },
    OFFICE_EXTRACTION_ABORTED: {
        code: 102403,
        message: (fileName) => `${fileName}: extraction aborted`
    },
    OFFICE_EXTRACTION_FAILED: {
        code: 102404,
        message: (fileName, detail) => `${fileName}: ${detail}`
    },
    OFFICE_OP_UNAVAILABLE: {
        code: 102405,
        message: (op) => `${op} is not available on this file`
    },
    COMMAND_TIMED_OUT: { code: 102501, message: (ms) => `Command timed out after ${ms}ms` },
    PACKAGE_INSTALL_TIMED_OUT: {
        code: 102502,
        message: (ms) => `package install timed out after ${ms}ms`
    },
    PYTHON_WORKER_FAILED: { code: 102503, message: (detail) => `python worker: ${detail}` },
    PYTHON_WORKER_EXITED: {
        code: 102504,
        message: (exitCode) => `python worker exited with code ${exitCode}`
    },
    ATTACHMENT_STAGING_TIMED_OUT: {
        code: 102505,
        message: (ms) => `staging attachments timed out after ${ms}ms`
    },
    FETCH_REFUSED: { code: 102506, message: (reason) => `fetch refused: ${reason}` },
    OBSIDIAN_NOTE_NAME_IS_PATH: {
        code: 102601,
        message: () => 'name= must be a note name, not a path.'
    },
    OBSIDIAN_NOTE_NOT_FOUND: {
        code: 102602,
        message: (args) => `Note not found. Args: ${args.join(', ')}`
    },
    OBSIDIAN_MISSING_ARGUMENT: {
        code: 102603,
        message: (names) => `Missing required argument: ${names}`
    },
    OBSIDIAN_NO_PROPERTIES: { code: 102604, message: () => 'No property key=value pairs provided.' },
    OBSIDIAN_NOTE_EXISTS: {
        code: 102605,
        message: (name, folder) => `Note "${name}" already exists at ${folder}`
    },
    OBSIDIAN_ACTION_UNSUPPORTED: {
        code: 102606,
        message: (action) => `Action "${action}" is not supported in vault file mode. ` +
            `This action requires the Obsidian CLI connected to the running app.`
    },
    OBSIDIAN_NOTE_CHANGED: {
        code: 102607,
        message: (why, file) => `Note changed on disk during update (${why}): ${file}`
    },
    OBSIDIAN_PATH_CROSSES_SYMLINK: {
        code: 102608,
        message: (target) => `Path "${target}" crosses a symlink inside the vault.`
    },
    OBSIDIAN_PATH_ESCAPES_VAULT: {
        code: 102609,
        message: (rel) => `Path "${rel}" escapes the vault root.`
    },
    OBSIDIAN_DESTINATION_EXISTS: {
        code: 102610,
        message: (filePath) => `Destination already exists: ${filePath}`
    },
    OBSIDIAN_PATH_IS_FOLDER: {
        code: 102611,
        message: (folder) => `"${folder || '.'}" is a folder, not a note. List it with ` +
            (folder ? `\`obsidian files folder="${folder}"\`` : '`obsidian files`') +
            ', then read one note by its path.'
    },
    SKILL_FILE_NOT_FOUND: {
        code: 102701,
        message: (name, file) => `ENOENT: ${name}/${file}`
    },
    INVALID_SKILL_NAME: { code: 102702, message: (name) => `invalid skill name: ${name}` },
    SKILL_NOT_FOUND: { code: 102703, message: (name) => `skill not found: ${name}` },
    BUNDLED_SKILLS_INVALID: {
        code: 102704,
        message: (staging) => `bundled skills staging dir ${staging} failed validation`
    },
    BUNDLED_SKILLS_TAMPERED: {
        code: 102705,
        message: (dir) => `bundled skills dir ${dir} failed validation after a rewrite — ` +
            'another process is tampering with it; remove it and restart'
    },
    BUNDLED_SKILLS_OCCUPIED: {
        code: 102706,
        message: (dir, why) => `bundled skills dir ${dir} could not be read or replaced${why} — remove it and restart`
    },
    DRIVE_TIMED_OUT: { code: 102707, message: (op) => `drive ${op} timed out` },
    DRIVE_READ_TRUNCATED: {
        code: 102708,
        message: (maxBytes, key) => `read stopped at ${maxBytes} bytes: ${key}`
    },
    NO_STORAGE_ROOT: {
        code: 102709,
        message: () => 'cannot fence the app storage root: the SDK home is unknown'
    },
    SLM_TRANSLATION_UNAVAILABLE: { code: 102710, message: () => 'slm translation is unavailable' },
    PDF_TEXT_UNAVAILABLE: { code: 102711, message: () => 'PDF text is not available on this device' }
};
addCodes(Object.fromEntries(Object.entries(HARNESS_ERRORS).map(([name, { code, message }]) => [code, { name, message }])), { name: '@qvac/harness', version: `${Object.keys(HARNESS_ERRORS).length}.0.0` });
export class HarnessError extends QvacErrorBase {
    static CONTEXT_OVERFLOW_MESSAGE = HARNESS_ERRORS.CONTEXT_WINDOW_EXCEEDED.message();
    static IMAGE_LOAD_STALL_ERROR = HARNESS_ERRORS.IMAGE_LOAD_STALLED.message();
    static TRANSLATION_LOAD_STALL_ERROR = HARNESS_ERRORS.TRANSLATION_LOAD_STALLED.message();
    static NO_STORAGE_ROOT = HARNESS_ERRORS.NO_STORAGE_ROOT.message();
    constructor(name, ...[adds, opts]) {
        const cause = opts?.cause instanceof Error ? opts.cause : undefined;
        super({ code: HARNESS_ERRORS[name].code, adds: adds ?? [], cause });
    }
    static code(name) {
        return HARNESS_ERRORS[name].code;
    }
    static codes() {
        return Object.values(HARNESS_ERRORS).map(({ code }) => code);
    }
    static is(err, name) {
        return isRecord(err) && String(err.code) === String(HARNESS_ERRORS[name].code);
    }
}
