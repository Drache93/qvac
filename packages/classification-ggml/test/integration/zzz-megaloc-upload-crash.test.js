'use strict'

const test = require('brittle')
const env = require('bare-env')
const fs = require('bare-fs')
const path = require('bare-path')
const { MegaLoc } = require('../../index')
const plan = require('../fixtures/megaloc-diagnostic-plan.json')
const { isMobile } = require('./utils')

const guarded = plan.mode === 'crash'
test(
  guarded
    ? 'Diagnostic: original chunked Q6_K upload reproducer after all other tests'
    : 'Diagnostic: complete mixed tensor upload remains usable',
  async function (t) {
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
    env.QVAC_MEGALOC_UPLOAD = guarded ? 'guarded' : ''
    if (guarded) {
      console.log(
        'MEGALOC_DIAG CRASH_PROBE_START: original 8 MiB upload, mixed model, OpenCL; F16 is not loaded in this probe'
      )
    }
    const instance = new MegaLoc({
      modelPath: filename,
      backend: guarded ? 'DIAG_OPENCL' : undefined,
      threads: 8
    })
    try {
      await instance.load()
      t.pass('Mixed tensor upload completed without a process crash')
    } finally {
      env.QVAC_MEGALOC_UPLOAD = ''
      await instance.destroy()
    }
  }
)
