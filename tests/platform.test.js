'use strict'

const { detectPlatform, resolvePlatform, VALID_PLATFORMS } = require('../src/platform')

function withProcessValues(platform, arch, fn) {
  const origPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  const origArch = Object.getOwnPropertyDescriptor(process, 'arch')
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
  Object.defineProperty(process, 'arch', { value: arch, configurable: true })
  try {
    return fn()
  } finally {
    Object.defineProperty(process, 'platform', origPlatform)
    Object.defineProperty(process, 'arch', origArch)
  }
}

describe('detectPlatform', () => {
  const cases = [
    ['linux', 'x64', 'linux-x86_64'],
    ['linux', 'arm64', 'linux-aarch64'],
    ['darwin', 'x64', 'macos-x86_64'],
    ['darwin', 'arm64', 'macos-aarch64'],
    ['win32', 'x64', 'windows-x86_64'],
  ]

  test.each(cases)('os=%s arch=%s → %s', (os, arch, expected) => {
    expect(withProcessValues(os, arch, detectPlatform)).toBe(expected)
  })

  test('throws for unsupported os/arch', () => {
    expect(() => withProcessValues('freebsd', 'x64', detectPlatform)).toThrow(
      'Unsupported platform/architecture',
    )
  })
})

describe('resolvePlatform', () => {
  test('returns detected platform when input is empty string', () => {
    expect(VALID_PLATFORMS).toContain(resolvePlatform(''))
  })

  test.each(VALID_PLATFORMS)('accepts valid platform: %s', platform => {
    expect(resolvePlatform(platform)).toBe(platform)
  })

  test('throws for unrecognised platform', () => {
    expect(() => resolvePlatform('linux-mips')).toThrow('Invalid platform')
  })
})
