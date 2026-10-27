import { getModelResourceProfile } from '../models/registry/resource-profiles.js';
import { computeFloor, FLOOR_VERSION } from './floor.js';
const GIB = 1024 * 1024 * 1024;
const MOBILE_PLATFORMS = ['android-arm64', 'ios-arm64'];
// Every allocation, GPU included, is system RAM: the system budget always bounds the load.
const UNIFIED_MEMORY_PLATFORMS = [
    'darwin-arm64',
    'android-arm64',
    'ios-arm64'
];
/**
 * What one fitter answered: its measurement where the figures divide, its bare
 * verdict where they do not, and `undefined` where it reached no verdict.
 */
function nativeEvaluation(native) {
    const fit = native?.fit;
    if (!fit || fit.verdict === 'unknown')
        return undefined;
    const reasons = fit.message === undefined ? [fit.reason] : [fit.reason, fit.message];
    const bare = {
        kind: 'bare',
        verdict: fit.verdict,
        estimatorVersion: fit.estimatorVersion,
        reasons
    };
    const projection = fit.projection;
    if (!projection)
        return bare;
    const { weightsBytes, contextBytes, computeBytes, hostBytes } = projection;
    if (weightsBytes === undefined || contextBytes === undefined || computeBytes === undefined) {
        return bare;
    }
    return {
        kind: 'native',
        persistent: weightsBytes + contextBytes,
        working: computeBytes,
        hostBytes: hostBytes ?? 0,
        estimatorVersion: fit.estimatorVersion,
        verdict: fit.verdict,
        reasons
    };
}
/**
 * Turns catalog profiles plus a fresh system-memory sample into an advisory
 * verdict.
 *
 * Pure: every input is passed in, so the same call is testable without a worker,
 * a device, or a network. Sampling, platform detection and the engine fitter
 * calls happen in the handler.
 */
