import { isRecord } from '../guards.js';
import { humanizeBytes } from './tree.js';
const EVENT_LOOP_WARN_MS = 100;
function record(value) {
    return isRecord(value) ? value : null;
}
function at(frame, path) {
    let current = frame;
    for (const key of path) {
        const node = record(current);
        if (!node) {
            return undefined;
        }
        current = node[key];
    }
    return current;
}
function list(value) {
    return Array.isArray(value) ? value : [];
}
function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
const pass = (detail) => ({ state: 'pass', detail });
const warn = (detail, fix) => ({ state: 'warn', detail, fix });
const fail = (detail, fix) => ({ state: 'fail', detail, fix });
const pending = (detail) => ({ state: 'pending', detail });
const declared = (detail, fix) => ({ state: 'declared', detail, fix });
function check(group, name, verdict) {
    return { group, name, ...verdict };
}
function hardware(frame) {
    const cpu = record(at(frame, ['cpu']));
    const gpu = record(at(frame, ['gpu']));
    const devices = list(gpu?.['devices']);
    const tables = [gpu?.['drivers'], ...devices.map((device) => record(device)?.['drivers'])];
    const driverFlags = tables
        .flatMap((table) => Object.entries(record(table) ?? {}))
        .filter(([, on]) => typeof on === 'boolean');
    const backends = driverFlags.filter(([, on]) => on === true).map(([name]) => name);
    const out = [];
    const cpuName = typeof cpu?.['name'] === 'string' ? cpu['name'] : null;
    out.push(check('Hardware', 'cpu', cpuName ? pass(cpuName) : declared('not reported by this host')));
    if (devices.length) {
        const names = devices.map((device) => String(record(device)?.['name'] ?? 'unnamed'));
        out.push(check('Hardware', 'gpu', pass(names.join(', '))));
    }
    else {
        out.push(check('Hardware', 'gpu', declared('no gpu reported by this host')));
    }
    if (driverFlags.length > 0) {
        out.push(check('Hardware', 'gpu backends', backends.length
            ? pass([...new Set(backends)].join(', '))
            : warn('none enabled', 'no metal/vulkan/cuda/opencl backend is available, so every model runs on the cpu')));
    }
    const budget = record(at(frame, ['memoryBudget']));
    const available = num(budget?.['availableBytes']);
    if (budget && available !== null) {
        const source = String(budget['source'] ?? 'unknown');
        out.push(check('Hardware', 'model memory budget', pass(`${humanizeBytes(available)} from ${source}`)));
    }
    return out;
}
function engine(samples, frame) {
    const harness = record(at(frame, ['harness']));
    const assistant = record(at(frame, ['assistant']));
    const out = [];
    const resident = list(harness?.['models']).length;
    if (harness?.['sdkLoaded'] === true) {
        out.push(check('Engine', 'sdk loaded', pass('loaded')));
    }
    else if (harness?.['sdkLoaded'] === false && resident > 0) {
        out.push(check('Engine', 'sdk loaded', fail('not loaded, but a model is resident', 'the sdk should have loaded before any model did')));
    }
    else {
        out.push(check('Engine', 'sdk loaded', declared('not loaded yet — it loads on first use')));
    }
    const suspended = harness?.['suspended'] === true || assistant?.['suspended'] === true;
    out.push(check('Engine', 'not suspended', suspended
        ? fail('suspended', 'the engine is parked; on desktop it should only be suspended while the app is hidden')
        : pass('running')));
    const delay = num(at(samples.second ?? samples.first, ['process', 'delay']));
    if (delay !== null) {
        const shown = `${Math.round(delay)}ms delay`;
        out.push(check('Engine', 'event loop', delay < EVENT_LOOP_WARN_MS
            ? pass(shown)
            : warn(shown, 'something is blocking the loop, so watches and streams will stutter')));
    }
    return out;
}
function modelLabel(model) {
    return model.split(/[?#]/)[0].split(/[\\/]/).pop() || model;
}
function models(frame) {
    const harness = record(at(frame, ['harness']));
    const resident = list(harness?.['models']);
    const out = [];
    const labels = resident.map((row) => modelLabel(String(record(row)?.['model'] ?? 'unknown')));
    out.push(check('Model', 'resident', labels.length
        ? pass(labels.join(', '))
        : declared('none loaded — idle collection is legitimate')));
    if (harness?.['device']) {
        out.push(check('Model', 'device requested', declared(String(harness['device']), 'what we asked the sdk for, not what it bound — see the rows below')));
    }
    return [...out, ...backendChecks(record(at(frame, ['backendUse'])))];
}
function backendChecks(uses) {
    if (!uses || Object.keys(uses).length === 0) {
        return [
            check('Model', 'device used', declared('no run has reported a backend yet', 'only tools that report the backend they bound appear here, e.g. generate_music'))
        ];
    }
    const out = [];
    for (const [tool, entries] of Object.entries(uses)) {
        const latest = record(list(entries).at(-1));
        if (latest) {
            out.push(check('Model', `${tool} last run`, backendVerdict(latest)));
        }
    }
    return out;
}
function backendVerdict(use) {
    const device = String(use['device'] ?? 'unknown');
    const backend = String(use['backend'] ?? 'unknown');
    if (use['requestedGpu'] === true && device === 'cpu') {
        return fail(`asked for the gpu, ran on the cpu (${backend})`, 'the gpu was unavailable, so this ran on the cpu and took much longer than usual');
    }
    if (device === 'unknown') {
        return declared('the engine reported no backend', 'absent evidence is not evidence of a fallback');
    }
    return pass(`${device} (${backend})`);
}
function skills(frame) {
    const harness = record(at(frame, ['harness']));
    return [
        inventory('skills installed', list(harness?.['skills']).length, 'skill'),
        inventory('tools installed', list(harness?.['toolNames']).length, 'tool')
    ];
}
function inventory(name, count, noun) {
    if (count === 0) {
        return check('Skills', name, declared('none installed'));
    }
    return check('Skills', name, pass(`${count} ${noun}${count === 1 ? '' : 's'}`));
}
function mesh(samples, frame) {
    const node = record(at(frame, ['mesh']));
    const state = at(frame, ['state']);
    if (!node) {
        return [
            check('Mesh', 'mesh open', declared(`no mesh reported — engine state ${String(state ?? 'unknown')}`))
        ];
    }
    const out = [check('Mesh', 'mesh open', pass('open locally'))];
    if (node['writable'] === true) {
        out.push(check('Mesh', 'writable', pass('admitted as a writer')));
    }
    else if (node['writable'] === false) {
        out.push(check('Mesh', 'writable', fail('not writable', 'this device is not admitted as a writer, so its own changes cannot land')));
    }
    const member = record(node['member']);
    const unattested = num(member?.['unattested']);
    if (member) {
        const members = String(member['members'] ?? '?');
        out.push(check('Mesh', 'membership', unattested && unattested > 0
            ? warn(`${unattested} unattested of ${members}`, 'a member holding write access without attestation')
            : pass(`${members} attested`)));
    }
    const indexer = indexerVerdict(samples);
    if (indexer) {
        out.push(check('Mesh', 'indexer', indexer));
    }
    const configured = num(node['blindPeerCount']) ?? 0;
    if (node['blindPeering'] === false) {
        out.push(check('Mesh', 'blind peers', declared('switched off on this device', 'setBlindPeering({ enabled: true }) turns it back on')));
    }
    else if (configured > 0) {
        out.push(check('Mesh', 'blind peers', blindPeerVerdict(configured, list(node['blindPeers']))));
    }
    const sweep = sweepVerdict(record(node['orphanedBlobSweep']));
    if (sweep) {
        out.push(check('Mesh', 'blob sweep', sweep));
    }
    return out;
}
function indexerVerdict(samples) {
    const before = num(at(samples.first, ['mesh', 'flushes']));
    const after = num(at(samples.second, ['mesh', 'flushes']));
    const flushes = after ?? before;
    if (samples.second === undefined) {
        return pending('watching for movement');
    }
    if (before !== null && after !== null && after > before) {
        return pass(`advancing (${before} → ${after})`);
    }
    if (flushes === null) {
        return null;
    }
    return declared(flushes === 0
        ? 'nothing indexed on this device yet'
        : `${flushes} flushes so far, idle while checking`, 'flushes only advance when there is something to index, so a still counter is normal on a quiet mesh');
}
function sweepVerdict(sweep) {
    if (!sweep) {
        return null;
    }
    const state = String(sweep['state'] ?? 'unknown');
    if (state === 'failed') {
        return fail('failed', String(sweep['error'] ?? 'sweep failed'));
    }
    return state === 'succeeded' ? pass('succeeded') : declared(state);
}
function blindPeerVerdict(configured, peers) {
    const context = `${configured} key${configured === 1 ? '' : 's'} configured`;
    if (peers.length === 0) {
        return declared(`not peering right now — ${context}`);
    }
    const rows = peers.map((peer) => record(peer) ?? {});
    const uploaded = rows.reduce((total, row) => total + (num(row['uploaded']) ?? 0), 0);
    const connects = rows.reduce((total, row) => total + (num(row['connects']) ?? 0), 0);
    const connected = rows.filter((row) => row['connected'] === true).length;
    if (uploaded > 0) {
        return pass(`${peers.length} peers, ${uploaded} blocks cached with them`);
    }
    if (connected > 0) {
        return pass(`${connected} of ${peers.length} connected`);
    }
    return declared(connects > 0
        ? `${peers.length} peers, none connected after ${connects} dial${connects === 1 ? '' : 's'} — ${context}`
        : `${peers.length} peers, not dialled yet — ${context}`, 'run /doctor again: a climbing dial count with nothing connected means they are unreachable, not still connecting');
}
function network(frame) {
    const node = record(at(frame, ['network']));
    if (!node) {
        return [check('Network', 'swarm', declared('no swarm reported'))];
    }
    const out = [check('Network', 'online', onlineVerdict(node))];
    const nodes = num(node['nodes']);
    if (nodes !== null) {
        out.push(check('Network', 'dht nodes', nodes > 0
            ? pass(`${nodes} known`)
            : warn('none known', 'no route to a peer yet — normal moments after boot, a problem if it persists')));
    }
    const peers = num(node['peers']);
    const connections = num(node['connections']) ?? 0;
    if (peers !== null) {
        out.push(check('Network', 'peers', pass(peers === 0
            ? 'none connected — this device is on its own'
            : `${peers} device${peers === 1 ? '' : 's'}, ${connections} connection${connections === 1 ? '' : 's'}`)));
    }
    return out;
}
function onlineVerdict(node) {
    if (node['online'] === false) {
        return fail('offline', 'this device cannot reach the dht');
    }
    if (node['degraded'] === true) {
        return warn('degraded', 'the dht is answering slowly');
    }
    return node['online'] === true ? pass('online') : declared('not reported yet');
}
export function runChecks(samples) {
    const frame = record(samples.second ?? samples.first);
    return [
        ...hardware(frame),
        ...engine(samples, frame),
        ...models(frame),
        ...skills(frame),
        ...mesh(samples, frame),
        ...network(frame)
    ];
}
