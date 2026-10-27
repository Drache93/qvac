import { register } from 'node:module'
import { resolve } from 'import-meta-resolve'
import { tsImport } from 'tsx/esm/api'

register(new URL('./harness-resolve-hook.js', import.meta.url), {
  data: { parentURL: import.meta.url }
})

// tsx breaks the harness's CommonJS imports, which an inline plugin pulls in, so only .ts uses it.
export const importConfig = (url: string) =>
  url.endsWith('.ts') ? tsImport(url, import.meta.url) : import(url)

export const resolveFrom = (specifier: string, parentURL: string) => resolve(specifier, parentURL)