export function assessModelFitFromResources(options) {
    const { models, execution, resources, platform } = options;
    const resolveProfile = options.resolveProfile ?? getModelResourceProfile;
    const placement = platform !== undefined && hasGpu(resources)
        ? resolveGpuPlacement(resources, platform)
        : undefined;
    const onDevice = placement?.kind === 'device' ? placement : undefined;
    const onIntegrated = placement?.kind === 'shared' ? placement : undefined;
    const basis = onDevice
        ? onDevice.targets[0].scope === 'budget'
            ? 'device-budget'
            : 'device-memory'
        : resolveBasis(platform);
    const reasons = [];
    const assumptions = [
        `execution mode '${execution}' is a declared assumption used for aggregation only; the SDK does not schedule, serialize, or reserve anything`,
        `the verdict is advisory and based on ${basisEvidence(basis)} alone; it does not block loadModel and makes no performance claim`
    ];
    if (onDevice) {
        const { targets, backend } = onDevice;
        assumptions.push(targets.length === 1
            ? `the model is assumed to execute on ${targets[0].device ?? 'the discrete GPU'} via ${backend}, and the budget is that device's own memory`
            : `${targets.length} usable GPUs are reported and the engine pins the model to one of them, an order this side cannot observe; the verdict holds for whichever it picks, and the budget shown is the tightest of them`);
    }
    if (onIntegrated) {
        assumptions.push(`the model is assumed to execute on ${onIntegrated.device ?? 'the integrated GPU'} via ${onIntegrated.backend}; an integrated GPU allocates out of system RAM, so system memory is the budget it draws on`);
    }
    if (platform === 'android-arm64') {
        assumptions.push('android budgets deliberately use system memory: the low-memory killer acts system-wide and native allocations carry no per-process cap like iOS jetsam');
    }
    // Every candidate card carries its own budget; the tightest is reported and
    // the verdict is taken across all of them.
    const deviceBudgets = onDevice?.targets.map((target) => gpuBudget(target, platform));
    const budget = deviceBudgets
        ? tightest(deviceBudgets)
        : resolveBudget(resources, platform, basis, reasons);
    // A discrete-GPU load is paid for in system RAM too. In shared mode the
    // system budget already *is* the budget.
    const alsoBoundBy = onDevice ? resolveBudget(resources, platform, 'system-memory', []) : undefined;
    // The computed floor says something only where the model executes out of the
    // memory the budget measures. A discrete card holds the weights in its own
    // memory, so the system budget bounds nothing there.
    const floorApplies = !onDevice && boundBySystemMemory(resources, platform);
    const evaluated = models.map((candidate, index) => evaluate(candidate, resolveProfile, floorApplies, options.nativeFits?.[index], models.length === 1));
    const results = evaluated.map(({ result }) => result);
    if (!platform) {
        reasons.push('the runtime platform is not one this assessment covers');
    }
    for (const { result } of evaluated) {
        if (result.kind === 'bare')
            continue;
        for (const assumption of result.assumptions ?? []) {
            if (!assumptions.includes(assumption))
                assumptions.push(assumption);
        }
    }
    const modelResults = evaluated.map(({ candidate, result }) => toModelResult(candidate, result, budget, deviceBudgets, alsoBoundBy));
    const natives = results.filter((result) => result.kind === 'native');
    const anyUnknown = results.some((result) => result.kind === 'unknown');
    const anyFloor = results.some((result) => result.kind === 'floor');
    const bares = results.filter((result) => result.kind === 'bare');
    const allNative = natives.length === results.length && natives.length > 0;
    // Measured bytes are exact, so a set of them can confirm a fit. Mixed with a
    // floor the total is a lower bound again, and `combinedFloor` carries it.
    const combinedNative = allNative ? aggregateNative(natives, execution) : undefined;
    const combinedFloor = anyUnknown || bares.length > 0 ? undefined : aggregateFloor(results, execution);
    // A bare verdict is the engine's own, so it names the evidence; otherwise the
    // weakest candidate does. Absent when a candidate rests on nothing, so an
    // `unknown` carrying `evidence` is a near-miss rather than a missing model.
    const evidence = bares.length > 0
        ? 'native-fit'
        : anyUnknown
            ? undefined
            : anyFloor
                ? 'computed-only'
                : allNative
                    ? 'native-fit'
                    : undefined;
    if (anyUnknown) {
        reasons.push('at least one model could not be assessed, so the combined verdict is unknown');
    }
    // An engine refuses for reasons its own figures do not carry — no device
    // could hold the placement, a load shape it will not run — so its refusal
    // stands whatever the arithmetic says.
    const refused = bares.some((bare) => bare.verdict === 'does-not-fit') ||
        natives.some((native) => native.verdict === 'does-not-fit');
    // The engine measured this model against this device, so its verdict stands
    // where the arithmetic cannot run. A set still needs a budget, since each
    // model was measured alone.
    const engineAnswered = bares.length > 0 || (!budget && models.length === 1 && natives.length === 1);
    const verdict = refused
        ? 'likely-too-large'
        : engineAnswered
            ? 'likely-fits'
            : !budget
                ? 'unknown'
                : combinedNative !== undefined
                    ? verdictAgainst(combinedNative, deviceBudgets ?? [budget], alsoBoundBy)
                    : combinedFloor !== undefined
                        ? floorVerdict(combinedFloor, deviceBudgets ?? [budget], alsoBoundBy)
                        : 'unknown';
    if (onDevice && combinedNative !== undefined && alsoBoundBy) {
        reasons.push('a GPU load is also paid for in system RAM, so every verdict is the more pessimistic of the GPU and system budgets');
    }
    if (deviceBudgets && deviceBudgets.length > 1 && combinedNative !== undefined) {
        reasons.push('more than one usable GPU is reported, so a fit has to hold on the smallest of them and a refusal on the largest');
    }
    if (budget && (combinedNative !== undefined || combinedFloor !== undefined)) {
        reasons.push(execution === 'concurrent'
            ? 'all models counted as resident with every working peak added'
            : 'all models counted as resident with only the largest working peak added');
    }
    if (anyFloor) {
        reasons.push('at least one model is bounded only by its computed floor (weights, plus the KV cache for llama.cpp), which can refuse the set but never confirm a fit');
    }
    if (allNative) {
        reasons.push('every model was measured by the engine that would run it');
    }
    for (const declined of nativeFitDeclines(options.nativeFits, models)) {
        reasons.push(declined);
    }
    return {
        verdict,
        basis,
        execution,
        ...(evidence && { evidence }),
        ...(budget && { budget }),
        ...(anyFloor && combinedFloor !== undefined && { floorBytes: totalBytes(combinedFloor) }),
        models: modelResults,
        reasons,
        assumptions
    };
}
/**
 * Why a candidate carries no engine verdict: the fitter never ran for it, or it
 * ran and declined. Each is named with its model, since a set can lose one
 * model to the fitter and keep the rest.
 */
