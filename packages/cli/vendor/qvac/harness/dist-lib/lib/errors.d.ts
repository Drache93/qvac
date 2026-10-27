import { QvacErrorBase } from '@qvac/error';
declare const HARNESS_ERRORS: {
    readonly ABORTED: {
        readonly code: 102001;
        readonly message: () => string;
    };
    readonly HARNESS_CLOSING: {
        readonly code: 102002;
        readonly message: () => string;
    };
    readonly HARNESS_SUSPENDED: {
        readonly code: 102003;
        readonly message: () => string;
    };
    readonly HARNESS_EXITED_BEFORE_READY: {
        readonly code: 102004;
        readonly message: (exitCode: number | null) => string;
    };
    readonly CAPABILITY_UNSUPPORTED: {
        readonly code: 102005;
        readonly message: (what: string) => string;
    };
    readonly UNKNOWN_CAPABILITY: {
        readonly code: 102006;
        readonly message: (capability: string) => string;
    };
    readonly CLIENT_GONE: {
        readonly code: 102007;
        readonly message: () => string;
    };
    readonly RPC_STREAM_DESTROYED: {
        readonly code: 102008;
        readonly message: () => string;
    };
    readonly EMBED_ABORTED: {
        readonly code: 102009;
        readonly message: () => string;
    };
    readonly NO_SKILLS_OVERLAY: {
        readonly code: 102010;
        readonly message: () => string;
    };
    readonly CHAT_MODEL_BUSY: {
        readonly code: 102101;
        readonly message: (output: string) => string;
    };
    readonly MODEL_NOT_RESIDENT: {
        readonly code: 102102;
        readonly message: (model: string) => string;
    };
    readonly AUDIOGEN_MODEL_NOT_FOUND: {
        readonly code: 102103;
        readonly message: (model: string) => string;
    };
    readonly MODEL_NOT_IN_REGISTRY: {
        readonly code: 102104;
        readonly message: (model: string, addon: string) => string;
    };
    readonly MODEL_LOAD_CLOCK_SKEW: {
        readonly code: 102105;
        readonly message: (model: string) => string;
    };
    readonly IMAGE_LOAD_STALLED: {
        readonly code: 102106;
        readonly message: () => string;
    };
    readonly TRANSLATION_LOAD_STALLED: {
        readonly code: 102107;
        readonly message: () => string;
    };
    readonly CONTEXT_WINDOW_EXCEEDED: {
        readonly code: 102201;
        readonly message: () => string;
    };
    readonly TTS_NO_AUDIO: {
        readonly code: 102202;
        readonly message: () => string;
    };
    readonly TTS_INCOMPLETE: {
        readonly code: 102203;
        readonly message: () => string;
    };
    readonly FETCH_TIMED_OUT: {
        readonly code: 102301;
        readonly message: (ms: number) => string;
    };
    readonly FETCH_CANCELLED: {
        readonly code: 102302;
        readonly message: () => string;
    };
    readonly RESPONSE_NOT_JSON: {
        readonly code: 102303;
        readonly message: (chars: number, detail: string) => string;
    };
    readonly HTTP_STATUS: {
        readonly code: 102304;
        readonly message: (status: number) => string;
    };
    readonly SEARCH_CAPTCHA: {
        readonly code: 102305;
        readonly message: (engine: string) => string;
    };
    readonly RESPONSE_TOO_LARGE: {
        readonly code: 102306;
        readonly message: (maxBytes: number) => string;
    };
    readonly UNSUPPORTED_HTTP_METHOD: {
        readonly code: 102307;
        readonly message: (method: string) => string;
    };
    readonly GEOCODER_HTTP_STATUS: {
        readonly code: 102308;
        readonly message: (status: number) => string;
    };
    readonly EGRESS_BLOCKED: {
        readonly code: 102309;
        readonly message: (reason: string) => string;
    };
    readonly OFFICE_UNSUPPORTED_DOCUMENT: {
        readonly code: 102401;
        readonly message: (fileName: string) => string;
    };
    readonly OFFICE_TOO_LARGE: {
        readonly code: 102402;
        readonly message: (bytes: number, limit: number) => string;
    };
    readonly OFFICE_EXTRACTION_ABORTED: {
        readonly code: 102403;
        readonly message: (fileName: string) => string;
    };
    readonly OFFICE_EXTRACTION_FAILED: {
        readonly code: 102404;
        readonly message: (fileName: string, detail: string) => string;
    };
    readonly OFFICE_OP_UNAVAILABLE: {
        readonly code: 102405;
        readonly message: (op: string) => string;
    };
    readonly COMMAND_TIMED_OUT: {
        readonly code: 102501;
        readonly message: (ms: number) => string;
    };
    readonly PACKAGE_INSTALL_TIMED_OUT: {
        readonly code: 102502;
        readonly message: (ms: number) => string;
    };
    readonly PYTHON_WORKER_FAILED: {
        readonly code: 102503;
        readonly message: (detail: string) => string;
    };
    readonly PYTHON_WORKER_EXITED: {
        readonly code: 102504;
        readonly message: (exitCode: number) => string;
    };
    readonly ATTACHMENT_STAGING_TIMED_OUT: {
        readonly code: 102505;
        readonly message: (ms: number) => string;
    };
    readonly FETCH_REFUSED: {
        readonly code: 102506;
        readonly message: (reason: string) => string;
    };
    readonly OBSIDIAN_NOTE_NAME_IS_PATH: {
        readonly code: 102601;
        readonly message: () => string;
    };
    readonly OBSIDIAN_NOTE_NOT_FOUND: {
        readonly code: 102602;
        readonly message: (args: readonly string[]) => string;
    };
    readonly OBSIDIAN_MISSING_ARGUMENT: {
        readonly code: 102603;
        readonly message: (names: string) => string;
    };
    readonly OBSIDIAN_NO_PROPERTIES: {
        readonly code: 102604;
        readonly message: () => string;
    };
    readonly OBSIDIAN_NOTE_EXISTS: {
        readonly code: 102605;
        readonly message: (name: string, folder: string) => string;
    };
    readonly OBSIDIAN_ACTION_UNSUPPORTED: {
        readonly code: 102606;
        readonly message: (action: string) => string;
    };
    readonly OBSIDIAN_NOTE_CHANGED: {
        readonly code: 102607;
        readonly message: (why: string, file: string) => string;
    };
    readonly OBSIDIAN_PATH_CROSSES_SYMLINK: {
        readonly code: 102608;
        readonly message: (target: string) => string;
    };
    readonly OBSIDIAN_PATH_ESCAPES_VAULT: {
        readonly code: 102609;
        readonly message: (rel: string) => string;
    };
    readonly OBSIDIAN_DESTINATION_EXISTS: {
        readonly code: 102610;
        readonly message: (filePath: string) => string;
    };
    readonly OBSIDIAN_PATH_IS_FOLDER: {
        readonly code: 102611;
        readonly message: (folder: string) => string;
    };
    readonly SKILL_FILE_NOT_FOUND: {
        readonly code: 102701;
        readonly message: (name: string, file: string) => string;
    };
    readonly INVALID_SKILL_NAME: {
        readonly code: 102702;
        readonly message: (name: string) => string;
    };
    readonly SKILL_NOT_FOUND: {
        readonly code: 102703;
        readonly message: (name: string) => string;
    };
    readonly BUNDLED_SKILLS_INVALID: {
        readonly code: 102704;
        readonly message: (staging: string) => string;
    };
    readonly BUNDLED_SKILLS_TAMPERED: {
        readonly code: 102705;
        readonly message: (dir: string) => string;
    };
    readonly BUNDLED_SKILLS_OCCUPIED: {
        readonly code: 102706;
        readonly message: (dir: string, why: string) => string;
    };
    readonly DRIVE_TIMED_OUT: {
        readonly code: 102707;
        readonly message: (op: string) => string;
    };
    readonly DRIVE_READ_TRUNCATED: {
        readonly code: 102708;
        readonly message: (maxBytes: number, key: string) => string;
    };
    readonly NO_STORAGE_ROOT: {
        readonly code: 102709;
        readonly message: () => string;
    };
    readonly SLM_TRANSLATION_UNAVAILABLE: {
        readonly code: 102710;
        readonly message: () => string;
    };
    readonly PDF_TEXT_UNAVAILABLE: {
        readonly code: 102711;
        readonly message: () => string;
    };
};
type Errors = typeof HARNESS_ERRORS;
export type HarnessErrorName = keyof Errors;
type Adds<K extends HarnessErrorName> = Parameters<Errors[K]['message']>;
interface HarnessErrorOptions {
    readonly cause?: unknown;
}
type HarnessErrorArgs<K extends HarnessErrorName> = [
] extends Adds<K> ? [adds?: Adds<K>, opts?: HarnessErrorOptions] : [adds: Adds<K>, opts?: HarnessErrorOptions];
export declare class HarnessError<K extends HarnessErrorName = HarnessErrorName> extends QvacErrorBase {
    static readonly CONTEXT_OVERFLOW_MESSAGE: string;
    static readonly IMAGE_LOAD_STALL_ERROR: string;
    static readonly TRANSLATION_LOAD_STALL_ERROR: string;
    static readonly NO_STORAGE_ROOT: string;
    constructor(name: K, ...[adds, opts]: HarnessErrorArgs<K>);
    static code(name: HarnessErrorName): number;
    static codes(): ReadonlyArray<number>;
    static is(err: unknown, name: HarnessErrorName): boolean;
}
export {};
