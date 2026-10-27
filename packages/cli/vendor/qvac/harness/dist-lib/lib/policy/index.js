import path from 'path';
const PRESETS = {
    'read-only': { files: { write: [] }, network: { mode: 'off' } },
    'workspace-write': { network: { mode: 'off' } },
    full: {}
};
const ORDER = ['off', 'hosts', 'on'];
const DECISIONS = ['allow', 'ask', 'deny'];
const RULE_KEYS = ['decision', 'tool', 'command', 'paths', 'hosts'];
const UNBOUNDED = bounds({});
export class Policy {
    static narrow(...layers) {
        return policyOf(layers.reduce((acc, layer) => (layer ? intersect(acc, bounds(layer)) : acc), UNBOUNDED));
    }
    static compile(policy, grants = {}) {
        const own = bounds(policy ?? {});
        const outside = (grant, roots) => roots !== null && !roots.some((root) => inside(grant, root));
        const read = (grants.read ?? []).find((grant) => outside(grant, own.read));
        if (read !== undefined) {
            throw new Error(`a granted folder is outside the policy's files.read: ${read}`);
        }
        const write = (grants.write ?? []).find((grant) => outside(grant, own.write));
        if (write !== undefined) {
            throw new Error(`a granted write folder is outside the policy's files.write: ${write}`);
        }
        return {
            files: {
                read: own.read ?? 'all',
                write: unique(grants.write ?? []),
                deny: unique([...own.deny, ...(grants.deny ?? [])])
            },
            network: networkOf(own),
            sockets: own.sockets ?? 'all',
            exec: { allow: own.allow ?? 'all', deny: own.execDeny },
            env: own.env ?? 'all',
            rules: own.rules
        };
    }
    static enforceable(policy, { enforces }) {
        if ((policy.exec.allow !== 'all' || policy.exec.deny.length > 0) && !enforces?.exec) {
            return 'cannot enforce exec.allow or exec.deny';
        }
        if (policy.env !== 'all' && !enforces?.env) {
            return 'cannot enforce an env allowlist';
        }
        if (enforces?.files === 'workspace-only' && policy.files.read !== 'all') {
            return 'confines writes only, so it cannot enforce a files.read list';
        }
        if (policy.network.mode === 'hosts' && !enforces) {
            return 'runs lines on the host, so it cannot enforce network.mode hosts';
        }
        if (enforces?.network === 'on-off' && policy.network.mode === 'hosts') {
            return 'cannot enforce network.mode hosts without the egress-proxy plugin';
        }
        const { localhost, bind } = policy.network;
        const partial = !localhost || !bind || policy.sockets !== 'all';
        const bounded = enforces?.network === 'on-off' || enforces?.network === 'hosts';
        if (bounded && policy.network.mode === 'on' && partial) {
            return 'turns the network on or off, so it cannot enforce localhost, bind or sockets under network.mode on';
        }
        return null;
    }
    static refusal(policy, providers) {
        if (!ORDER.includes(policy.network.mode)) {
            return `network.mode ${policy.network.mode} is refused: it is not off, hosts or on`;
        }
        for (const provider of providers) {
            const refused = Policy.enforceable(policy, provider);
            if (refused) {
                return `${provider.name} ${refused}`;
            }
        }
        const malformed = policy.rules.findIndex((rule) => !wellFormed(rule));
        return malformed === -1
            ? null
            : `policy rule ${malformed} is malformed: it needs a decision (allow, ask or deny), a non-empty tool, command, paths or hosts, and no other key`;
    }
    static forRun(layers, { fsRoots = [], fsWriteRoots = [], deny = [] }, providers) {
        if (!layers.some(Boolean)) {
            return undefined;
        }
        const access = Policy.compile(Policy.narrow(...layers), {
            read: local(fsRoots),
            write: local(fsWriteRoots),
            deny
        });
        const refused = Policy.refusal(access, providers);
        if (refused) {
            throw new Error(`the run's policy is refused: ${refused}`);
        }
        return access;
    }
    static withWrites(policy, roots) {
        if (roots.length === 0) {
            return policy;
        }
        return { ...policy, files: { ...policy.files, write: [...policy.files.write, ...roots] } };
    }
    static hostsOf(policy) {
        return policy?.network.mode === 'hosts' ? policy.network.hosts : undefined;
    }
    static allowsHost(hosts, host) {
        const name = hostName(host);
        return hosts.some((entry) => covers(hostName(entry), name));
    }
}
function wellFormed(rule) {
    if (typeof rule !== 'object' || rule === null || !DECISIONS.includes(rule.decision)) {
        return false;
    }
    if (Object.keys(rule).some((key) => !RULE_KEYS.includes(key))) {
        return false;
    }
    const { tool, command, paths, hosts } = rule;
    const lists = [command, paths, hosts];
    if (tool === undefined && lists.every((list) => list === undefined)) {
        return false;
    }
    return ((tool === undefined || (typeof tool === 'string' && tool !== '')) &&
        lists.every((list) => list === undefined || strings(list)));
}
function strings(list) {
    return (Array.isArray(list) &&
        list.length > 0 &&
        list.every((each) => typeof each === 'string' && each !== ''));
}
function local(roots) {
    return roots.flatMap((root) => (root.kind === 'local' ? [root.root] : []));
}
function bounds(layer) {
    const preset = layer.preset ? PRESETS[layer.preset] : {};
    const read = layer.files?.read ?? preset.files?.read ?? 'all';
    const write = layer.files?.write ?? preset.files?.write;
    const network = layer.network ?? preset.network ?? { mode: 'on' };
    const mode = ORDER.includes(network.mode) ? network.mode : 'off';
    const open = mode === 'on';
    return {
        read: read === 'all' ? null : unique(read.map(normal)),
        write: write ? unique(write.map(normal)) : null,
        deny: unique((layer.files?.deny ?? preset.files?.deny ?? []).map(normal)),
        mode,
        hosts: open ? null : unique((network.hosts ?? []).map(hostName)),
        localhost: network.localhost ?? open,
        bind: network.bind ?? open,
        sockets: socketsOf(layer.sockets, open),
        allow: layer.exec?.allow ? unique(layer.exec.allow) : null,
        execDeny: unique(layer.exec?.deny ?? []),
        env: layer.env ? unique(layer.env) : null,
        rules: layer.rules ?? []
    };
}
function socketsOf(sockets, open) {
    if (sockets) {
        return unique(sockets.map(normal));
    }
    return open ? null : [];
}
function intersect(a, b) {
    return {
        read: within(a.read, b.read),
        write: within(a.write, b.write),
        deny: unique([...a.deny, ...b.deny]),
        mode: ORDER[Math.min(ORDER.indexOf(a.mode), ORDER.indexOf(b.mode))],
        hosts: coveredHosts(a.hosts, b.hosts),
        localhost: a.localhost && b.localhost,
        bind: a.bind && b.bind,
        sockets: within(a.sockets, b.sockets),
        allow: common(a.allow, b.allow),
        execDeny: unique([...a.execDeny, ...b.execDeny]),
        env: common(a.env, b.env),
        rules: [...a.rules, ...b.rules]
    };
}
function policyOf(own) {
    return {
        files: { read: own.read ?? 'all', write: own.write ?? undefined, deny: own.deny },
        network: networkOf(own),
        sockets: own.sockets ?? undefined,
        exec: { allow: own.allow ?? undefined, deny: own.execDeny },
        env: own.env ?? undefined,
        rules: own.rules
    };
}
function networkOf(own) {
    return {
        mode: own.mode,
        hosts: own.mode === 'hosts' ? (own.hosts ?? []) : [],
        localhost: own.localhost,
        bind: own.bind
    };
}
function within(a, b) {
    if (a === null || b === null) {
        return a ?? b;
    }
    return unique([
        ...a.filter((each) => b.some((root) => inside(each, root))),
        ...b.filter((each) => a.some((root) => inside(each, root)))
    ]).sort();
}
function coveredHosts(a, b) {
    if (a === null || b === null) {
        return a ?? b;
    }
    return unique([
        ...a.filter((each) => b.some((entry) => covers(entry, each))),
        ...b.filter((each) => a.some((entry) => covers(entry, each)))
    ]).sort();
}
function covers(entry, host) {
    return host === entry || (entry.startsWith('*.') && host.endsWith(entry.slice(1)));
}
function hostName(host) {
    return host
        .toLowerCase()
        .replace(/^\[(.*)\]$/, '$1')
        .replace(/\.$/, '');
}
function common(a, b) {
    if (a === null || b === null) {
        return a ?? b;
    }
    return a.filter((each) => b.includes(each));
}
function inside(child, root) {
    const relative = path.relative(normal(root), normal(child));
    return (relative === '' ||
        (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)));
}
function normal(root) {
    return path.resolve(root);
}
function unique(items) {
    return [...new Set(items)];
}
