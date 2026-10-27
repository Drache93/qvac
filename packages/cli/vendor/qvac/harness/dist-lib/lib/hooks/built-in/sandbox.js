import { bareBin } from '../../tools/exec/scope.js';
import { ShellLine } from '../../tools/exec/shell-line.js';
const NETWORK_BINS = new Set([
    'curl',
    'wget',
    'nc',
    'ncat',
    'netcat',
    'ssh',
    'scp',
    'sftp',
    'rsync',
    'ftp',
    'telnet',
    'git',
    'npm',
    'npx',
    'pnpm',
    'yarn',
    'bun',
    'pip',
    'pip3',
    'brew',
    'dig',
    'nslookup',
    'ping',
    'openssl'
]);
export class SandboxHook {
    name = 'sandbox';
    phase = 'preToolCall';
    run(ctx) {
        if (ctx.phase !== 'preToolCall')
            return;
        if (ctx.network !== 'off' || ctx.toolName !== 'exec')
            return;
        const line = ShellLine.parse(String(ctx.args.command ?? ''));
        if (line.constructs.some((each) => each.kind === 'eval')) {
            return {
                kind: 'hook-rejection',
                error: 'the network is off: eval, ., source, trap or a builtin given $ or ` runs code that may reach it',
                guidance: true
            };
        }
        for (const { argv, expands } of line.commands) {
            if (expands[0]) {
                return {
                    kind: 'hook-rejection',
                    error: `the network is off: ${argv[0]} names a program only once the shell expands it`,
                    guidance: true
                };
            }
            const bin = bareBin((argv[0] ?? '').replace(/^.*[/\\]/, ''));
            if (bin && NETWORK_BINS.has(bin)) {
                return {
                    kind: 'hook-rejection',
                    error: `the network is off: ${bin} reaches the network`,
                    guidance: true
                };
            }
        }
    }
}
