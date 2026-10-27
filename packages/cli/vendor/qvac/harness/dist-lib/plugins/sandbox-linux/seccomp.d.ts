export type SeccompArch = 'x64' | 'arm64';
export declare function seccompProgram(arch: SeccompArch): Uint8Array;
