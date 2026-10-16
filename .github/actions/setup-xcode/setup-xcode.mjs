#!/usr/bin/env node
// Hosted runners get Xcode selected and CocoaPods and Ninja installed; self-hosted Macs must already have them.

import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const XCODES = ['/Applications/Xcode_16.1.app', '/Applications/Xcode_16.1.0.app', '/Applications/Xcode_16.2.app']

export function pickXcode(exists) {
  const found = XCODES.find(exists)
  if (!found) throw new Error('no Xcode 16.1 or 16.2 on this runner')
  return found
}

export function setup({ hosted, exists, run, has }) {
  if (hosted) {
    run('sudo', ['xcode-select', '-s', pickXcode(exists)])
    run('brew', ['install', 'ninja'])
    run('sudo', ['gem', 'install', 'cocoapods'])
  }
  for (const tool of ['xcodebuild', 'pod', 'ninja']) if (!has(tool)) throw new Error(`${tool} is not on PATH; self-hosted Macs must ship it`)
  const sdks = String(run('xcodebuild', ['-showsdks'], { encoding: 'utf8', stdio: 'pipe' }))
  if (!/iphoneos/i.test(sdks)) throw new Error('xcodebuild lists no iOS SDK')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const run = (cmd, args, opts) => execFileSync(cmd, args, { stdio: 'inherit', ...opts })
  const has = (tool) => {
    try {
      execFileSync('which', [tool], { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }
  setup({ hosted: process.env.RUNNER_ENVIRONMENT === 'github-hosted', exists: existsSync, run, has })
  run('xcodebuild', ['-version'])
}