function nativeFitDeclines(nativeFits, models) {
    const declines = [];
    nativeFits?.forEach((native, index) => {
        const name = models[index]?.model.name ?? `model ${index + 1}`;
        if (native.unavailable !== undefined) {
            declines.push(`no engine fit for ${name}: ${native.unavailable}`);
            return;
        }
        if (native.fit?.verdict !== 'unknown')
            return;
        const detail = native.fit.message === undefined ? native.fit.reason : native.fit.message;
        declines.push(`the engine fitter reached no verdict for ${name}: ${detail}`);
    });
    return declines;
}
/**
 * Whether every allocation a load makes comes out of the memory the system (or
 * process) budget measures — the precondition for the computed floor to be
 * compared against that budget.
 *
 * True on unified-memory platforms whatever the collector reports, and
 * elsewhere when no usable GPU is present or every usable GPU allocates out of
 * system RAM. A card with its own memory, or a device whose class cannot be
 * told (an AMD APU on linux), fails it: the weights may live where the budget
 * cannot see them.
 */
export function boundBySystemMemory(resources, platform) {
    if (platform !== undefined && UNIFIED_MEMORY_PLATFORMS.includes(platform))
        return true;
    const gpus = usableGpus(resources);
    if (gpus.length === 0)
        return true;
    if (platform && gpus.some((gpu) => integratedIsIndistinguishable(gpu, platform)))
        return false;
    return gpus.every(allocatesFromSystemMemory);
}
/**
 * One candidate's evaluation: the engine fitter's measurement when it ran,
 * otherwise the computed floor where a floor can be compared at all, otherwise
 * `unknown`. Whatever kept the measurement from forming stays in the reasons,
 * so a floor verdict still says why it is only a floor.
 */
function evaluate(candidate, resolveProfile, floorApplies, native, sole) {
    const measured = nativeEvaluation(native);
    if (measured && (measured.kind !== 'bare' || measured.verdict === 'does-not-fit' || sole)) {
        return { candidate, result: measured };
    }
    const profile = resolveProfile(candidate.model.sha256Checksum);
    if (!profile) {
        return { candidate, result: unknown('no resource profile in the catalog for this checksum') };
    }
    const extra = extraArtifactBytes(candidate, resolveProfile);
    if (extra === undefined) {
        return {
            candidate,
            result: unknown('an entry in `artifacts` has no resource profile in the catalog')
        };
    }
    if (!floorApplies) {
        return {
            candidate,
            result: unknown('no engine verdict, and the floor has no budget to be compared against')
        };
    }
    const floor = computeFloor({ profile, workload: candidate.workload, extraArtifactBytes: extra });
    return {
        candidate,
        result: {
            kind: 'floor',
            bytes: floor.bytes,
            reasons: floor.reasons,
            assumptions: floor.assumptions
        }
    };
}
function unknown(reason) {
    return { kind: 'unknown', reasons: [reason] };
}
/**
 * Sums the artifact bytes of companion constants.
 *
 * @returns The total, or `undefined` when any companion is not in the catalog —
 *   an incomplete artifact set must not be silently under-counted.
 */
