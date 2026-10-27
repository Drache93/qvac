import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
const hash = (source) => crypto.createHash('sha256').update(source).digest('hex')
for (const name of ['bundlebee', 'bundlebee-import']) {
  test(`${name} vendored runtime exactly matches its reviewed provenance`, () => {
    const root = new URL(`../../vendor/${name}/`, import.meta.url)
    const record = JSON.parse(fs.readFileSync(new URL('PROVENANCE.json', root), 'utf8'))
    assert.equal(record.name, name)
    assert.equal(record.version, '2.0.0')
    assert.match(record.baseCommit, /^[a-f\d]{40}$/)
    assert.equal(hash(JSON.stringify(record.files)), record.sourceHash)
    for (const [file, expected] of Object.entries(record.files)) {
      assert.equal(
        hash(fs.readFileSync(new URL(file, root))),
        expected,
        fileURLToPath(new URL(file, root))
      )
    }
    assert.ok(record.files.LICENSE)
    assert.ok(record.files['package.json'])
    if (name === 'bundlebee-import') {
      const manifest = JSON.parse(fs.readFileSync(new URL('package.json', root), 'utf8'))
      assert.equal(manifest.dependencies.bundlebee, '2.0.0')
    }
  })
}
