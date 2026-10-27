import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import defaultFetch from '#fetch';
import { errorMessage } from '../guards.js';
import { defaultContextSize } from '../models/context.js';
import { fetchGgufStub, isRemoteSource, localSourcePath, parseGgufHeader, readGgufHeaderBytes } from '../models/gguf-header.js';
import { shardSet } from '../models/shards.js';
const HUGGING_FACE = 'https://huggingface.co';
const HUGGING_FACE_HOSTS = new Set(['huggingface.co', 'www.huggingface.co', 'hf.co']);
const NON_MODEL_NAMESPACES = new Set(['api', 'datasets', 'spaces', 'docs', 'models']);
const SHARD = /^(.+)-(\d{5})-of-(\d{5})\.gguf$/i;
const PIPELINE_TASKS = {
    'automatic-speech-recognition': 'speech-to-text',
    'text-to-speech': 'text-to-speech',
    'text-to-image': 'image-generation',
    'feature-extraction': 'embeddings',
    'sentence-similarity': 'embeddings',
    'text-generation': 'llm',
    'image-text-to-text': 'llm'
};
const SD_CPP_TAGS = new Set(['sd.cpp', 'stable-diffusion.cpp']);
const ARCHITECTURE_TASKS = [
    [/^whisper/i, 'speech-to-text'],
    [/^parakeet/i, 'speech-to-text'],
    [/^flux/i, 'image-generation'],
    [/^supertonic/i, 'text-to-speech'],
    [/bert/i, 'embeddings']
];
const NOT_LLM_REASON = 'Fit is estimated only for text-generation models.';
const NO_ARCHITECTURE_REASON = 'This GGUF names no model architecture, so it cannot run as a text model.';
const NO_ESTIMATOR_REASON = 'This harness has no fit estimator.';
const SHARDED_REASON = 'Fit is estimated only for a model in one file, and this one is split.';
const NO_TENSOR_LIST_REASON = 'Could not read the tensor list the fit estimate needs.';
export async function previewModelSource(context, deps = {}) {
    const fetch = deps.fetch ?? defaultFetch;
    const src = context.src.trim();
    if (!src) {
        return refuse('invalid-source', 'Paste a Hugging Face link, a direct link to a .gguf file, or a local path.');
    }
    const weight = await inspectModelFile(src, fetch, deps);
    if ('answer' in weight) {
        return weight.answer;
    }
    const taskType = taskTypeFor({
        pipelineTag: weight.file.pipelineTag,
        tags: [...(weight.file.tags ?? []), ...(weight.header.tags ?? [])],
        header: weight.header
    });
    const problem = modelProblem(weight.header, taskType);
    if (problem) {
        return refuse(problem[0], problem[1]);
    }
    let projectionBytes = 0;
    let projectionSrc;
    const mmprojSrc = context.mmprojSrc?.trim();
    if (mmprojSrc) {
        const projection = await inspectModelFile(mmprojSrc, fetch, deps);
        if ('answer' in projection) {
            return projection.answer.ok
                ? refuse('invalid-projection', 'Link the projection (mmproj) file itself, not its repository.')
                : refuse('invalid-projection', `The projection was refused: ${projection.answer.reason ?? ''}`.trim());
        }
        if (!isProjection(projection.header)) {
            return refuse('invalid-projection', 'The projection is not an mmproj file.');
        }
        projectionBytes = projection.file.sizeBytes;
        projectionSrc = projection.file.src;
    }
    const { fit, fitReasons } = await assess(weight, taskType, { deps, fetch });
    return defined({
        ok: true,
        src: weight.file.src,
        sizeBytes: weight.file.sizeBytes + projectionBytes || undefined,
        contextLength: weight.header.contextLength,
        architecture: weight.header.architecture,
        sizeLabel: weight.header.sizeLabel,
        taskType,
        license: weight.file.license ?? weight.header.license,
        fit,
        fitReasons,
        mmprojSrc: projectionSrc
    });
}
export function readModelSourcePreview(response) {
    return defined({
        ok: response.ok === true,
        refusal: (response.refusal || undefined),
        reason: response.reason || undefined,
        src: response.src || undefined,
        files: response.files?.length
            ? response.files.map(({ src, label, sizeBytes }) => ({
                src,
                label,
                sizeBytes: sizeBytes ?? 0
            }))
            : undefined,
        sizeBytes: response.sizeBytes || undefined,
        contextLength: response.contextLength || undefined,
        architecture: response.architecture || undefined,
        sizeLabel: response.sizeLabel || undefined,
        taskType: response.taskType || undefined,
        license: response.license || undefined,
        fit: (response.fit || undefined),
        fitReasons: response.fitReasons?.length ? [...response.fitReasons] : undefined,
        mmprojSrc: response.mmprojSrc || undefined
    });
}
export function parseHuggingFaceRef(src) {
    let url;
    try {
        url = new URL(src);
    }
    catch {
        return null;
    }
    if (!HUGGING_FACE_HOSTS.has(url.hostname)) {
        return null;
    }
    const segments = pathSegments(url.pathname);
    if (!segments) {
        return null;
    }
    const [org, name, kind, revision, ...rest] = segments;
    if (!org || !name || NON_MODEL_NAMESPACES.has(org)) {
        return null;
    }
    const repo = `${org}/${name}`;
    if (!kind) {
        const shown = url.searchParams.get('show_file_info');
        return shown ? { repo, revision: 'main', file: shown } : { repo, revision: 'main' };
    }
    if ((kind === 'blob' || kind === 'resolve') && revision && rest.length > 0) {
        return { repo, revision, file: rest.join('/') };
    }
    if (kind === 'tree' && revision) {
        return { repo, revision };
    }
    return null;
}
async function inspectModelFile(src, fetch, deps) {
    const inspection = await inspect(src, fetch, deps);
    if (inspection.kind === 'answer') {
        return { answer: inspection.preview };
    }
    const bytes = await readGgufHeaderBytes(inspection.file.src, { fetch });
    if (!bytes) {
        return {
            answer: refuse('unreachable', 'Could not read the start of the file to check it is a model.')
        };
    }
    const header = parseGgufHeader(bytes);
    if (!header) {
        return {
            answer: refuse('not-gguf', 'This is not a GGUF file. Only GGUF models run on this device.')
        };
    }
    return { file: inspection.file, header };
}
function inspect(src, fetch, deps) {
    const ref = parseHuggingFaceRef(src);
    if (ref) {
        return inspectHuggingFace(ref, fetch);
    }
    if (isRemoteSource(src)) {
        return wellFormedUrl(src)
            ? inspectUrl(src, fetch)
            : Promise.resolve(answer(refuse('invalid-source', 'This link is not a valid URL.')));
    }
    const file = localSourcePath(src);
    if (file === null) {
        return Promise.resolve(answer(refuse('invalid-source', 'Only Hugging Face links, http(s) links and local paths can be added.')));
    }
    return inspectLocal(src, file, deps);
}
async function inspectHuggingFace(ref, fetch) {
    let response;
    try {
        response = await fetch(modelInfoUrl(ref));
    }
    catch {
        return answer(refuse('unreachable', 'Could not reach Hugging Face.'));
    }
    if (response.status === 401 || response.status === 403) {
        return answer(refuse('private', `${ref.repo} is private or does not exist on Hugging Face.`));
    }
    if (response.status === 404) {
        return answer(refuse('not-found', `${ref.repo} does not exist on Hugging Face.`));
    }
    if (!response.ok) {
        return answer(refuse('unreachable', `Hugging Face answered HTTP ${response.status}.`));
    }
    const info = (await response.json());
    if (info.private) {
        return answer(refuse('private', `${ref.repo} is private on Hugging Face.`));
    }
    if (info.gated) {
        return answer(refuse('gated', `${ref.repo} is gated: its files need an accepted license and a Hugging Face sign-in, which custom models do not support.`));
    }
    const pipelineTag = info.pipeline_tag;
    const license = licenseOf(info);
    const siblings = info.siblings ?? [];
    const candidates = modelFiles(ref, siblings);
    const wanted = ref.file;
    if (wanted) {
        const sibling = siblings.find((entry) => entry.rfilename === wanted);
        if (!sibling) {
            return answer(refuse('not-found', `${ref.repo} has no file ${wanted}.`));
        }
        if (!/\.gguf$/i.test(wanted)) {
            return answer(refuse('not-gguf', `${wanted} is not a GGUF file. Only GGUF models run on this device.`));
        }
        const file = candidates.find((candidate) => candidate.members.includes(wanted)) ?? fileOf(ref, sibling);
        return { kind: 'file', file: { ...file, license, pipelineTag, tags: info.tags } };
    }
    if (candidates.length === 0) {
        return answer(refuse('no-model-files', `${ref.repo} has no GGUF model file. Only GGUF models run on this device.`));
    }
    if (candidates.length === 1) {
        return { kind: 'file', file: { ...candidates[0], license, pipelineTag, tags: info.tags } };
    }
    return answer(defined({
        ok: true,
        files: candidates.map(({ src, label, sizeBytes }) => ({ src, label, sizeBytes })),
        license,
        taskType: taskTypeFor({ pipelineTag, tags: info.tags })
    }));
}
async function inspectUrl(src, fetch) {
    let response;
    try {
        response = await fetch(src, { method: 'HEAD', redirect: 'follow' });
    }
    catch {
        return answer(refuse('unreachable', `Could not reach ${new URL(src).host}.`));
    }
    const { status } = response;
    if (status === 401 || status === 403) {
        return answer(refuse('private', `The server refused access (HTTP ${status}). Only public links can be added.`));
    }
    if (status === 404 || status === 410) {
        return answer(refuse('not-found', `Nothing is at this link (HTTP ${status}).`));
    }
    if (status === 405 || status === 501) {
        return { kind: 'file', file: { src, label: basename(src), sizeBytes: 0 } };
    }
    if (!response.ok) {
        return answer(refuse('unreachable', `The server answered HTTP ${status}.`));
    }
    if ((response.headers.get('content-type') ?? '').includes('text/html')) {
        return answer(refuse('web-page', 'This link opens a web page, not a model file. Link to the .gguf file itself.'));
    }
    const set = shardSet(src);
    if (set && set.shards.length > 1) {
        return inspectShards(set, fetch);
    }
    return { kind: 'file', file: { src, label: basename(src), sizeBytes: sizeOfResponse(response) } };
}
async function inspectShards(set, fetch) {
    let responses;
    try {
        responses = await Promise.all(set.shards.map((shard) => fetch(shard.url, { method: 'HEAD', redirect: 'follow' })));
    }
    catch {
        return answer(refuse('unreachable', `Could not reach every part of ${set.base}.`));
    }
    const missing = responses.findIndex((response) => !response.ok);
    if (missing !== -1) {
        const { status } = responses[missing];
        return answer(refuse(status === 404 || status === 410 ? 'not-found' : 'unreachable', `Part ${missing + 1} of ${set.shards.length}, ${set.shards[missing].filename}, answered HTTP ${status}.`));
    }
    const sizes = responses.map(sizeOfResponse);
    return {
        kind: 'file',
        file: {
            src: set.shards[0].url,
            label: `${set.base}${set.extension} (${set.shards.length} parts)`,
            sizeBytes: sizes.includes(0) ? 0 : sizes.reduce((sum, size) => sum + size, 0)
        }
    };
}
function sizeOfResponse(response) {
    return (positive(response.headers.get('x-linked-size')) ??
        positive(response.headers.get('content-length')) ??
        0);
}
async function inspectLocal(src, file, deps) {
    const stat = await (deps.stat ?? statFile)(file);
    if (!stat) {
        return answer(refuse('not-found', `There is no file at ${file}.`));
    }
    return { kind: 'file', file: { src, label: basename(file), sizeBytes: stat.size } };
}
async function statFile(file) {
    try {
        const stat = await fs.promises.stat(file);
        return stat.isFile() ? { size: stat.size } : null;
    }
    catch {
        return null;
    }
}
function modelFiles(ref, siblings) {
    const singles = [];
    const shardSets = new Map();
    for (const sibling of siblings) {
        const name = sibling.rfilename;
        if (!/\.gguf$/i.test(name) || /mmproj/i.test(name)) {
            continue;
        }
        const shard = SHARD.exec(name);
        if (!shard) {
            singles.push({ ...fileOf(ref, sibling), members: [name] });
            continue;
        }
        const key = `${shard[1]}|${shard[3]}`;
        shardSets.set(key, [...(shardSets.get(key) ?? []), sibling]);
    }
    const sets = [...shardSets.values()].map((parts) => {
        const sorted = [...parts].sort((a, b) => a.rfilename.localeCompare(b.rfilename));
        const first = sorted[0];
        return {
            src: resolveUrl(ref, first.rfilename),
            label: `${basename(first.rfilename.replace(/-\d{5}-of-\d{5}\.gguf$/i, '.gguf'))} (${sorted.length} parts)`,
            sizeBytes: sorted.reduce((total, part) => total + sizeOf(part), 0),
            members: sorted.map((part) => part.rfilename)
        };
    });
    return [...singles, ...sets];
}
function fileOf(ref, sibling) {
    return defined({
        src: resolveUrl(ref, sibling.rfilename),
        label: basename(sibling.rfilename),
        sizeBytes: sizeOf(sibling),
        sha256: sibling.lfs?.sha256
    });
}
function modelProblem(header, taskType) {
    if (isProjection(header)) {
        return [
            'not-a-model',
            'This is a vision projection (mmproj), not a model. Add the model file and pass this as its projection.'
        ];
    }
    if (header.type === 'adapter') {
        return ['not-a-model', 'This is a LoRA adapter, not a model.'];
    }
    if (taskType === 'llm' && !header.architecture) {
        return ['not-a-model', NO_ARCHITECTURE_REASON];
    }
    return null;
}
function isProjection(header) {
    return header.architecture === 'clip' || header.type === 'mmproj';
}
function taskTypeFor({ pipelineTag, tags = [], header }) {
    const tagged = [pipelineTag, ...tags].find((tag) => tag !== undefined && Object.hasOwn(PIPELINE_TASKS, tag));
    if (tagged) {
        return PIPELINE_TASKS[tagged];
    }
    if (header && !header.architecture && tags.some((tag) => SD_CPP_TAGS.has(tag))) {
        return 'image-generation';
    }
    const architecture = header?.architecture ?? '';
    return ARCHITECTURE_TASKS.find(([pattern]) => pattern.test(architecture))?.[1] ?? 'llm';
}
async function assess({ file, header }, taskType, { deps, fetch }) {
    const { assessFit } = deps;
    if (taskType !== 'llm') {
        return { fit: 'unknown', fitReasons: [NOT_LLM_REASON] };
    }
    if (!assessFit) {
        return { fit: 'unknown', fitReasons: [NO_ESTIMATOR_REASON] };
    }
    const query = {
        src: file.src,
        name: header.name ?? file.label,
        contextTokens: deps.contextSize || defaultContextSize(file.src, header.contextLength)
    };
    try {
        const catalog = file.sha256
            ? await assessFit({ ...query, sha256Checksum: file.sha256 }).catch(() => null)
            : null;
        return catalog && catalog.verdict !== 'unknown'
            ? previewFit(catalog)
            : await assessTensorList(query, {
                assessFit,
                fetch,
                recentFits: deps.recentFits ?? new Map()
            });
    }
    catch (err) {
        return {
            fit: 'unknown',
            fitReasons: [`The fit estimate failed: ${errorMessage(err)}`]
        };
    }
}
const RECENT_FIT_MS = 60_000;
async function assessTensorList(query, tools) {
    const { assessFit, recentFits } = tools;
    if ((shardSet(query.src)?.shards.length ?? 1) > 1) {
        return { fit: 'unknown', fitReasons: [SHARDED_REASON] };
    }
    const local = localSourcePath(query.src);
    if (local !== null) {
        return previewFit(await assessFit({ ...query, src: local }));
    }
    const file = path.join(os.tmpdir(), `qvac-fit-stub-${stubName(query.src)}.gguf`);
    const recent = recentFits.get(file);
    if (recent && Date.now() - recent.at < RECENT_FIT_MS) {
        return recent.fit;
    }
    const fit = fitStub(file, query, tools);
    recentFits.set(file, { fit, at: Infinity });
    fit.then((result) => result.fit === 'unknown'
        ? recentFits.delete(file)
        : recentFits.set(file, { fit, at: Date.now() }), () => recentFits.delete(file));
    return fit;
}
async function fitStub(file, query, { assessFit, fetch }) {
    const stub = await fetchGgufStub(query.src, { fetch });
    if (!stub) {
        return { fit: 'unknown', fitReasons: [NO_TENSOR_LIST_REASON] };
    }
    try {
        await fs.promises.writeFile(file, stub);
        return previewFit(await assessFit({ ...query, src: file }));
    }
    finally {
        await fs.promises.rm(file, { force: true });
    }
}
function previewFit({ verdict, reasons }) {
    return { fit: verdict, fitReasons: reasons };
}
function stubName(src) {
    return crypto.createHash('sha256').update(src, 'utf8').digest('hex').slice(0, 16);
}
function modelInfoUrl(ref) {
    const revision = ref.revision === 'main' ? '' : `/revision/${encodeURIComponent(ref.revision)}`;
    return `${HUGGING_FACE}/api/models/${encodePath(ref.repo)}${revision}?blobs=true`;
}
function resolveUrl(ref, file) {
    return `${HUGGING_FACE}/${encodePath(ref.repo)}/resolve/${encodeURIComponent(ref.revision)}/${encodePath(file)}`;
}
function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
}
function pathSegments(pathname) {
    try {
        return pathname.split('/').filter(Boolean).map(decodeURIComponent);
    }
    catch {
        return null;
    }
}
function wellFormedUrl(src) {
    try {
        return pathSegments(new URL(src).pathname) !== null;
    }
    catch {
        return false;
    }
}
function licenseOf(info) {
    const license = info.cardData?.license;
    if (Array.isArray(license)) {
        return license.length ? license.join(', ') : undefined;
    }
    return license || undefined;
}
function sizeOf(sibling) {
    return sibling.lfs?.size ?? sibling.size ?? 0;
}
function basename(src) {
    const path = src.split(/[?#]/)[0];
    const name = path.slice(path.lastIndexOf('/') + 1);
    return (pathSegments(name) ?? [name])[0] || src;
}
function positive(raw) {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}
function refuse(refusal, reason) {
    return { ok: false, refusal, reason };
}
function answer(preview) {
    return { kind: 'answer', preview };
}
function defined(value) {
    const copy = { ...value };
    for (const [key, entry] of Object.entries(value)) {
        if (entry === undefined) {
            Reflect.deleteProperty(copy, key);
        }
    }
    return copy;
}
