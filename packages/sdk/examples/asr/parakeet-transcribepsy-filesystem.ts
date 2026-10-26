/**
 * TranscribePsy-250M-EU-sub transcription from a WAV file.
 *
 * Usage:
 *   npx tsx examples/asr/parakeet-transcribepsy-filesystem.ts <wav-file> [transcribepsy-gguf]
 *
 * Uses PARAKEET_TRANSCRIBEPSY_250M_Q8_0 from the registry by default, or a
 * local GGUF when supplied. Audio should be 16 kHz mono PCM in a WAV container.
 * Supports Dutch, English, French, German, Italian, Polish, Portuguese and
 * Spanish without a language option. Long recordings use the model's recommended
 * 60-second windows with 25% overlap automatically.
 *
 * On macOS, a local transcribepsy-250m-eu-sub-coreml.gguf can be used with its
 * required encoder and decoder .mlmodelc sidecars in the same directory.
 */
import {
  loadModel,
  unloadModel,
  transcribe,
  close,
  PARAKEET_TRANSCRIBEPSY_250M_Q8_0
} from '@qvac/sdk'

const [audioFilePath, modelPath] = process.argv.slice(2)

if (!audioFilePath || audioFilePath === '--help') {
  console.error(
    'Usage: npx tsx examples/asr/parakeet-transcribepsy-filesystem.ts ' +
      '<wav-file> [transcribepsy-gguf]'
  )
  console.error('If the model path is omitted, defaults to the registry model.')
  process.exit(audioFilePath === '--help' ? 0 : 1)
}

async function run(audioPath: string): Promise<void> {
  let modelId: string | undefined
  try {
    console.log('▸ Loading TranscribePsy model...')
    modelId = await loadModel({
      modelSrc: modelPath ?? PARAKEET_TRANSCRIBEPSY_250M_Q8_0,
      modelType: 'parakeet-transcription',
      modelConfig: {
        maxThreads: 4
      },
      onProgress: (p) => {
        const mb = (n: number) => (n / 1e6).toFixed(1)
        const line = `▸ Downloading ${p.percentage.toFixed(0)}% (${mb(p.downloaded)}/${mb(p.total)} MB)`
        process.stderr.write(process.stderr.isTTY ? `\r${line}` : `${line}\n`)
        if (p.percentage >= 100) process.stderr.write('\n')
      }
    })
    console.log(`▸ TranscribePsy model loaded with ID: ${modelId}`)
    console.log('▸ Transcribing audio...')
    console.log(await transcribe({ modelId, audioChunk: audioPath }))
  } finally {
    try {
      if (modelId !== undefined) {
        console.log('▸ Unloading model...')
        await unloadModel({ modelId })
        console.log('▸ Done')
      }
    } finally {
      await close()
    }
  }
}

run(audioFilePath).catch((error) => {
  console.error('✖', error)
  process.exitCode = 1
})
