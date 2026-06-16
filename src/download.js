'use strict'

const https = require('https')
const { createHash } = require('crypto')
const { readFileSync } = require('fs')

const RELEASES_API = 'https://api.github.com/repos/protonpass/pass-cli/releases/latest'
const RELEASES_BASE = 'https://github.com/protonpass/pass-cli/releases/download'

// Semver-like: digits and dots only, no path characters.
const VERSION_RE = /^\d+\.\d+\.\d+$/

function assertValidVersion(version) {
  if (!VERSION_RE.test(version)) {
    throw new Error(`Invalid version string: "${version}"`)
  }
}

async function resolveVersion(version) {
  if (version && version !== 'latest') {
    assertValidVersion(version)
    return version
  }
  return fetchLatestVersion()
}

function fetchLatestVersion() {
  return new Promise((resolve, reject) => {
    https
      .get(
        RELEASES_API,
        {
          headers: {
            'User-Agent': 'install-cli-action',
            Accept: 'application/vnd.github.v3+json',
          },
        },
        res => {
          if (res.statusCode !== 200) {
            res.resume()
            return reject(new Error(`GitHub API returned HTTP ${res.statusCode}`))
          }
          let body = ''
          // Guard against abnormally large responses from a compromised upstream.
          const MAX_BYTES = 1024 * 64
          res.on('data', chunk => {
            body += chunk
            if (body.length > MAX_BYTES) {
              res.destroy()
              reject(new Error('GitHub API response exceeded size limit'))
            }
          })
          res.on('end', () => {
            try {
              const { tag_name } = JSON.parse(body)
              if (!tag_name) throw new Error('Missing tag_name in release response')
              const version = tag_name.replace(/^v/, '')
              assertValidVersion(version)
              resolve(version)
            } catch (e) {
              reject(new Error(`Failed to parse release response: ${e.message}`))
            }
          })
        },
      )
      .on('error', reject)
  })
}

function assetName(platform) {
  return platform === 'windows-x86_64' ? `pass-cli-${platform}.zip` : `pass-cli-${platform}`
}

function downloadUrl(version, platform) {
  return `${RELEASES_BASE}/${version}/${assetName(platform)}`
}

function checksumUrl(version, platform) {
  return `${downloadUrl(version, platform)}.sha256`
}

async function verifyHash(filePath, expected) {
  const data = readFileSync(filePath)
  const actual = createHash('sha256').update(data).digest('hex')
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    // Do not include the actual hash of a potentially tampered binary in the error message.
    throw new Error('SHA256 mismatch: the downloaded binary does not match the expected checksum')
  }
}

async function fetchRemoteChecksum(url, downloadTool) {
  const file = await downloadTool(url)
  const content = readFileSync(file, 'utf8').trim()
  // checksum files are either "<hash>" or "<hash>  <filename>"
  return content.split(/\s+/)[0]
}

module.exports = {
  resolveVersion,
  downloadUrl,
  checksumUrl,
  assetName,
  verifyHash,
  fetchRemoteChecksum,
}
