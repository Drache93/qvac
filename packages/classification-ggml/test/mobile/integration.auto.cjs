'use strict'
require('./integration-runtime.cjs')

/* global runIntegrationModule */

async function runAaaMegalocDiagnostics (options = {}) { // eslint-disable-line no-unused-vars
  return runIntegrationModule('../integration/aaa-megaloc-diagnostics.test.js', options)
}

async function runClassify (options = {}) { // eslint-disable-line no-unused-vars
  return runIntegrationModule('../integration/classify.test.js', options)
}

async function runErrorCases (options = {}) { // eslint-disable-line no-unused-vars
  return runIntegrationModule('../integration/error-cases.test.js', options)
}

async function runMegaloc (options = {}) { // eslint-disable-line no-unused-vars
  return runIntegrationModule('../integration/megaloc.test.js', options)
}

async function runZzzMegalocUploadCrash (options = {}) { // eslint-disable-line no-unused-vars
  return runIntegrationModule('../integration/zzz-megaloc-upload-crash.test.js', options)
}
