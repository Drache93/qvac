/* global Bare */
import Supervisor from 'bare-supervisor'
import stowEntry from 'bare-supervisor/entry'
import sidecarRunner from 'bare-supervisor/runner/sidecar'
import { Core, assistantChild, clientSessions } from '../dist-lib/index.js'
import { DEFAULT_RAG_MODEL } from '../dist-lib/lib/core/files/rag/models.js'
import { Logger, toLoggerOptions } from '../dist-lib/lib/log.js'
import { releaseChannel, resolveStorage } from '@qvac/harness/storage'
import { closeOfficeWorker, extractOfficeText } from '@qvac/harness/office'
import {
  DEFAULT_IMAGE_MODEL_CHOICE,
  DEFAULT_MUSIC_MODEL_CHOICE,
  harnessChild,
  imageClampsFromEnv,
  imageModelFor,
  imageModelFromEnv
} from '@qvac/harness'
import { startCredentialPusher } from '../dist-lib/lib/credential-pusher.js'

const DEFAULT_KV_CACHE = { kvCacheK: 'q8_0', kvCacheV: 'q8_0' }

// lunte-disable-next-line qvac/no-default-export -- bare-stow runs an entry's default export
export default stowEntry((ipc) => {
  const {
    logFlags = {},
    environment = 'local',
    storage: storageOverrides = {},
    skillsDir = undefined,
    wheelsDir = undefined,
    imageEnv = {},
    harnessEntry,
    bootstrapNodes: bootstrapJson = undefined,
    device,
    app = undefined,
    llm = DEFAULT_KV_CACHE,
    hostsModelSource = true,
    eager = true,
    // undefined keeps Core's own choice; false lets a host start without fetching default models
    autoDownloadModels = undefined,
    fakeModels = false
  } = JSON.parse(Bare.argv[2] || '{}')

  const bootstrapNodes = bootstrapJson ? JSON.parse(bootstrapJson) : undefined

  const channel = releaseChannel(environment)
  const storage = resolveStorage(channel, storageOverrides)
  const storagePath = storage.assistant

  const logFile = logFlags.logFile || `${storage.root}/assistant.log`
  const logger = new Logger(toLoggerOptions({ ...logFlags, logFile }))

  // without an imageModel the harness registers no image tools and the skill reads `unsupported`
  const imageModel =
    imageModelFromEnv(
      imageEnv,
      () =>
        logger.warn(
          'assistant',
          'QVAC_IMAGE_MODEL is a catalog choice — ignoring QVAC_IMAGE_LLM/QVAC_IMAGE_VAE/QVAC_IMAGE_PREDICTION'
        ),
      () =>
        logger.warn(
          'assistant',
          'QVAC_IMAGE_PREDICTION needs QVAC_IMAGE_LLM and QVAC_IMAGE_VAE (a FLUX set) — ignoring it'
        )
    ) ?? imageModelFor(DEFAULT_IMAGE_MODEL_CHOICE)
  const imageClamps = imageClampsFromEnv(imageEnv)

  // without a musicModel the harness registers no generate_music and the skill reads unavailable
  const musicModel = DEFAULT_MUSIC_MODEL_CHOICE

  const sup = new Supervisor()
  const sessions = clientSessions(ipc)
  const core = new Core(() => sessions.current, {
    logger,
    storagePath,
    device,
    bootstrapNodes,
    app: app ? { ...app, channel } : undefined,
    hostsModelSource,
    autoDownloadModels,
    apiLifecycle: {
      suspend: () => sup.suspend(),
      resume: () => sup.resume()
    }
  })

  // the host resets the session when its renderer reloads: same Core, a fresh client over one pipe
  ipc.on('session-reset', () => {
    core
      .connect(sessions.reset())
      .catch((err) => logger.warn('assistant-sidecar', 'session reset failed', err?.message))
  })

  sup.add('office', {
    start: () => ({ close: closeOfficeWorker })
  })

  sup.add('core', {
    deps: ['office'],
    start: () => core,
    presuspend: (handle) => handle.presuspend(),
    suspend: (handle) => handle.suspend(),
    wakeup: (handle) => handle.wakeup(),
    resume: (handle) => handle.resume()
  })

  sup.add(
    'assistant',
    assistantChild({
      extractors: { office: extractOfficeText },
      // knowledge indexing volunteers this device; rebuilt against each harness incarnation
      embedder: (harness) => ({
        model: DEFAULT_RAG_MODEL,
        embed: ({ texts, signal }) => harness.embed({ model: DEFAULT_RAG_MODEL, texts, signal })
      }),
      harness: harnessChild(harnessEntry, {
        runner: sidecarRunner,
        skillsDir,
        wheelsDir,
        sdkStorage: storage.sdk,
        imageModel,
        imageClamps,
        musicModel,
        llm: { ...llm },
        logger,
        eager
      }),
      onHarness: (harness, { engine }) => startCredentialPusher(harness, engine, logger),
      runReplayDir: `${storage.root}/run-replay`,
      logger,
      fakeModels
    })
  )

  for (const event of ['child-died', 'child-restarting', 'stall']) {
    sup.on(event, (payload) => logger.warn('assistant-sidecar', event, payload))
  }

  sup.on('gave-up', ({ name, error }) =>
    logger.error('assistant-sidecar', `${name} gave up`, error?.message)
  )
  sup.on('power', (payload) => logger.info('assistant-sidecar', 'power', payload))

  return sup
})
