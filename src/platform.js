'use strict'

const VALID_PLATFORMS = [
  'linux-x86_64',
  'linux-aarch64',
  'macos-x86_64',
  'macos-aarch64',
  'windows-x86_64',
]

function detectPlatform() {
  const os = process.platform
  const arch = process.arch

  if (os === 'linux' && arch === 'x64') return 'linux-x86_64'
  if (os === 'linux' && arch === 'arm64') return 'linux-aarch64'
  if (os === 'darwin' && arch === 'x64') return 'macos-x86_64'
  if (os === 'darwin' && arch === 'arm64') return 'macos-aarch64'
  if (os === 'win32' && arch === 'x64') return 'windows-x86_64'

  throw new Error(`Unsupported platform/architecture: ${os}/${arch}`)
}

function resolvePlatform(input) {
  if (!input || !input.trim()) return detectPlatform()
  const platform = input.trim()
  if (!VALID_PLATFORMS.includes(platform)) {
    throw new Error(`Invalid platform "${platform}". Valid values: ${VALID_PLATFORMS.join(', ')}`)
  }
  return platform
}

module.exports = { detectPlatform, resolvePlatform, VALID_PLATFORMS }
