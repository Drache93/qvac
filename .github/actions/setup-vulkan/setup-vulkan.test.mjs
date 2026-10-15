import test from 'node:test'
import assert from 'node:assert/strict'

import { downloadUrl, envFor, preinstalledEnv, resolveVersion, sdkVersionFromReadme } from './setup-vulkan.mjs'

test('the version comes from the input, then the config file, then latest', () => {
  assert.equal(resolveVersion('1.4.313.0', '1.3.0.0'), '1.4.313.0')
  assert.equal(resolveVersion('', ' 1.3.296.0\n'), '1.3.296.0')
  assert.equal(resolveVersion('', ''), 'latest')
  assert.throws(() => resolveVersion('1.4', ''), /x\.y\.z\.n/)
})

test('download urls match the LunarG layout', () => {
  assert.match(downloadUrl('linux', 'latest'), /latest\/linux\/vulkan_sdk\.tar\.xz$/)
  assert.match(downloadUrl('linux', '1.4.313.0'), /1\.4\.313\.0\/linux\/vulkansdk-linux-x86_64-1\.4\.313\.0\.tar\.xz$/)
  assert.match(downloadUrl('windows', '1.4.313.0'), /vulkansdk-windows-X64-1\.4\.313\.0\.exe$/)
})

test('an installed SDK exports the loader, layer and pkg-config paths', () => {
  const { lines, path } = envFor('linux', '/h/vulkan/x86_64', { LD_LIBRARY_PATH: '/x' })
  assert.ok(lines.includes('LD_LIBRARY_PATH=/h/vulkan/x86_64/lib:/x'))
  assert.equal(path, '/h/vulkan/x86_64/bin')
})

test('a preinstalled SDK exports only what the old workflow did', () => {
  assert.deepEqual(preinstalledEnv('linux', '/opt/vulkansdk/x86_64'), { lines: ['VULKAN_SDK=/opt/vulkansdk/x86_64'], path: '' })
  assert.equal(preinstalledEnv('windows', 'C:\\VulkanSDK').path, 'C:\\VulkanSDK\\Bin')
})

test('the arm64 cache key version is read from the SDK README for latest', () => {
  assert.equal(sdkVersionFromReadme('see https://vulkan.lunarg.com/sdk/1.4.313.0/linux'), '1.4.313.0')
})
