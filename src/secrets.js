'use strict'

const { execFileSync } = require('child_process')
const { mkdtempSync, mkdirSync, chmodSync, lstatSync } = require('fs')
const os = require('os')
const path = require('path')

const PASS_PREFIX = 'pass://'

function setupSession(core) {
  let sessionDir = process.env.PROTON_PASS_SESSION_DIR
  if (sessionDir) {
    // Reject symlinks: a malicious prior step could point this at a path it controls.
    let stat
    try {
      stat = lstatSync(sessionDir)
    } catch {
      // Dir does not exist yet — that is fine, we will create it below.
      stat = null
    }
    if (stat && stat.isSymbolicLink()) {
      throw new Error(
        `PROTON_PASS_SESSION_DIR is a symbolic link, refusing to use it: ${sessionDir}`,
      )
    }
    mkdirSync(sessionDir, { recursive: true, mode: 0o700 })
    // mkdirSync does not change permissions of an already-existing directory;
    // explicitly restrict the existing dir to owner-only.
    chmodSync(sessionDir, 0o700)
    core.info(`Reusing session dir: ${sessionDir}`)
  } else {
    const base = process.env.RUNNER_TEMP || os.tmpdir()
    // mkdtempSync always creates at 0700.
    sessionDir = mkdtempSync(path.join(base, 'proton-pass-session-'))
    core.info(`Session dir: ${sessionDir}`)
  }
  process.env.PROTON_PASS_SESSION_DIR = sessionDir
  core.exportVariable('PROTON_PASS_SESSION_DIR', sessionDir)
  process.env.PROTON_PASS_KEY_PROVIDER = 'fs'
  core.exportVariable('PROTON_PASS_KEY_PROVIDER', 'fs')
}

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

// Calls `pass-cli item view -- <uri>` and returns the trimmed stdout.
// The `--` terminator prevents a crafted URI from being parsed as a flag.
// Stderr is captured but not forwarded to avoid leaking sensitive data in logs.
function fetchSecret(uri) {
  try {
    return execFileSync('pass-cli', ['item', 'view', '--', uri], {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim()
  } catch (err) {
    const code = err.status !== undefined ? err.status : 'unknown'
    throw new Error(`pass-cli exited with code ${code} while reading ${uri}`)
  }
}

module.exports = { setupSession, findSecretRefs, isSessionValid, login, fetchSecret }
