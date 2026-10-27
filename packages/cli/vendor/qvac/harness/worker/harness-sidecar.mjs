// bare-stow entry: the first-party plugins on the shared boot; a host entry composes the same two
import '../dist-lib/lib/hardware/gpu-probe-entry.js'
import { HarnessSidecar } from '../dist-lib/lib/sidecar/index.js'
import { Image } from '../dist-lib/plugins/image/index.js'
import { Knowledge } from '../dist-lib/plugins/knowledge/index.js'
import { McpPlugin } from '../dist-lib/plugins/mcp/index.js'
import { Music } from '../dist-lib/plugins/music/index.js'
import { ObsidianRoute } from '../dist-lib/plugins/obsidian/index.js'
import { Python } from '../dist-lib/plugins/python/index.js'
import { Speech } from '../dist-lib/plugins/speech/index.js'
import { TranslationPlugin } from '../dist-lib/plugins/translation/index.js'
import { Weather } from '../dist-lib/plugins/weather/index.js'
import { WebSearchPlugin } from '../dist-lib/plugins/web-search/index.js'

export function firstPartyPlugins({
  pluginOptions,
  skillCatalog,
  credentialStore,
  imageModel,
  imageClamps,
  musicModel,
  musicClamps,
  knowledge
}) {
  const plugins = [
    new Python(),
    new ObsidianRoute({ credentialStore }),
    new Speech(pluginOptions.speech),
    new TranslationPlugin(),
    new Weather({ read: ['weather_lookup'] }),
    new WebSearchPlugin({ read: ['web_search'] }),
    // granted read so a skill's declared read methods on its server do not ask
    new McpPlugin({
      generic: true,
      servers: pluginOptions.mcp?.servers,
      skillCatalog,
      credentialStore,
      read: ['mcp_call']
    })
  ]
  if (imageModel) {
    // granted read so a generation does not ask for approval; edit_image stays a write
    plugins.push(new Image({ model: imageModel, clamps: imageClamps, read: ['generate_image'] }))
  }

  if (musicModel) {
    plugins.push(new Music({ model: musicModel, clamps: musicClamps, read: ['generate_music'] }))
  }

  if (knowledge) {
    plugins.push(new Knowledge({ dir: knowledge.dir, model: knowledge.model }))
  }

  return plugins
}

// lunte-disable-next-line qvac/no-default-export -- the stow entry calls this module's default
export default function start(ipc, ready) {
  return HarnessSidecar.start(ipc, ready, firstPartyPlugins)
}
