import { register } from 'node:module'

register(new URL('./harness-resolve-hook.js', import.meta.url), {
  data: { parentURL: import.meta.url }
})

register(new URL('./config-typescript-hook.js', import.meta.url))

// Scope native transforms and TypeScript resolution to this config's local graph.
// Installed SDK/harness packages keep Node's normal module identity and conditions.
export async function importConfig(url: string) {
  if (!url.endsWith('.ts')) return import(url)
  try {
    return await import(`qvac-config:${encodeURIComponent(url)}`)
  } catch (cause) {
    if (cause instanceof SyntaxError || (cause as Error)?.name === 'SyntaxError') {
      throw new Error(
        `Cannot load TypeScript config ${url}. Use Node-supported TypeScript; compile JSX, decorators and other compiler-only syntax to JavaScript first.`,
        { cause }
      )
    }
    throw cause
  }
}

// Node's public import.meta.resolve ignores arbitrary parents without a flag.
// The existing async loader hook can ask Node's native ESM resolver directly.
export async function resolveFrom(specifier: string, parentURL: string): Promise<string> {
  const request = encodeURIComponent(JSON.stringify([specifier, parentURL]))
  const resolved = (await import(`qvac-resolve:${request}`)) as { default: string }
  return resolved.default
}
