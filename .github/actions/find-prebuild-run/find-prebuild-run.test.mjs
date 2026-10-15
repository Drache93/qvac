import test from 'node:test'
import assert from 'node:assert/strict'

import { findRun, hasBoth } from './find-prebuild-run.mjs'

const art = (name, expired = false) => ({ name, expired })

test('a run matches only with both the marker and the prebuilds, unexpired', () => {
  assert.equal(hasBoth([art('m'), art('prebuilds-x')], 'm', 'prebuilds-x'), true)
  assert.equal(hasBoth([art('m')], 'm', 'prebuilds-x'), false)
  assert.equal(hasBoth([art('m'), art('prebuilds-x', true)], 'm', 'prebuilds-x'), false)
  assert.equal(hasBoth(null, 'm', 'prebuilds-x'), false)
})

test('the newest matching earlier run wins, and the current run is skipped', async () => {
  const artifacts = { 3: [art('m'), art('p')], 2: [art('m'), art('p')], 1: [art('p')] }
  const listArtifacts = async (id) => artifacts[id]
  const runs = [{ id: 3 }, { id: 2 }, { id: 1 }]
  assert.equal(await findRun({ runs, currentRunId: 3, listArtifacts, marker: 'm', artifactName: 'p' }), '2')
  assert.equal(await findRun({ runs: [{ id: 1 }], currentRunId: 9, listArtifacts, marker: 'm', artifactName: 'p' }), '')
  assert.equal(await findRun({ runs: null, currentRunId: 9, listArtifacts, marker: 'm', artifactName: 'p' }), '')
})
