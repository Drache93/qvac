# Transcription

Run the examples on this page from `packages/sdk`.

## Streaming transcription statistics

Whisper and Parakeet duplex transcription sessions expose terminal engine
statistics after their event iterator completes:

```ts
const session = await transcribeStream({ modelId })

for await (const text of session) {
  process.stdout.write(text)
}

const stats = await session.stats
console.log(stats?.audioDuration, stats?.realTimeFactor)
```

`session.stats` resolves to `undefined` when the engine does not report
statistics.

Batch `transcribe()` calls also expose terminal statistics:

```ts
const call = transcribe({ modelId, audioChunk })
const text = await call
const stats = await call.stats
console.log(text, stats?.encoderUsedCoreml)
```

`call.stats` resolves to `undefined` when the engine reports no statistics and
rejects if transcription fails.

## Parakeet Core ML encoders on Apple devices

Load a supported Parakeet registry constant as usual. On macOS and iOS, the SDK
downloads any complete, published Core ML encoder bundle with its GGUF and
places the `.mlmodelc` directory where the native addon discovers it. This is
available for TDT 0.6B v3, Unified English 0.6B, EOU 120M v1, and streaming
Sortformer v2.1. The download includes the sidecar weights, so first load takes
more time and disk space. Other platforms download only the GGUF. If the
sidecar is unavailable or cannot load, inference uses the GGUF encoder.
Sortformer v2.1 also needs a GGUF with the
`parakeet.model_variant=sortformer-streaming-v2.1-aosc` metadata. Caching both
sidecars alone does not activate Core ML. See
[`examples/asr/parakeet-unified-coreml.ts`](../examples/asr/parakeet-unified-coreml.ts)
for a local check of a Unified GGUF and its encoder bundle.

## Speaker-aware transcription

MOSS transcription uses `MODEL_TYPES.mossTranscribe` and the
`@qvac/sdk/moss-transcribe/plugin` entry point. MOSS processes a whole recording;
use `transcribe`, since it has no duplex streaming or configuration reload.

```ts
import { loadModel, transcribe, MOSS_TRANSCRIBE_DIARIZE_Q8_0 } from '@qvac/sdk'

const modelId = await loadModel({
  modelSrc: MOSS_TRANSCRIBE_DIARIZE_Q8_0,
  modelConfig: { useGPU: true, maxThreads: 4 }
})
const segments = await transcribe({
  modelId,
  audioChunk: '/recordings/meeting.wav',
  metadata: true,
  hotwords: ['QVAC'],
  maxNewTokens: 2048
})
```

For a runnable example with download progress and resource cleanup, see
[the MOSS file transcription example](../examples/asr/moss-transcribe-filesystem.ts):

```bash
npx tsx examples/asr/moss-transcribe-filesystem.ts examples/audio/diarization-sample-16k.wav
# Use local weights and per-request hotwords:
npx tsx examples/asr/moss-transcribe-filesystem.ts meeting.wav ./moss.gguf QVAC OpenMOSS
```

Segments retain `speaker` labels such as `S01`, zero-based `speakerId`, and
`startMs`/`endMs`. Hotwords apply to each request: at most 64 nonempty terms of
64 UTF-8 bytes each. A MOSS `prompt` replaces the default instruction and cannot
be combined with hotwords. `maxNewTokens: 0` uses the model default. These two
MOSS-specific options are rejected for Whisper and Parakeet models.

MOSS memory-fit assessment projects the declared recording and decoding options
without loading weights:

```typescript
const fit = await assessModelFit({
  models: [
    {
      modelSrc: MOSS_TRANSCRIBE_DIARIZE_Q8_0,
      modelConfig: { useGPU: false },
      transcriptionWorkload: { audioSeconds: 300, hotwords: ['Erin'], maxNewTokens: 0 }
    }
  ]
})
```

Import [`assessModelFit`](./assess-model-fit.md) from `@qvac/sdk`. Use the
longest recording you intend to transcribe, with the same prompt/hotwords and
token limit as the request. Without `transcriptionWorkload`, MOSS has no native
fit evidence, its recording window is omitted, and the result can remain
`unknown`. Assessment uses a registry description when available, or a local
model path; it downloads no full weights.

## Nemotron 3 Diarization

Load a local Nemotron 3 Diarization GGUF with `modelType: 'parakeet-transcription'`.
The addon detects the variant from the GGUF and supports up to eight speakers,
including overlapping activity. This model reports speaker turns rather than words.

Use `transcribe({ modelId, audioChunk, metadata: true })` for offline diarization.
Each result can include `speakerSegments` with zero-based `speakerId`, `startMs`,
and `endMs`. Load with `modelConfig.streaming: true` before using `transcribeStream`.
Streaming metadata carries `speakerId` on each diarization segment.
For streaming speaker-activity events, enable `streamingSpeakerVad` at load or
`emitSpeakerVad` under `parakeetStreamingConfig` per `transcribeStream` call;
conversation VAD events retain their dominant `speakerId`.

`diarizationThreshold` (0–1) and `diarizationMinSegmentMs` (nonnegative integer)
are supported in `modelConfig` and per-call `parakeetStreamingConfig`. Omit them
to preserve model defaults. Nemotron defaults to a 0.5 threshold and 200 ms minimum
turn; its default left context is 0 ms, while an explicitly configured 80 ms is
preserved. CLI `verbose_json` exposes offline turns as `speaker_segments` with
`speaker_id` and start/end timestamps in seconds.

See [the local Nemotron diarization example](../examples/asr/nemotron-diarization-filesystem.ts):

```bash
npx tsx examples/asr/nemotron-diarization-filesystem.ts ./nemotron-diarization.gguf meeting.wav
```
