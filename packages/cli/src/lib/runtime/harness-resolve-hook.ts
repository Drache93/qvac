import type { ResolveHook } from 'node:module'
// A plugin a qvac.config imports reaches for @qvac/harness, which the user's project rarely installs.
let fallback: string

export function initialize(data: { parentURL: string }) {
  fallback = data.parentURL
}

export const resolve: ResolveHook = async (specifier, context, next) => {
  try {
    return await next(specifier, context)
  } catch (error) {
    if (!/^@qvac\/(harness|sdk)(\/|$)/.test(specifier)) {
      throw error
    }

    return next(specifier, { ...context, parentURL: fallback })
  }
}
