#!/usr/bin/env node
// Imports a signing certificate into a throwaway keychain and installs the provisioning profile.

import { appendFileSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export function exportMethod(profile) {
  if (profile.ProvisionsAllDevices === true) return 'enterprise'
  if (!Array.isArray(profile.ProvisionedDevices)) return 'app-store'
  return profile.Entitlements?.['get-task-allow'] === true ? 'development' : 'ad-hoc'
}

// application-identifier is <team id>.<bundle id>.
export function checkBundleId(profile, bundleId) {
  const appId = String(profile.Entitlements?.['application-identifier'] || '')
  const got = appId.slice(appId.indexOf('.') + 1)
  if (got !== bundleId) throw new Error(`provisioning profile is for '${got}', not '${bundleId}'`)
}

function main(env) {
  const run = (cmd, args, opts) => execFileSync(cmd, args, { stdio: 'inherit', ...opts })
  const cert = join(env.RUNNER_TEMP, 'build_certificate.p12')
  const pp = join(env.RUNNER_TEMP, 'build_pp.mobileprovision')
  const keychain = join(env.RUNNER_TEMP, 'app-signing.keychain-db')
  writeFileSync(cert, Buffer.from(env.CERT_BASE64, 'base64'), { mode: 0o600 })
  writeFileSync(pp, Buffer.from(env.PROFILE_BASE64, 'base64'))
  run('security', ['create-keychain', '-p', env.KEYCHAIN_PASSWORD, keychain])
  run('security', ['set-keychain-settings', '-lut', '21600', keychain])
  run('security', ['unlock-keychain', '-p', env.KEYCHAIN_PASSWORD, keychain])
  run('security', ['import', cert, '-P', env.CERT_PASSWORD, '-A', '-t', 'cert', '-f', 'pkcs12', '-k', keychain])
  run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:', '-s', '-k', env.KEYCHAIN_PASSWORD, keychain])
  run('security', ['list-keychain', '-d', 'user', '-s', keychain])
  const plist = execFileSync('security', ['cms', '-D', '-i', pp])
  const profile = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', '-'], { input: plist }).toString())
  checkBundleId(profile, env.BUNDLE_ID)
  const dir = join(homedir(), 'Library/MobileDevice/Provisioning Profiles')
  mkdirSync(dir, { recursive: true })
  copyFileSync(pp, join(dir, `${profile.UUID}.mobileprovision`))
  run('security', ['find-identity', '-p', 'codesigning', '-v'])
  const method = exportMethod(profile)
  appendFileSync(env.GITHUB_OUTPUT, `profile-uuid=${profile.UUID}\nexport-method=${method}\n`)
  console.log(`Provisioning profile ${profile.UUID} (export method ${method})`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.env)