function extraArtifactBytes(candidate, resolveProfile) {
    if (!candidate.artifacts || candidate.artifacts.length === 0)
        return 0;
    let total = 0;
    for (const artifact of candidate.artifacts) {
        const profile = resolveProfile(artifact.sha256Checksum);
        if (!profile)
            return undefined;
        total += profile.artifactBytes;
    }
    return total;
}
/**
 * The GPUs the engine could actually execute on: `chooseBackend` passes over a
 * paravirtual adapter and a device with no graphics API this build talks to,
 * and falls back to the CPU. The driver flags are library-presence checks, and
 * ggml's own backend needs the same libraries to load.
 */
function usableGpus(resources) {
    const gpus = resources.capabilities.gpus;
    if (gpus.status !== 'supported')
        return [];
    return gpus.value.filter((gpu) => !isVirtualDisplayAdapter(gpu) && backendOf(gpu) !== undefined);
}
/** Whether a GPU the engine would use is present. Sets the KV-cache default. */
function hasGpu(resources) {
    return usableGpus(resources).length > 0;
}
// An adapter too small to hold any model we assess is not a candidate for one.
// Windows classifies the Intel iGPU as dedicated because it declares 128 MiB of
// its own, which is otherwise indistinguishable from a real card by type.
const MIN_USABLE_GPU_BYTES = GIB;
// Only excludes a card when the declared memory says so. An unreported total
// leaves it counted, so an unknown device makes the choice ambiguous rather
// than silently disappearing from it.
function tooSmallToHostAModel(gpu) {
    return (gpu.memoryTotalBytes.status === 'supported' && gpu.memoryTotalBytes.value < MIN_USABLE_GPU_BYTES);
}
// `gpuType.VIRTUAL`: the virtio / VMware / Hyper-V adapter a VM exposes. It
// has no compute backend, so counting it as a GPU would budget every VM
// against memory nothing can allocate.
const GPU_TYPE_VIRTUAL = 3;
function isVirtualDisplayAdapter(gpu) {
    return gpu.type.status === 'supported' && gpu.type.value === GPU_TYPE_VIRTUAL;
}
/**
 * Whether this GPU's allocations come out of system RAM. `unifiedMemory` says
 * so directly; the Windows iGPU does not, being typed dedicated for a 128 MiB
 * carve-out, so the usable-memory floor is what identifies it.
 */
function allocatesFromSystemMemory(gpu) {
    if (gpu.unifiedMemory.status === 'supported' && gpu.unifiedMemory.value)
        return true;
    return tooSmallToHostAModel(gpu);
}
/**
 * Whether the collector's dedicated/integrated call is trustworthy for this
 * device. On linux it is inferred from amdgpu's `mem_info_vram_total`, which an
 * APU also exposes for its carve-out — a Ryzen 5000U reported `dedicated` with
 * over a gigabyte of "VRAM". Vulkan calls the same device INTEGRATED_GPU, but
 * that is not in the collector, so an AMD GPU on linux cannot be placed and
 * assesses as `unknown`.
 */
function integratedIsIndistinguishable(gpu, platform) {
    if (!platform.startsWith('linux'))
        return false;
    return gpu.driverName.status === 'supported' && gpu.driverName.value === 'amdgpu';
}
// Ordered by the backends the addon actually builds, not by what the device's
// drivers advertise: an NVIDIA host advertises both CUDA and Vulkan, and every
// load on it reports `ggml_vulkan`, never `ggml_cuda`. The
// engine's own choice is not observable from here (`chooseBackend` is C++ and
// only reaches the llama log), so this order has to track the addon's build.
const GPU_BACKENDS = ['metal', 'vulkan', 'rocm', 'cuda', 'levelZero', 'opencl'];
function backendOf(gpu) {
    for (const name of GPU_BACKENDS) {
        const driver = gpu.drivers[name];
        if (driver.status === 'supported' && driver.value)
            return name;
    }
    return undefined;
}
/**
 * Classifies the reported GPUs: any card with its own memory ⇒ `device`,
 * otherwise ⇒ `shared`. That preference is the engine's own.
 *
 * @returns `undefined` when the readings support neither, or when the cards
 *   disagree on backend or scope.
 */
