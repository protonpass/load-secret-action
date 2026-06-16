'use strict'

const { execFileSync } = require('child_process')

const PASS_PREFIX = 'pass://'

function findSecretRefs(env) {
  return Object.entries(env)
    .filter(([, value]) => typeof value === 'string' && value.startsWith(PASS_PREFIX))
    .map(([key, uri]) => ({ key, uri }))
}

function isSessionValid() {
  try {
    execFileSync('pass-cli', ['info'], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function login(pat) {
  try {
    execFileSync('pass-cli', ['login'], {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, PROTON_PASS_PERSONAL_ACCESS_TOKEN: pat },
    })
  } catch (err) {
    const code = err.status !== undefined ? err.status : 'unknown'
    throw new Error(`pass-cli login failed with exit code ${code}`)
  }
}

// Calls `pass-cli item view <uri>` and returns the trimmed stdout.
// Stderr is captured but not forwarded to avoid leaking sensitive data in logs.
function fetchSecret(uri) {
  try {
    return execFileSync('pass-cli', ['item', 'view', uri], {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim()
  } catch (err) {
    const code = err.status !== undefined ? err.status : 'unknown'
    throw new Error(`pass-cli exited with code ${code} while reading ${uri}`)
  }
}

module.exports = { findSecretRefs, isSessionValid, login, fetchSecret }
