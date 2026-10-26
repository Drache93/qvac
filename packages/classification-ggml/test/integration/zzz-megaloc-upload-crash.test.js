'use strict'

const test = require('brittle')
const env = require('bare-env')
const fs = require('bare-fs')
const path = require('bare-path')
const { MegaLoc } = require('../../index')
const plan = require('../fixtures/megaloc-diagnostic-plan.json')
const { isMobile } = require('./utils')

if (plan.mode === 'crash') {
  test('Diagnostic: original chunked Q6_K upload reproducer after all other tests', async function (t) {
    t.timeout(120000)
    let filename =
      env.QVAC_MEGALOC_MIXED_MODEL_PATH || path.join(__dirname, '../fixtures/megaloc-mixed.gguf')
    if (isMobile) {
      const key = Object.keys(global.assetPaths).find((key) =>
        key.endsWith('/megaloc-mixed.gguf.bin')
      )
      if (!key) throw new Error('Missing mixed model')
      filename = global.assetPaths[key].replace(/^file:\/\//, '')
    }
    t.ok(fs.existsSync(filename))
    env.QVAC_MEGALOC_UPLOAD = 'guarded'
    console.log(
      'MEGALOC_DIAG CRASH_PROBE_START: original 8 MiB upload, mixed model, OpenCL; F16 is not loaded in this probe'
    )
    const instance = new MegaLoc({ modelPath: filename, backend: 'DIAG_OPENCL', threads: 8 })
    try {
      await instance.load()
      t.pass('Original upload completed without a process crash')
    } finally {
      env.QVAC_MEGALOC_UPLOAD = ''
      await instance.destroy()
    }
  })
}