function resolveGpuPlacement(resources, platform) {
    const gpus = usableGpus(resources);
    if (gpus.length === 0)
        return undefined;
    if (gpus.some((gpu) => integratedIsIndistinguishable(gpu, platform)))
        return undefined;
    // Classify on device properties only, never on a reading. A card whose
    // sample failed must still count as a card the engine could choose;
    // filtering it out here would leave its neighbour looking unambiguous.
    const deviceBacked = gpus.filter((gpu) => !allocatesFromSystemMemory(gpu));
    if (deviceBacked.length === 0) {
        const shared = gpus[0];
        const backend = backendOf(shared);
        // The engine picks one of them, so the same rule applies as for cards: no
        // single backend, no placement. They share the budget either way.
        if (gpus.some((gpu) => backendOf(gpu) !== backend))
            return undefined;
        return {
            kind: 'shared',
            backend,
            ...(shared.name.status === 'supported' && { device: shared.name.value })
        };
    }
    const samples = resources.sample?.gpus;
    if (samples?.status !== 'supported')
        return undefined;
    const targets = [];
    for (const gpu of deviceBacked) {
        const backend = backendOf(gpu);
        if (!backend)
            return undefined;
        const sample = samples.value.find((entry) => entry.id === gpu.id);
        if (!sample)
            return undefined;
        if (sample.memoryTotalBytes.status !== 'supported')
            return undefined;
        if (sample.memoryUsedBytes.status !== 'supported')
            return undefined;
        if (sample.memoryTotalBytes.value <= 0)
            return undefined;
        if (sample.memoryUsedBytes.value > sample.memoryTotalBytes.value)
            return undefined;
        targets.push({
            backend,
            totalBytes: sample.memoryTotalBytes.value,
            usedBytes: sample.memoryUsedBytes.value,
            scope: sample.memoryTotalBytes.provenance.scope === 'budget' ? 'budget' : 'device',
            ...(gpu.name.status === 'supported' && { device: gpu.name.value })
        });
    }
    // A placement names one backend and one basis, so cards that disagree on
    // either name no device to budget against.
    const backend = targets[0].backend;
    if (targets.some((target) => target.backend !== backend))
        return undefined;
    if (targets.some((target) => target.scope !== targets[0].scope))
        return undefined;
    return { kind: 'device', backend, targets };
}
function gpuBudget(target, platform) {
    const available = target.totalBytes - target.usedBytes;
    const reserved = reserveBytes(available, platform);
    return {
        totalBytes: target.totalBytes,
        usedBytes: target.usedBytes,
        availableBytes: available,
        reservedBytes: reserved,
        availableAfterReserveBytes: available - reserved
    };
}
/** The budget with the least room left, which is the one worth reporting. */
function tightest(budgets) {
    return budgets.reduce((least, budget) => budget.availableAfterReserveBytes < least.availableAfterReserveBytes ? budget : least);
}
/**
 * What the candidate budgets have to hold. `alsoBoundBy` is present only where
 * they are a card's own memory, which host bytes never come out of; without it
 * they are system memory and everything lands there.
 */
function chargedToDevice(demand, alsoBoundBy) {
    return alsoBoundBy ? demand.deviceBytes : totalBytes(demand);
}
/**
 * `candidates` are alternatives — the engine pins the model to one of them, and
 * which one is not observable here — so a fit has to hold on the smallest and a
 * refusal on the largest. `alsoBoundBy` is a conjunction: a GPU load is paid
 * for in system RAM too, so both bounds apply.
 */
