import b4a from 'b4a';
import fs from 'fs';
import path from 'path';
import { HarnessError } from '../../lib/errors.js';
import { AbortedError } from '../../lib/helpers/race-abort.js';
import { BUSY_ERROR, DIM_STEP, effectiveSteps, generationPercentTick, normalizeClamps, parseCommonArgs, runDiffusion } from './generate-image.js';
const DEFAULT_STRENGTH = 0.7;
const FLUX2_GUIDANCE = 3.5;
const FLUX2_CFG_SCALE = 1;
const MULTI_SOURCE_UNSUPPORTED = 'this image model edits one image at a time — fusing multiple sources needs an in-context editing model (FLUX.2 today)';
const IMAGE_REF_TOKEN_PATTERN = /@image\d+/i;
async function turnSources(turnImages) {
    const sources = [];
    for (const image of turnImages) {
        const bytes = await fs.promises.readFile(image.path).catch(toNull);
        if (!bytes) {
            return { error: `could not read attached image ${path.basename(image.path)}` };
        }
        sources.push({ bytes, fileName: path.basename(image.path) });
    }
    return sources;
}
async function resolveSources(fetchAttachment, { ids, turnImages, signal }) {
    if (!ids.length) {
        if (turnImages.length) {
            const sources = await turnSources(turnImages);
            return 'error' in sources ? sources : { sources };
        }
        const latest = await fetchAttachment({ signal });
        if (!latest || !('bytes' in latest) || !latest.bytes) {
            return { error: 'no image in this chat to edit' };
        }
        return { sources: [latest] };
    }
    const sources = [];
    const missing = [];
    for (const id of ids) {
        const found = await fetchAttachment({ attachmentId: id, signal });
        if (found && 'bytes' in found && found.bytes) {
            sources.push(found);
        }
        else {
            missing.push(id);
        }
    }
    if (!missing.length) {
        return { sources };
    }
    if (sources.length) {
        return {
            sources,
            note: `ignored unknown attachment id(s) ${missing.join(', ')} — edited the found source(s) only`
        };
    }
    if (turnImages.length) {
        const fallback = await turnSources(turnImages);
        if ('error' in fallback) {
            return fallback;
        }
        return {
            sources: fallback,
            note: `ignored unknown attachment id(s) ${missing.join(', ')} — edited the image(s) from the user's latest message`
        };
    }
    return {
        error: `attachment ${missing.join(', ')} not found in this chat — ids come only from earlier ` +
            "tool results. Call again WITHOUT ids to edit the image(s) from the user's latest message"
    };
}
async function defaultLoadMedia() {
    try {
        return await import('bare-media');
    }
    catch {
        return null;
    }
}
async function defaultResample(rgba, width, height) {
    const { resize } = await import('bare-image-resample');
    return resize(rgba, width, height);
}
export async function loadMediaCodecs() {
    const media = await import('bare-media');
    const codecs = media.codecs;
    await Promise.all(Object.values(codecs).map((load) => load()));
}
export function createEditImageTool(runtime, { loadMedia = defaultLoadMedia, resample = defaultResample } = {}, clamps) {
    const cap = normalizeClamps(clamps);
    const stepsCap = clamps?.maxSteps ? cap.maxSteps : undefined;
    const snap = (n) => Math.min(cap.maxDim, Math.max(DIM_STEP, Math.round(n / DIM_STEP) * DIM_STEP));
    return {
        name: 'edit_image',
        toolset: 'image',
        skillGated: true,
        description: 'Edit or restyle an existing image from this chat using the local diffusion model ' +
            '(image-to-image). To edit what the user just attached, call with the prompt ONLY — the ' +
            "image(s) from the user's latest message (or the chat's most recent image) are the " +
            'sources automatically. Never invent attachment ids; `attachment_ids` accepts only ids ' +
            'returned by earlier tool results. Multiple sources fuse into one output (e.g. an object ' +
            'from one image placed into another) — only image models with in-context editing support ' +
            'this (FLUX.2 today); other models edit exactly one image. When fusing, reference the sources in the prompt as ' +
            '@image1, @image2, ... in source order (e.g. "put @image1\'s hat on the man in @image2") ' +
            '— without @imageN tokens the model collapses toward single-reference behavior. ' +
            '`strength` 0..1 controls how far to move from the source: low keeps it, ' +
            'high follows the prompt (default 0.7); in-context editing models ignore it. ' +
            `Output keeps the source aspect ratio, fitted to the 64px grid (max ${cap.maxDim} per side on this device). ` +
            'The edited image is saved as a chat attachment and shown to the user automatically; ' +
            'the attachment id is returned to you.',
        parameters: {
            type: 'object',
            properties: {
                prompt: { type: 'string', description: 'How the image should change' },
                attachment_id: {
                    type: 'string',
                    description: 'Chat attachment to edit; omitted = the latest image in the chat'
                },
                attachment_ids: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Source attachments to fuse (in-context editing models only); the first sets the output ' +
                        'size. Only ids ' +
                        "from earlier tool results — OMIT entirely for the user's attached images"
                },
                strength: {
                    type: 'number',
                    description: '0..1, how far to move from the source (default 0.7); in-context models ignore it'
                },
                steps: {
                    type: 'number',
                    description: `Diffusion steps (model default when omitted, max ${cap.maxSteps})`
                },
                seed: { type: 'number', description: 'Reproducibility seed; -1 or omitted = random' },
                negative_prompt: { type: 'string', description: 'What the result should NOT contain' }
            },
            required: ['prompt']
        },
        effect: () => 'write',
        resource: (args) => ({
            kind: 'image-edit',
            label: String(args.prompt ?? '').slice(0, 80)
        }),
        execute: async (args, ctx) => {
            const common = parseCommonArgs(args, cap.maxSteps);
            if ('error' in common) {
                return common;
            }
            let strength = DEFAULT_STRENGTH;
            if (args.strength !== undefined && args.strength !== null) {
                strength = Number(args.strength);
                if (!Number.isFinite(strength) || strength < 0 || strength > 1) {
                    return { error: 'strength must be a number between 0 and 1' };
                }
            }
            const attachmentId = typeof args.attachment_id === 'string' && args.attachment_id
                ? args.attachment_id
                : undefined;
            const attachmentIds = [];
            if (Array.isArray(args.attachment_ids)) {
                for (const id of args.attachment_ids) {
                    if (typeof id === 'string' && id) {
                        attachmentIds.push(id);
                    }
                }
            }
            if (attachmentId && attachmentIds.length) {
                return { error: 'pass attachment_id or attachment_ids, not both' };
            }
            if (attachmentId) {
                attachmentIds.push(attachmentId);
            }
            if (!ctx?.attach || !ctx.fetchAttachment) {
                return { error: 'this device cannot edit chat images' };
            }
            const inContext = runtime.predictionFor(ctx.image?.modelChoice) === 'flux2_flow';
            const turnImages = ctx.turnImages ?? [];
            if (!attachmentIds.length && turnImages.length > 1 && !inContext) {
                return { error: MULTI_SOURCE_UNSUPPORTED };
            }
            const resolved = await resolveSources(ctx.fetchAttachment, {
                ids: attachmentIds,
                turnImages,
                signal: ctx.signal
            });
            if (ctx.signal?.aborted) {
                return { error: 'image generation canceled' };
            }
            if ('error' in resolved) {
                return resolved;
            }
            const { sources, note } = resolved;
            if (sources.length > 1 && !inContext) {
                return { error: MULTI_SOURCE_UNSUPPORTED };
            }
            if (!runtime.acquire()) {
                return { error: BUSY_ERROR, code: 'busy' };
            }
            const report = ctx.progress;
            const onTick = report && generationPercentTick((percentage) => report({ percentage }), sources.length);
            try {
                const media = await loadMedia();
                if (!media) {
                    return {
                        error: 'image editing needs the native media codecs, unavailable on this device'
                    };
                }
                const inits = [];
                let width = 0;
                let height = 0;
                for (const source of sources) {
                    let decoded;
                    try {
                        decoded = await media.image.decode(b4a.from(source.bytes), { maxFrames: 1 });
                    }
                    catch {
                        return { error: `could not decode ${source.fileName} as an image` };
                    }
                    const frame = decoded.frames?.length ? decoded.frames[0] : decoded;
                    const scale = Math.min(1, cap.maxDim / Math.max(frame.width, frame.height));
                    const fitWidth = snap(frame.width * scale);
                    const fitHeight = snap(frame.height * scale);
                    const fitted = frame.width === fitWidth && frame.height === fitHeight
                        ? frame
                        : await resample(frame, fitWidth, fitHeight);
                    inits.push(b4a.from(await media.image.encode(fitted, { mimetype: 'image/png' })));
                    if (!width) {
                        width = fitWidth;
                        height = fitHeight;
                    }
                }
                const sdk = await runtime.loadSdk();
                const { modelId } = await runtime.ensureLoaded(sdk, ctx.signal, ctx.image?.modelChoice);
                const fusion = inits.length > 1;
                const image = await runDiffusion(sdk, {
                    modelId,
                    params: {
                        prompt: common.prompt,
                        width,
                        height,
                        steps: effectiveSteps(common.steps, ctx.image?.steps, stepsCap),
                        seed: common.seed,
                        negative_prompt: common.negativePrompt,
                        ...(inContext
                            ? {
                                init_images: inits,
                                auto_resize_ref_image: true,
                                guidance: FLUX2_GUIDANCE,
                                cfg_scale: FLUX2_CFG_SCALE
                            }
                            : { init_image: inits[0], strength })
                    },
                    signal: ctx.signal,
                    onTick
                });
                if (!(image instanceof Uint8Array)) {
                    return image;
                }
                const record = await ctx.attach({
                    fileName: `edited-${Date.now()}.png`,
                    mimeType: 'image/png',
                    bytes: image,
                    raw: true
                });
                const notes = note ? [note] : [];
                if (fusion) {
                    notes.push(IMAGE_REF_TOKEN_PATTERN.test(common.prompt)
                        ? `multi-reference fusion of ${sources.length} images`
                        : `multi-reference fusion of ${sources.length} images; the prompt did not ` +
                            'reference @image1/@image2 — the model may have favored the first reference. ' +
                            'Next time write the prompt with explicit @imageN tokens in source order');
                }
                return {
                    attachmentId: record.id,
                    ...(sources.length === 1 && sources[0].id
                        ? { sourceAttachmentId: sources[0].id }
                        : { sourceFileNames: sources.map((source) => source.fileName) }),
                    note: notes.length ? notes.join('; ') : undefined,
                    fileName: record.fileName,
                    byteLength: record.byteLength,
                    width,
                    height
                };
            }
            catch (err) {
                if (err instanceof AbortedError) {
                    return { error: 'image generation canceled' };
                }
                if (HarnessError.is(err, 'IMAGE_LOAD_STALLED')) {
                    return { error: HarnessError.IMAGE_LOAD_STALL_ERROR };
                }
                throw err;
            }
            finally {
                runtime.release();
                report?.(null);
            }
        }
    };
}
function toNull() {
    return null;
}
