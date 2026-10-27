import type { ExecShell } from '../../lib/contract/exec.ts';
import type { HarnessPlugin, PluginSetup } from '../../lib/plugins/index.ts';
import { type CreateSandbox, type VmImage } from './vm-shell.ts';
export { WORKDIR_REFUSED, type CreateSandbox, type VmImage, type VmRunResult, type VmSandbox, type VmSandboxOptions } from './vm-shell.ts';
export interface VmShellOptions {
    readonly image: VmImage;
    readonly vfkit?: string;
    readonly cpus?: number;
    readonly memory?: string | number;
    readonly createSandbox?: CreateSandbox;
}
export declare class VmShell implements HarnessPlugin {
    readonly name = "sandbox-vm";
    readonly api = 1;
    readonly addons: {
        barevisor: () => Promise<typeof import("barevisor/sandbox")>;
    };
    readonly shell: ExecShell;
    private readonly _image;
    private readonly _shell;
    constructor({ createSandbox, image, ...vm }: VmShellOptions);
    validate(): string | null;
    setup(): PluginSetup;
}