function verdictAgainst(demand, candidates, alsoBoundBy) {
    const room = candidates.map((budget) => budget.availableAfterReserveBytes);
    const onDevice = chargedToDevice(demand, alsoBoundBy);
    const primary = onDevice <= Math.min(...room)
        ? 'likely-fits'
        : onDevice > Math.max(...room)
            ? 'likely-too-large'
            : 'unknown';
    if (!alsoBoundBy)
        return primary;
    return worst(primary, totalBytes(demand) > alsoBoundBy.availableAfterReserveBytes ? 'likely-too-large' : 'likely-fits');
}
/** The more pessimistic of two verdicts. */
function worst(a, b) {
    if (a === 'likely-too-large' || b === 'likely-too-large')
        return 'likely-too-large';
    if (a === 'unknown' || b === 'unknown')
        return 'unknown';
    return 'likely-fits';
}
/**
 * Picks the budget basis for a platform.
 *
 * iOS is the exception: jetsam terminates an app on its own footprint against
 * a per-process limit well below device RAM, so a system-memory budget there
 * would defend `likely-fits` verdicts the OS does not honor. Android's
 * low-memory killer acts system-wide and native allocations carry no
 * per-process cap, so it deliberately keeps the system basis with the mobile
 * reserve.
 */
export function resolveBasis(platform) {
    return platform === 'ios-arm64' ? 'process-memory' : 'system-memory';
}
function basisEvidence(basis) {
    if (basis === 'process-memory')
        return 'this process’s own memory ceiling';
    if (basis === 'device-memory')
        return 'the GPU’s own memory';
    if (basis === 'device-budget')
        return 'the GPU memory this process is budgeted';
    return 'system memory';
}
/**
 * Derives the memory budget from the sample, under the platform's basis.
 *
 * Only `sample.memory` is used: capabilities-only totals say nothing about what
 * is free right now, and a verdict without that is not worth giving. Under the
 * process basis the ceiling is reconstructed as allowance + footprint — the
 * relation the OS enforces — so every budget field keeps the same meaning
 * under either basis.
 */
export function resolveBudget(resources, platform, basis, reasons) {
    const sample = resources.sample;
    if (!sample) {
        reasons.push('no memory sample was available');
        return undefined;
    }
    if (basis === 'process-memory') {
        const available = sample.memory.processAvailableBytes;
        const used = sample.memory.processUsedBytes;
        if (available.status !== 'supported' || used.status !== 'supported') {
            reasons.push('iOS budgets are per-process (jetsam terminates on the app’s own footprint), and the per-process allowance metric is not available on this build');
            return undefined;
        }
        const total = available.value + used.value;
        if (total <= 0) {
            reasons.push('process-memory metrics are inconsistent');
            return undefined;
        }
        const reserved = reserveBytes(available.value, platform);
        return {
            totalBytes: total,
            usedBytes: used.value,
            availableBytes: available.value,
            reservedBytes: reserved,
            availableAfterReserveBytes: available.value - reserved
        };
    }
    const total = sample.memory.totalBytes;
    const used = sample.memory.usedBytes;
    if (total.status !== 'supported' || used.status !== 'supported') {
        reasons.push('system-memory metrics are not supported on this platform');
        return undefined;
    }
    if (total.value <= 0 || used.value > total.value) {
        reasons.push('system-memory metrics are inconsistent');
        return undefined;
    }
    const available = total.value - used.value;
    const reserved = reserveBytes(available, platform);
    return {
        totalBytes: total.value,
        usedBytes: used.value,
        availableBytes: available,
        reservedBytes: reserved,
        availableAfterReserveBytes: available - reserved
    };
}
/**
 * `interactive-v1`: 20% of what is available right now, capped at 2 GiB on
 * desktop and 1 GiB on mobile.
 *
 * The reserve is taken from available memory, not total: a share of total is
 * subtracted from a figure that already excludes what is in use, so on a busy
 * host it double-counts and can exceed the whole headroom — a 24 GiB Mac with
 * 3.3 GiB free ended up with a zero budget and called a 2 GiB model too large.
 */
function reserveBytes(availableBytes, platform) {
    const mobile = platform !== undefined && MOBILE_PLATFORMS.includes(platform);
    return Math.min(mobile ? 1 * GIB : 2 * GIB, Math.floor(availableBytes * 0.2));
}
/**
 * The combined lower bound when at least one candidate has only a floor: every
 * estimate contributes its own lower bound, every floor its bytes, aggregated
 * the same way as `aggregate` — a floor has no working peak to add.
 *
 * @returns `undefined` when any candidate has no evidence at all.
 */
