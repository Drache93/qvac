export declare const HOMEBREW_BIN_DIRS: readonly string[];
export declare function withHomebrewPath(path: string | undefined, platformName: string): string | undefined;
export declare const EXEC_ENV_ALLOWLIST: readonly ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'USER', 'LOGNAME', 'HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'CURL_CA_BUNDLE', 'REQUESTS_CA_BUNDLE', 'NODE_EXTRA_CA_CERTS'];
export declare function execEnv(env: Readonly<Record<string, string | undefined>>, platformName: string): Record<string, string>;
export declare function spawnEnv(env: Readonly<Record<string, string | undefined>>, platformName: string, overrides?: Readonly<Record<string, string>>): Record<string, string>;
