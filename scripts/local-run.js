#!/usr/bin/env node
/**
 * Simulates the GitHub Actions environment locally so you can run the action
 * without a real runner.
 *
 * Usage:
 *   PROTON_PASS_PERSONAL_ACCESS_TOKEN=<pat> \
 *   MY_SECRET=pass://MyVault/MyItem/MyField \
 *   node scripts/local-run.js
 *
 *   node scripts/local-run.js --version 2.1.4 --export-env true
 *
 * Set secret refs as env vars (pass:// prefix) before running.
 * The resolved values will be printed to stdout after the run.
 */

'use strict'

const { writeFileSync, readFileSync, mkdtempSync } = require('fs')
const os = require('os')
const path = require('path')

// parse CLI args
const args = process.argv.slice(2)
function getArg(name) {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 ? args[idx + 1] : undefined
}

const version = getArg('version') || process.env.INPUT_VERSION || 'latest'
const hash = getArg('hash') || process.env.INPUT_HASH || ''
const platform = getArg('platform') || process.env.INPUT_PLATFORM || ''
const exportEnv = getArg('export-env') || process.env.INPUT_EXPORT_ENV || 'false'

if (!process.env.PROTON_PASS_PERSONAL_ACCESS_TOKEN) {
  console.error('ERROR: PROTON_PASS_PERSONAL_ACCESS_TOKEN env var is required')
  process.exit(1)
}

// create temp files that @actions/core writes into
const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'load-secret-local-'))
const outputFile = path.join(tmpDir, 'github_output')
const pathFile = path.join(tmpDir, 'github_path')
const envFile = path.join(tmpDir, 'github_env')

writeFileSync(outputFile, '')
writeFileSync(pathFile, '')
writeFileSync(envFile, '')

// set env vars that @actions/core expects
process.env.INPUT_VERSION = version
process.env.INPUT_HASH = hash
process.env.INPUT_PLATFORM = platform
process.env['INPUT_EXPORT-ENV'] = exportEnv
process.env.GITHUB_OUTPUT = outputFile
process.env.GITHUB_PATH = pathFile
process.env.GITHUB_ENV = envFile
process.env.RUNNER_TEMP = tmpDir

// Show which secret refs were found
const secretRefs = Object.entries(process.env)
  .filter(([, v]) => typeof v === 'string' && v.startsWith('pass://'))
  .map(([k]) => k)

console.log('=== load-secret local run ===')
console.log(`  version:    ${version}`)
console.log(`  platform:   ${platform || '(auto-detect)'}`)
console.log(`  export-env: ${exportEnv}`)
console.log(`  secret refs found: ${secretRefs.length > 0 ? secretRefs.join(', ') : '(none)'}`)
console.log(`  tmp dir: ${tmpDir}`)
console.log('')

// run the action
require('../src/index')

// Print results once the action's async work has completed and the event loop is idle.
process.on('beforeExit', () => {
  const outputs = readFileSync(outputFile, 'utf8').trim()
  if (outputs) {
    console.log('\n=== Step outputs (values masked) ===')
    outputs.split('\n').forEach(line => {
      const [key] = line.split('=')
      if (key) console.log(`  ${key}=***`)
    })
  }

  const envExports = readFileSync(envFile, 'utf8').trim()
  if (envExports) {
    console.log('\n=== Exported env vars (values masked) ===')
    envExports.split('\n').forEach(line => {
      const [key] = line.split('=')
      if (key) console.log(`  ${key}=***`)
    })
  }
})
