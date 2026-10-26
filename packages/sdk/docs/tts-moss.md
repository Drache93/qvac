# MOSS text-to-speech engines

`textToSpeech` has two MOSS desktop batch engines: MOSS-SoundEffect, which
generates a sound effect from a text description, and MOSS-Speech, which replies
to a typed or spoken question.

Both engines run one native batch job. With the default `stream: true` the
completed audio arrives as one chunk; with `stream: false` it is collected in
`buffer`. Neither supports sentence streaming or duplex text input.

## MOSS-SoundEffect

Load it with `modelType: 'tts-ggml'` and `modelConfig: { ttsEngine: 'moss-sfx' }`.
The primary source is its single GGUF. With an `AUDIOGEN_MOSS_SFX_V2_*` constant,
pass its `.src` URL as `modelSrc`, because the full descriptor selects the
audiogen plugin.

Describe the sound in text. The optional controls are `seconds` (up to 30),
`negativePrompt`, `steps`, `guidance` and `shift`; each can also be a load
default. The output is 48 kHz.

## MOSS-Speech

Load it with `modelConfig: { ttsEngine: 'moss-speech', mossSpeechCodecModelSrc: <codec source> }`
and the language-model GGUF as `modelSrc`.

Ask with either `text`, or `audio` plus `sampleRate`. Audio is a JSON array of
normalized mono samples in [-1, 1]. Earlier turns go in `messages`; each turn has
a `role` and either `text` or `audio` plus `sampleRate`.

The per-call controls are `systemPrompt`, `replyVoice` plus
`replyVoiceSampleRate`, `maxReplySeconds`, `maxNewTokens`, `textReply`,
`greedy`, `temperature`, `topP` and `topK`. Omitting `maxNewTokens` preserves the
addon's remaining-context budget.

Consume `bufferStream` in the default streaming mode, or await `buffer` with
`stream: false`, then await `result.text` for any reply text. Spoken replies are
24 kHz and can be audio-only. Use `textReply: true` when text is required; it
returns text with an empty audio buffer.

## Examples

- [Basic sound effects](../examples/tts/moss-sound-effect.ts)
- [Sound-effect controls](../examples/tts/moss-sound-effect-controls.ts)
- [Typed question to text reply](../examples/tts/moss-speech.ts)
- [Spoken question to spoken reply](../examples/tts/moss-speech-audio.ts)

Run them from `packages/sdk` with `node --import tsx examples/tts/<file>.ts`; the
spoken-question example also takes a WAV file path. Each example downloads its
model, returns text or writes a WAV reply, unloads the model, and closes the SDK
worker.

## Memory fit

[`assessModelFit`](./assess-model-fit.md) supports metadata-only MOSS-TTS/TTSD
and MOSS-SoundEffect projections. Add `ttsWorkload` beside `modelConfig` on the
assessment candidate: `{ promptRows, referenceSamples, streaming }` for MOSS, or
`{ prompt, seconds }` for sound effects. MOSS needs its backbone and codec
decoder; reference encoding also needs the codec encoder. Prompt rows must cover
the complete native prompt, including dialogue and reference rows. Missing
workloads return an unknown assessment rather than guessing.

For a TTS fit, pass an explicit `modelType` and `ttsEngine`, and use a
downloaded local file. The bare `.src` URL lacks the checksum and registry
coordinates needed for a weightless stub, and the audiogen descriptor and
resource profile do not identify the TTS engine.

MOSS-Speech has no native fitter and remains unknown. Workloads
are fit-only: loading a MOSS model does not accept them, and its automatic fit
preflight remains unknown.

## CLI

The CLI configuration picker includes both engines. Their conversation and
sound-effect request controls are library-only because the OpenAI speech endpoint
cannot represent those requests.
