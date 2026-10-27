import { randomId } from './id.js';
import b4a from 'b4a';
import { APPROVAL_RULES } from './collections.js';
export async function listApprovalRules(store) {
    const snap = store.view.snapshot();
    try {
        const rules = await snap.find(APPROVAL_RULES).toArray();
        return rules;
    }
    finally {
        await snap.close();
    }
}
export async function putApprovalRule(store, input) {
    const now = Date.now();
    const rule = { ...input, id: randomId(), createdAt: now, updatedAt: now };
    await store.dispatch('put-approval-rule', { rule });
    return rule;
}
export function matchApprovalRule(rules, input, now = Date.now()) {
    for (const rule of rules) {
        if (!input.memberId || !rule.memberId || !b4a.equals(rule.memberId, input.memberId)) {
            continue;
        }
        if (rule.expiresAt && rule.expiresAt <= now)
            continue;
        if (rule.toolName && rule.toolName !== input.toolName) {
            continue;
        }
        if (rule.agentId && rule.agentId !== input.agentId) {
            continue;
        }
        if (!matchesResource(rule, input.resource ?? null)) {
            continue;
        }
        return rule;
    }
    return null;
}
function matchesResource(rule, resource) {
    if (!rule.resourceKind || !rule.resourcePattern || rule.resourcePattern === '*') {
        return true;
    }
    if (!resource || resource.kind !== rule.resourceKind)
        return false;
    return rule.resourcePattern.endsWith('*')
        ? resource.label.startsWith(rule.resourcePattern.slice(0, -1))
        : resource.label === rule.resourcePattern;
}
