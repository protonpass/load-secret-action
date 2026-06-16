'use strict'

const { execFileSync } = require('child_process')

const PASS_PREFIX = 'pass://'

function findSecretRefs(env) {
  return Object.entries(env)
    .filter(([, value]) => typeof value === 'string' && value.startsWith(PASS_PREFIX))
    .map(([key, uri]) => ({ key, uri }))
}

// Calls `pass-cli read <uri>` and returns the trimmed stdout.
// Stderr is captured but not forwarded to avoid leaking sensitive data in logs.
function fetchSecret(uri) {
  try {
    return execFileSync('pass-cli', ['read', uri], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch (err) {
    const code = err.status !== undefined ? err.status : 'unknown'
    throw new Error(`pass-cli exited with code ${code} while reading ${uri}`)
  }
}

module.exports = { findSecretRefs, fetchSecret }
