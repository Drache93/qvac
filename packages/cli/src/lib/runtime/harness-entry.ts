// The CLI composes its execution host; optional language runtimes arrive as prepared providers.
import { HarnessSidecar } from '@qvac/harness/sidecar'
import type { SidecarContext } from '@qvac/harness/sidecar'
import type { HarnessPlugin } from '@qvac/harness/plugins'
import { Image } from '@qvac/harness/plugins/image'
import { Knowledge } from '@qvac/harness/plugins/knowledge'
import { McpPlugin } from '@qvac/harness/plugins/mcp'
import { Music } from '@qvac/harness/plugins/music'
import { ObsidianRoute } from '@qvac/harness/plugins/obsidian'
import { Speech } from '@qvac/harness/plugins/speech'
import { TranslationPlugin } from '@qvac/harness/plugins/translation'
import { Weather } from '@qvac/harness/plugins/weather'
import { WebSearchPlugin } from '@qvac/harness/plugins/web-search'

function withRead<T extends { read?: readonly string[] | undefined }>(plugin: T) {
  return Object.assign(plugin, { read: plugin.read || [] })
}

export function firstPartyPlugins(context: SidecarContext): HarnessPlugin[] {
  const {
    pluginOptions,
    skillCatalog,
    credentialStore,
    imageModel,
    imageClamps,
    musicModel,
    musicClamps,
    knowledge
  } = context
  const plugins: HarnessPlugin[] = [
    new ObsidianRoute({ credentialStore }),
    new Speech(pluginOptions.speech),
    new TranslationPlugin(),
    withRead(new Weather({ read: ['weather_lookup'] })),
    withRead(new WebSearchPlugin({ read: ['web_search'] })),
    withRead(
      new McpPlugin({
        generic: true,
        servers: pluginOptions.mcp?.servers,
        skillCatalog,
        credentialStore,
        read: ['mcp_call']
      })
    )
  ]
  if (imageModel) {
    plugins.push(
      withRead(
        new Image({
          model: imageModel,
          ...(imageClamps ? { clamps: imageClamps } : {}),
          read: ['generate_image']
        })
      )
    )
  }
  if (musicModel) {
    plugins.push(
      withRead(
        new Music({
          model: musicModel,
          ...(musicClamps ? { clamps: musicClamps } : {}),
          read: ['generate_music']
        })
      )
    )
  }
  if (knowledge) {
    plugins.push(withRead(new Knowledge({ dir: knowledge.dir, model: knowledge.model })))
  }
  return plugins
}

export default function start(ipc: Parameters<typeof HarnessSidecar.start>[0], ready: () => void) {
  return HarnessSidecar.start(ipc, ready, firstPartyPlugins)
}
