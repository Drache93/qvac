'use strict'

const test = require('brittle')
const fs = require('bare-fs')
const path = require('bare-path')
const env = require('bare-env')
const { MegaLoc } = require('../../index')
const source = require('../fixtures/megaloc-diagnostic-images.json')
const synthetic = require('../fixtures/megaloc-reference.json')
const plan = require('../fixtures/megaloc-diagnostic-plan.json')
const { isMobile } = require('./utils')

const D = 8448
const traceDir = path.join(path.dirname(asset('megaloc-f16.gguf')), '.megaloc-diagnostic-trace')
const available = []
let reportIndex = 0

function report(type, values) {
  const data = JSON.stringify({ type, ...values })
  const id = reportIndex++
  const count = Math.ceil(data.length / 1800)
  if (count === 1) return console.log('MEGALOC_DIAG ' + data)
  for (let index = 0; index < count; index++) {
    console.log(
      'MEGALOC_DIAG ' +
        JSON.stringify({
          type: 'chunk',
          id,
          label: type,
          index,
          count,
          data: data.slice(index * 1800, (index + 1) * 1800)
        })
    )
  }
}

function asset(name) {
  if (name.endsWith('.gguf')) {
    const quant = name.includes('-mixed.') ? 'MIXED' : 'F16'
    if (env['QVAC_MEGALOC_' + quant + '_MODEL_PATH']) {
      return env['QVAC_MEGALOC_' + quant + '_MODEL_PATH']
    }
  }
  if (isMobile && global.assetPaths) {
    const suffix = name.endsWith('.gguf') ? name + '.bin' : name
    for (const key of Object.keys(global.assetPaths)) {
      if (key.endsWith('/' + suffix)) return global.assetPaths[key].replace(/^file:\/\//, '')
    }
  }
  for (const parent of ['fixtures', 'mobile/diagnosticAssets', 'mobile/testAssets']) {
    const local = path.join(__dirname, '..', parent, name)
    if (fs.existsSync(local)) return local
  }
  throw new Error('Missing diagnostic asset: ' + name)
}

function model(quant, backend) {
  return new MegaLoc({ modelPath: asset('megaloc-' + quant + '.gguf'), backend, threads: 8 })
}

function pixels(width = 322, height = 322) {
  const value = new Uint8Array(width * height * 3)
  for (let i = 0; i < value.length; i++) value[i] = (i * 37 + Math.floor(i / 19)) % 256
  return value
}

function floats(filename) {
  const bytes = fs.readFileSync(asset(filename))
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}

function similarity(a, b) {
  let aa = 0
  let bb = 0
  let ab = 0
  let squared = 0
  let max = 0
  let different = 0
  for (let i = 0; i < a.length; i++) {
    aa += a[i] * a[i]
    bb += b[i] * b[i]
    ab += a[i] * b[i]
    const delta = a[i] - b[i]
    squared += delta * delta
    max = Math.max(max, Math.abs(delta))
    if (delta !== 0) different++
  }
  return {
    cosine: ab / Math.sqrt(aa * bb),
    relativeRms: Math.sqrt(squared / bb),
    maxAbs: max,
    different
  }
}

function valid(t, value) {
  t.is(value.length, D)
  t.ok(value.every(Number.isFinite), 'finite descriptor')
  const norm = value.reduce((sum, x) => sum + x * x, 0)
  t.ok(Math.abs(norm - 1) < 1e-4, 'normalized descriptor')
}

function cleanEnv() {
  for (const key of ['TRACE', 'TRACE_DIR', 'CPU_OPS', 'CPU_RANGE', 'PROBES', 'DEVICES', 'UPLOAD']) {
    env['QVAC_MEGALOC_' + key] = ''
  }
  if (plan.cpuOps) env.QVAC_MEGALOC_CPU_OPS = plan.cpuOps
}

function embedSynthetic(instance, reference) {
  return instance.embed(pixels(reference.width, reference.height), {
    width: reference.width,
    height: reference.height,
    channels: 3
  })
}

test('Diagnostic: backend inventory and isolated engine operations', async function (t) {
  t.timeout(10 * 60 * 1000)
  cleanEnv()
  env.QVAC_MEGALOC_DEVICES = '1'
  env.QVAC_MEGALOC_PROBES = '1'
  const candidates = isMobile ? ['CPU', 'DIAG_OPENCL', 'DIAG_VULKAN'] : ['CPU', 'CUDA0', 'Vulkan0']
  for (const backend of candidates) {
    const instance = model('f16', backend)
    try {
      await instance.load()
      valid(t, await embedSynthetic(instance, synthetic.cases[2]))
      available.push(backend)
      report('backend', { backend, stats: instance.getRuntimeStats() })
    } catch (error) {
      if (!/backend is unavailable/i.test(error.message)) throw error
      report('backend_unavailable', { backend, error: error.message })
    } finally {
      await instance.destroy()
    }
  }
  t.ok(available.includes('CPU'))
  t.ok(available.length > 1, 'at least one GPU path is exercised')
  cleanEnv()
})

test('Diagnostic: first divergence and callback observer effect', async function (t) {
  t.timeout(10 * 60 * 1000)
  fs.mkdirSync(traceDir, { recursive: true })
  let cpuOutput
  for (const backend of available) {
    cleanEnv()
    env.QVAC_MEGALOC_TRACE_DIR = traceDir
    env.QVAC_MEGALOC_TRACE = backend === 'CPU' ? 'save' : 'compare'
    const instance = model('f16', backend)
    let traced
    try {
      await instance.load()
      traced = await embedSynthetic(instance, synthetic.cases[2])
      valid(t, traced)
      if (backend === 'CPU') cpuOutput = traced
      report('traced', {
        backend,
        againstCpuF16: similarity(traced, cpuOutput),
        againstPytorch: similarity(traced, floats(synthetic.cases[2].reference))
      })
    } finally {
      await instance.destroy()
    }
    cleanEnv()
    const plain = model('f16', backend)
    try {
      await plain.load()
      const result = await embedSynthetic(plain, synthetic.cases[2])
      report('observer_effect', { backend, ...similarity(result, traced) })
    } finally {
      await plain.destroy()
    }
  }
  for (const file of fs.readdirSync(traceDir)) {
    if (/^diag_\d{4}\.bin$/.test(file)) fs.unlinkSync(path.join(traceDir, file))
  }
  cleanEnv()
})

test('Diagnostic: warm repetition and cold reload determinism', async function (t) {
  t.timeout(10 * 60 * 1000)
  for (const backend of available) {
    for (const quant of ['f16', 'mixed']) {
      const instance = model(quant, backend)
      const first = []
      try {
        await instance.load()
        for (const reference of synthetic.cases) {
          const result = await embedSynthetic(instance, reference)
          valid(t, result)
          first.push(result)
          const comparisons = []
          for (let i = 0; i < 5; i++) {
            comparisons.push(similarity(await embedSynthetic(instance, reference), result))
          }
          report('repeat', {
            backend,
            quant,
            input: reference.name,
            comparisons,
            againstPytorch: similarity(result, floats(reference.reference)),
            sample: Array.from(result.slice(0, 16)),
            stats: instance.getRuntimeStats()
          })
        }
      } finally {
        await instance.destroy()
      }
      for (let i = 0; i < 2; i++) {
        const cold = model(quant, backend)
        try {
          await cold.load()
          const result = await embedSynthetic(cold, synthetic.cases[2])
          valid(t, result)
          report('cold_reload', { backend, quant, iteration: i, ...similarity(result, first[2]) })
        } finally {
          await cold.destroy()
        }
      }
    }
  }
})

test('Diagnostic: operation-specific CPU interventions', async function (t) {
  t.timeout(15 * 60 * 1000)
  const backend = available.includes('DIAG_OPENCL') ? 'DIAG_OPENCL' : available[1]
  for (const operation of [
    '',
    'NORM',
    'GELU_ERF',
    'SOFT_MAX',
    'MUL_MAT',
    'EXP',
    'SUM_ROWS',
    'DIV,SQRT'
  ]) {
    cleanEnv()
    env.QVAC_MEGALOC_CPU_OPS = operation
    const instance = model('f16', backend)
    try {
      await instance.load()
      const result = await embedSynthetic(instance, synthetic.cases[2])
      valid(t, result)
      report('intervention', {
        backend,
        operation,
        againstPytorch: similarity(result, floats(synthetic.cases[2].reference)),
        stats: instance.getRuntimeStats()
      })
    } finally {
      await instance.destroy()
    }
  }
  cleanEnv()
})

function dot(a, b) {
  let value = 0
  for (let i = 0; i < D; i++) value += a[i] * b[i]
  return value
}

function retrieval(rows, descriptors, galleryDescriptors) {
  const screens = [
    ['gardens', 'day_right', 'day_left'],
    ['gardens', 'night_right', 'day_left'],
    ['hotels', 'test_non_object', 'gallery'],
    ['hotels', 'test_object', 'gallery']
  ]
  return screens.map(([dataset, split, gallerySplit]) => {
    const gallery = rows.filter((row) => row.dataset === dataset && row.split === gallerySplit)
    const queries = rows.filter((row) => row.dataset === dataset && row.split === split)
    const hits = [0, 0, 0]
    const top1 = []
    let ap = 0
    for (const query of queries) {
      const ranked = gallery.map((row) => ({
        row,
        score: dot(descriptors[query.id], galleryDescriptors[row.id])
      }))
      ranked.sort((a, b) => b.score - a.score || a.row.id - b.row.id)
      top1.push(ranked[0].row.id)
      let found = 0
      let total = 0
      let precision = 0
      for (let rank = 0; rank < ranked.length; rank++) {
        const row = ranked[rank].row
        const positive =
          dataset === 'gardens'
            ? Math.abs(query.frame - row.frame) <= 2
            : query.hotel_id === row.hotel_id
        if (!positive) continue
        total++
        found++
        precision += found / (rank + 1)
        for (let k = 0; k < hits.length; k++) {
          if (found === 1 && rank < [1, 5, 10][k]) hits[k]++
        }
      }
      if (total === 0) throw new Error('Query has no positive gallery item: ' + query.id)
      ap += precision / total
    }
    return {
      dataset,
      split,
      queries: queries.length,
      gallery: gallery.length,
      recall1: hits[0] / queries.length,
      recall5: hits[1] / queries.length,
      recall10: hits[2] / queries.length,
      map: ap / queries.length,
      top1
    }
  })
}

test('Diagnostic: labeled retrieval quality against original PyTorch FP32', async function (t) {
  t.timeout(25 * 60 * 1000)
  cleanEnv()
  const prepared = JSON.parse(fs.readFileSync(asset('megaloc-diag-manifest.bin'), 'utf8'))
  const rows = prepared.records
  t.is(rows.length, source.records.length)
  report('input_provenance', {
    preparation: prepared.input_preparation,
    torchVersion: prepared.torch_version,
    referenceSha256: prepared.reference_sha256,
    checkpointSha256: prepared.checkpoint_sha256
  })
  const raw = floats('megaloc-diag-pytorch-f32.bin')
  t.is(raw.length, rows.length * D)
  const references = rows.map((row) => raw.subarray(row.id * D, (row.id + 1) * D))
  report('pytorch_reference', {
    images: rows.length,
    screens: retrieval(rows, references, references)
  })
  const qualityBackend = available.includes('DIAG_OPENCL') ? 'DIAG_OPENCL' : available[1]
  for (const quant of ['f16', 'mixed']) {
    const instance = model(quant, qualityBackend)
    const outputs = []
    const metrics = []
    const times = []
    try {
      await instance.load()
      for (const row of rows) {
        const result = await instance.embed(fs.readFileSync(asset(row.asset)))
        if (result.length !== D || !result.every(Number.isFinite)) {
          throw new Error('Invalid descriptor: ' + row.id)
        }
        outputs.push(result)
        metrics.push(similarity(result, references[row.id]))
        times.push(instance.getRuntimeStats().total_time_ms)
        if (row.id % 50 === 0) {
          report('quality_progress', { backend: qualityBackend, quant, completed: row.id + 1 })
        }
      }
      report('quality', {
        backend: qualityBackend,
        quant,
        images: rows.length,
        numerical: metrics,
        timesMs: times,
        screens: retrieval(rows, outputs, outputs),
        originalGalleryScreens: retrieval(rows, outputs, references),
        stats: instance.getRuntimeStats()
      })
    } finally {
      await instance.destroy()
    }
  }
  for (const backend of available.filter((name) => name !== qualityBackend)) {
    const instance = model('f16', backend)
    const checks = []
    try {
      await instance.load()
      for (let i = 0; i < rows.length; i += 27) {
        const row = rows[i]
        const result = await instance.embed(fs.readFileSync(asset(row.asset)))
        checks.push({
          id: row.id,
          ...similarity(result, references[row.id]),
          stats: instance.getRuntimeStats()
        })
      }
      report('control_real_images', { backend, quant: 'f16', checks })
    } finally {
      await instance.destroy()
    }
  }
  cleanEnv()
  t.pass('Both GGUF formats completed the labeled quality screen')
})
