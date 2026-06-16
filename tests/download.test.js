'use strict'

const {
  resolveVersion,
  downloadUrl,
  checksumUrl,
  assetName,
  verifyHash,
} = require('../src/download')
const { createHash } = require('crypto')
const { writeFileSync, unlinkSync } = require('fs')
const os = require('os')
const path = require('path')

describe('assetName', () => {
  test('returns .zip for windows', () => {
    expect(assetName('windows-x86_64')).toBe('pass-cli-windows-x86_64.zip')
  })

  test('returns plain binary for linux x86_64', () => {
    expect(assetName('linux-x86_64')).toBe('pass-cli-linux-x86_64')
  })

  test('returns plain binary for macos aarch64', () => {
    expect(assetName('macos-aarch64')).toBe('pass-cli-macos-aarch64')
  })
})

describe('downloadUrl', () => {
  test('builds correct URL for linux', () => {
    expect(downloadUrl('2.1.4', 'linux-x86_64')).toBe(
      'https://github.com/protonpass/pass-cli/releases/download/2.1.4/pass-cli-linux-x86_64',
    )
  })

  test('builds correct URL for windows (zip)', () => {
    expect(downloadUrl('2.1.4', 'windows-x86_64')).toBe(
      'https://github.com/protonpass/pass-cli/releases/download/2.1.4/pass-cli-windows-x86_64.zip',
    )
  })
})

describe('checksumUrl', () => {
  test('appends .sha256 to the download URL', () => {
    expect(checksumUrl('2.1.4', 'linux-x86_64')).toBe(
      'https://github.com/protonpass/pass-cli/releases/download/2.1.4/pass-cli-linux-x86_64.sha256',
    )
  })

  test('appends .sha256 after .zip for windows', () => {
    expect(checksumUrl('2.1.4', 'windows-x86_64')).toBe(
      'https://github.com/protonpass/pass-cli/releases/download/2.1.4/pass-cli-windows-x86_64.zip.sha256',
    )
  })
})

describe('resolveVersion', () => {
  test('returns version string as-is for valid semver', async () => {
    await expect(resolveVersion('2.1.4')).resolves.toBe('2.1.4')
  })

  test('rejects version strings with path traversal characters', async () => {
    await expect(resolveVersion('../../etc/passwd')).rejects.toThrow('Invalid version string')
  })

  test('rejects version strings with special characters', async () => {
    await expect(resolveVersion('2.1.4; cat /etc/passwd')).rejects.toThrow('Invalid version string')
  })

  test('rejects pre-release version strings with non-numeric suffixes', async () => {
    await expect(resolveVersion('2.0.0-beta.1')).rejects.toThrow('Invalid version string')
  })
})

describe('verifyHash', () => {
  let tmpFile

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `pass-cli-test-${Date.now()}.bin`)
    writeFileSync(tmpFile, 'fake binary content')
  })

  afterEach(() => {
    try {
      unlinkSync(tmpFile)
    } catch {
      /* ignore */
    }
  })

  test('resolves when hash matches', async () => {
    const hash = createHash('sha256').update('fake binary content').digest('hex')
    await expect(verifyHash(tmpFile, hash)).resolves.toBeUndefined()
  })

  test('rejects when hash does not match', async () => {
    await expect(verifyHash(tmpFile, 'deadbeef')).rejects.toThrow('SHA256 mismatch')
  })

  test('error message does not include actual hash of the binary', async () => {
    const actual = createHash('sha256').update('fake binary content').digest('hex')
    let msg = ''
    try {
      await verifyHash(tmpFile, 'deadbeef')
    } catch (e) {
      msg = e.message
    }
    expect(msg).not.toContain(actual)
  })

  test('comparison is case-insensitive', async () => {
    const hash = createHash('sha256').update('fake binary content').digest('hex').toUpperCase()
    await expect(verifyHash(tmpFile, hash)).resolves.toBeUndefined()
  })
})
