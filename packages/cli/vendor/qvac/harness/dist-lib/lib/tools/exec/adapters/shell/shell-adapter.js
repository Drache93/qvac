import { runCommand } from '../../runner.js';
import { savesDownload } from '../../shell-guidance.js';
export function createShellAdapter(options) {
    return {
        name: options.name ?? 'host',
        resolve(args) {
            const command = String(args.command ?? '').trim();
            return {
                async run(execution) {
                    const runtime = options.spawn
                        ? { spawn: options.spawn, killProcess: options.killProcess }
                        : await options.loadRuntime();
                    const result = await runCommand(command, {
                        ...execution,
                        spawn: runtime.spawn,
                        killProcess: runtime.killProcess
                    });
                    const note = result.exitCode === 0 && savesDownload(command) ? options.downloadNote : null;
                    if (!note) {
                        return result;
                    }
                    const stdout = `${result.stdout}${result.stdout && !result.stdout.endsWith('\n') ? '\n' : ''}${note}`;
                    return { ...result, stdout };
                }
            };
        }
    };
}