function aggregateFloor(results, execution) {
    let persistent = 0;
    let working = 0;
    let hostBytes = 0;
    for (const result of results) {
        if (result.kind === 'unknown' || result.kind === 'bare')
            return undefined;
        if (result.kind === 'floor') {
            persistent += result.bytes;
            continue;
        }
        persistent += result.persistent;
        hostBytes += result.hostBytes;
        working =
            execution === 'concurrent' ? working + result.working : Math.max(working, result.working);
    }
    return { deviceBytes: persistent + working, hostBytes };
}
function totalBytes(demand) {
    return demand.deviceBytes + demand.hostBytes;
}
/**
 * The combined demand when every candidate was measured by its own engine.
 * Each fitter answered about one model against the whole machine, so only the
 * bytes compose: persistent is always resident, and the working peak is summed
 * under `concurrent` and maximised under `sequential`.
 */
function aggregateNative(natives, execution) {
    let persistent = 0;
    let working = 0;
    let hostBytes = 0;
    for (const native of natives) {
        persistent += native.persistent;
        hostBytes += native.hostBytes;
        working =
            execution === 'concurrent' ? working + native.working : Math.max(working, native.working);
    }
    return { deviceBytes: persistent + working, hostBytes };
}
/**
 * A floor can only refuse: over the largest candidate budget it is
 * `likely-too-large`, and anything else is `unknown`, because the cost above
 * the floor is unmeasured and could be anything.
 */
function floorVerdict(floor, candidates, alsoBoundBy) {
    const room = candidates.map((budget) => budget.availableAfterReserveBytes);
    if (chargedToDevice(floor, alsoBoundBy) > Math.max(...room))
        return 'likely-too-large';
    if (alsoBoundBy && totalBytes(floor) > alsoBoundBy.availableAfterReserveBytes) {
        return 'likely-too-large';
    }
    return 'unknown';
}
function toModelResult(candidate, result, budget, 
/** Every candidate GPU budget, when the host has more than one. */
deviceBudgets, 
/** The system budget a GPU load is also paid for out of. */
alsoBoundBy) {
    if (result.kind === 'unknown') {
        return {
            name: candidate.model.name,
            verdict: 'unknown',
            ...(candidate.device !== undefined && { device: candidate.device }),
            reasons: [...result.reasons]
        };
    }
    if (result.kind === 'floor') {
        const verdict = budget
            ? floorVerdict({ deviceBytes: result.bytes, hostBytes: 0 }, deviceBudgets ?? [budget], alsoBoundBy)
            : 'unknown';
        return {
            name: candidate.model.name,
            verdict,
            evidence: 'computed-only',
            ...(candidate.device !== undefined && { device: candidate.device }),
            floorBytes: result.bytes,
            estimatorVersion: FLOOR_VERSION,
            reasons: [
                ...result.reasons,
                !budget
                    ? 'no usable system-memory sample, so this model has no verdict'
                    : verdict === 'likely-too-large'
                        ? 'the computed floor alone exceeds the budget'
                        : 'the computed floor is within the budget, but the cost above it is unmeasured, so a fit cannot be claimed'
            ]
        };
    }
    if (result.kind === 'bare') {
        return {
            name: candidate.model.name,
            verdict: result.verdict === 'fit' ? 'likely-fits' : 'likely-too-large',
            evidence: 'native-fit',
            ...(candidate.device !== undefined && { device: candidate.device }),
            estimatorVersion: result.estimatorVersion,
            reasons: [...result.reasons]
        };
    }
    const bytes = aggregateNative([result], 'sequential');
    const verdict = result.verdict === 'does-not-fit'
        ? 'likely-too-large'
        : budget
            ? verdictAgainst(bytes, deviceBudgets ?? [budget], alsoBoundBy)
            : 'likely-fits';
    return {
        name: candidate.model.name,
        verdict,
        evidence: 'native-fit',
        ...(candidate.device !== undefined && { device: candidate.device }),
        estimatorVersion: result.estimatorVersion,
        reasons: [...result.reasons]
    };
}
