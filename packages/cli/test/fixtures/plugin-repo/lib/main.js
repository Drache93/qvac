import { PluginRegistry } from '@qvac/harness/plugins'

export default ({ options }) => ({
  name: 'echo',
  api: PluginRegistry.API_VERSION,
  setup: () => ({
    tools: [
      {
        name: 'user_echo',
        toolset: 'files',
        description: 'Echo the text back with a greeting.',
        parameters: { type: 'object', properties: { text: { type: 'string' } } },
        effect: () => 'read',
        execute: (args) => `${options.greeting} ${args.text}`
      }
    ]
  })
})
