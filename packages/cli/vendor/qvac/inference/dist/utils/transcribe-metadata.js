import { ModelType } from '../schemas/index.js';
import { TranscriptionFailedError } from '../errors/index.js';
/**
 * Normalize a native transcript segment to the engine-level
 * `TranscribeSegment` shape exposed to callers: seconds → milliseconds,
 * `toAppend` → `append`, and defaults for optional fields. The
 * engine-specific fields are carried through only when the engine sent them,
 * so a segment does not gain fields whose value would be meaningless.
 */
export function toTranscribeSegment(chunk) {
    return {
        text: chunk.text,
        ...(chunk.speakerId !== undefined && { speakerId: chunk.speakerId }),
        ...(chunk.speaker !== undefined && { speaker: chunk.speaker }),
        ...(chunk.speakerSegments !== undefined && {
            speakerSegments: chunk.speakerSegments.map((turn) => ({
                speakerId: turn.speakerId,
                startMs: turn.start * 1000,
                endMs: turn.end * 1000
            }))
        }),
        startMs: (chunk.start ?? 0) * 1000,
        endMs: (chunk.end ?? 0) * 1000,
        append: chunk.toAppend ?? false,
        id: chunk.id ?? 0,
        ...(chunk.isEndOfTurn !== undefined && { isEndOfTurn: chunk.isEndOfTurn }),
        ...(chunk.startsWord !== undefined && { startsWord: chunk.startsWord }),
        ...(chunk.windowStartTimestep !== undefined && {
            windowStartTimestep: chunk.windowStartTimestep
        })
    };
}
/**
 * Engines whose native layer emits per-segment metadata. MOSS supplies speaker
 * labels alongside timestamps; the parakeet output serializer sends `start`, `end`, `id`,
 * `toAppend`, `isEndOfTurn` and `startsWord` for every segment, and
 * `timestampsEnabled` defaults to true.
 */
const METADATA_CAPABLE_ENGINES = [
    ModelType.whispercppTranscription,
    ModelType.parakeetTranscription,
    ModelType.mossTranscribe
];
/**
 * Guard used by transcription ops when the caller opts into `metadata: true`.
 */
export function assertMetadataSupported(modelId, engineType, metadata) {
    if (!metadata)
        return;
    if (!METADATA_CAPABLE_ENGINES.includes(engineType)) {
        throw new TranscriptionFailedError(`metadata mode is not supported on model ${modelId} (engine: ${engineType || 'unknown'}); ` +
            `supported engines: ${METADATA_CAPABLE_ENGINES.join(', ')}`);
    }
}
