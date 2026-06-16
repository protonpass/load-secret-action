'use strict'

const https = require('https')
const { createHash } = require('crypto')
const { readFileSync } = require('fs')

const RELEASES_API = 'https://api.github.com/repos/protonpass/pass-cli/releases/latest'
const RELEASES_BASE = 'https://github.com/protonpass/pass-cli/releases/download'

async function resolveVersion(version) {
  if (version && version !== 'latest') return version
  return fetchLatestVersion()
}

function fetchLatestVersion() {
  return new Promise((resolve, reject) => {
    https
      .get(
        RELEASES_API,
        {
          headers: {
            'User-Agent': 'load-secret-action',
            Accept: 'application/vnd.github.v3+json',
          },
        },
        res => {
          if (res.statusCode !== 200) {
            res.resume()
            return reject(new Error(`GitHub API returned HTTP ${res.statusCode}`))
          }
          let body = ''
          res.on('data', chunk => (body += chunk))
          res.on('end', () => {
            try {
              const { tag_name } = JSON.parse(body)
              if (!tag_name) throw new Error('Missing tag_name in release response')
              resolve(tag_name.replace(/^v/, ''))
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
    throw new Error(`SHA256 mismatch!\n  expected: ${expected}\n  actual:   ${actual}`)
  }
}

async function fetchRemoteChecksum(url, downloadTool) {
  const file = await downloadTool(url)
  const content = readFileSync(file, 'utf8').trim()
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
