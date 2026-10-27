import { checkOutboundHost } from '../../tools/url-guard.js';
export class EgressGuardHook {
    name = 'egress-guard';
    phase = 'preToolCall';
    run(ctx) {
        if (ctx.phase !== 'preToolCall')
            return;
        const targets = ctx.egress?.(ctx.args) ?? [];
        for (const target of typeof targets === 'string' ? [targets] : targets) {
            let url;
            try {
                url = new URL(target);
            }
            catch {
                continue;
            }
            const blocked = checkOutboundHost(url);
            if (blocked) {
                return { kind: 'hook-rejection', error: blocked, guidance: true };
            }
        }
    }
}
