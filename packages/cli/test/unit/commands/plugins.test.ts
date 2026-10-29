import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { installPlugin, listPlugins, togglePlugin } from '@/cli/commands/plugins/plugins'
import { copyDrive } from '@/cli/commands/plugins/hyper'
import { pluginEntry } from '@/lib/runtime/installed-plugins'
import { readPluginState, writePluginState } from '@/lib/runtime/plugin-state'

const FIXTURE = path.resolve('test/fixtures/plugin-repo')
const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    'git',
    ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args],
    {
      cwd,
      stdio: 'ignore'
    }
  )

describe('qvac plugins', () => {
  let tmp: string
  let dataDir: string
  let repo: string
  let url: string
  const state = () => readPluginState(dataDir, fs)

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qvac-plugins-'))
    dataDir = path.join(tmp, 'data')
    repo = path.join(tmp, 'echo')
    url = `file://${repo}`
    fs.cpSync(FIXTURE, repo, { recursive: true })
    git(repo, 'init', '-q')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'echo')
  })

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('installs from git into plugins/<repo name> without enabling it', async () => {
    const message = await installPlugin(dataDir, fs, url)
    assert.match(message, /installed echo; run qvac plugins enable echo to load it/)
    assert.ok(fs.existsSync(path.join(dataDir, 'plugins', 'echo', 'lib', 'main.js')))
    assert.deepEqual(state().enabled, [])
    assert.equal(
      pluginEntry(dataDir, 'echo', fs),
      path.join(dataDir, 'plugins', 'echo', 'lib', 'main.js')
    )
  })

  it('installs under a custom name', async () => {
    await installPlugin(dataDir, fs, url, 'shout')
    assert.ok(fs.existsSync(path.join(dataDir, 'plugins', 'shout', 'package.json')))
    assert.ok(!fs.existsSync(path.join(dataDir, 'plugins', 'echo')))
  })

  it('refuses an installed name, and leaves the folder alone', async () => {
    await installPlugin(dataDir, fs, url)
    await assert.rejects(installPlugin(dataDir, fs, url), /already installed/)
    assert.ok(fs.existsSync(path.join(dataDir, 'plugins', 'echo', 'package.json')))
  })

  it('refuses a name with a path separator', async () => {
    await assert.rejects(installPlugin(dataDir, fs, url, '../x'), /path separator/)
    assert.ok(!fs.existsSync(path.join(dataDir, 'x')))
  })

  it('needs a name for a hyper:// source', async () => {
    await assert.rejects(installPlugin(dataDir, fs, 'hyper://' + 'a'.repeat(52)), /needs a name/)
  })

  it('removes the partial folder when the clone fails', async () => {
    await assert.rejects(installPlugin(dataDir, fs, `file://${tmp}/nothing`, 'gone'))
    assert.ok(!fs.existsSync(path.join(dataDir, 'plugins', 'gone')))
  })

  it('enables and disables, keeping options', async () => {
    await installPlugin(dataDir, fs, url)
    writePluginState(dataDir, { ...state(), options: { echo: { greeting: 'hi' } } }, fs)
    togglePlugin(dataDir, fs, 'echo', true)
    assert.deepEqual(state().enabled, ['echo'])
    assert.deepEqual(state().disabled, [])
    togglePlugin(dataDir, fs, 'echo', false)
    assert.deepEqual(state().enabled, [])
    assert.deepEqual(state().disabled, ['echo'])
    assert.deepEqual(state().options['echo'], { greeting: 'hi' })
  })

  it('refuses to enable what is not installed, unless it is a catalog plugin', () => {
    assert.throws(() => togglePlugin(dataDir, fs, 'nope', true), /not installed/)
    assert.deepEqual(state().enabled, [])
    togglePlugin(dataDir, fs, 'code-mode', true)
    assert.deepEqual(state().enabled, ['code-mode'])
  })

  it('lists installed plugins as enabled or disabled, and enabled ones with no folder as missing', async () => {
    assert.match(listPlugins(dataDir, fs), /no plugins installed in .*plugins/)
    await installPlugin(dataDir, fs, url)
    await installPlugin(dataDir, fs, url, 'other')
    togglePlugin(dataDir, fs, 'echo', true)
    togglePlugin(dataDir, fs, 'code-mode', true)
    writePluginState(dataDir, { ...state(), enabled: [...state().enabled, 'ghost'] }, fs)
    assert.equal(listPlugins(dataDir, fs), 'echo  enabled\nother  disabled\nghost  missing')
  })

  it('copies a drive and refuses an entry that escapes the folder', async () => {
    const files = new Map([
      ['/package.json', '{}'],
      ['/lib/main.js', 'x']
    ])
    const drive = (keys: string[]) => ({
      async *list() {
        for (const key of keys) yield { key }
      },
      get: (key: string) => Promise.resolve(Buffer.from(files.get(key) ?? 'y'))
    })
    const dest = path.join(tmp, 'drive')
    assert.equal(await copyDrive(drive([...files.keys()]), dest, fs), 2)
    assert.equal(fs.readFileSync(path.join(dest, 'lib', 'main.js'), 'utf8'), 'x')
    await assert.rejects(copyDrive(drive(['/../evil']), dest, fs), /outside the plugin folder/)
    assert.ok(!fs.existsSync(path.join(tmp, 'evil')))
  })
})
