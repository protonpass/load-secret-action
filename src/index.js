'use strict'

const core = require('@actions/core')
const toolCache = require('@actions/tool-cache')
const { execFileSync } = require('child_process')

const { resolvePlatform } = require('./platform')
const {
  resolveVersion,
  downloadUrl,
  checksumUrl,
  verifyHash,
  fetchRemoteChecksum,
} = require('./download')
const { installBinary } = require('./install')
const { setupSession, findSecretRefs, isSessionValid, login, fetchSecret } = require('./secrets')

function isPassCliInstalled() {
  try {
    execFileSync('pass-cli', ['--version'], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

async function run() {
  try {
    // inputs
    const versionInput = core.getInput('version') || 'latest'
    const hashInput = core.getInput('hash') || ''
    const platformInput = core.getInput('platform') || ''
    const exportEnv = core.getInput('export-env') === 'true'

    const pat = process.env.PROTON_PASS_PERSONAL_ACCESS_TOKEN
    if (!pat) {
      throw new Error('PROTON_PASS_PERSONAL_ACCESS_TOKEN environment variable is required')
    }
    core.setSecret(pat)

    // install pass-cli (skip if already in PATH)
    if (isPassCliInstalled()) {
      core.info('pass-cli already in PATH, skipping install')
    } else {
      const platform = resolvePlatform(platformInput)
      core.info(`Platform: ${platform}`)

      const version = await resolveVersion(versionInput)
      core.info(`Version: ${version}`)

      const url = downloadUrl(version, platform)
      core.info(`Downloading: ${url}`)
      const binaryPath = await toolCache.downloadTool(url)

      let expectedHash
      if (hashInput.trim()) {
        expectedHash = hashInput.trim()
        core.info('Using provided hash for verification')
      } else {
        const csUrl = checksumUrl(version, platform)
        core.info(`Fetching checksum: ${csUrl}`)
        expectedHash = await fetchRemoteChecksum(csUrl, u => toolCache.downloadTool(u))
      }

      core.info('Verifying SHA256...')
      await verifyHash(binaryPath, expectedHash)
      core.info('Hash OK')

      await installBinary({ binaryPath, platform, version, toolCache, core })
    }

    setupSession(core)

    // authenticate (skip if session already active from a prior step in this job)
    if (isSessionValid()) {
      core.info('pass-cli session already active, skipping login')
    } else {
      core.info('Logging in to Proton Pass...')
      login(pat)
      core.info('Login successful')
    }

    // resolve secrets
    const refs = findSecretRefs(process.env)

    if (refs.length === 0) {
      core.warning('No pass:// URIs found in environment variables. Nothing to load.')
      return
    }

    core.info(`Found ${refs.length} secret reference(s)`)

    for (const { key, uri } of refs) {
      core.info(`Fetching: ${key}`)
      const value = fetchSecret(uri)

      core.setSecret(value) // mask in all subsequent log lines
      core.setOutput(key, value) // always expose as step output

      if (exportEnv) {
        core.exportVariable(key, value) // also propagate to subsequent steps as env var
      }
    }

    core.info('All secrets loaded successfully')
  } catch (err) {
    core.setFailed(err.message)
  }
}

run()
