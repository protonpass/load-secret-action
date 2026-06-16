'use strict'

jest.mock('child_process')

const os = require('os')
const { execFileSync } = require('child_process')
const { setupSession, findSecretRefs, isSessionValid, login } = require('../src/secrets')

describe('setupSession', () => {
  let savedEnv

  beforeEach(() => {
    savedEnv = {
      PROTON_PASS_SESSION_DIR: process.env.PROTON_PASS_SESSION_DIR,
      PROTON_PASS_KEY_PROVIDER: process.env.PROTON_PASS_KEY_PROVIDER,
      RUNNER_TEMP: process.env.RUNNER_TEMP,
    }
    delete process.env.PROTON_PASS_SESSION_DIR
    delete process.env.PROTON_PASS_KEY_PROVIDER
    delete process.env.RUNNER_TEMP
  })

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key]
      else process.env[key] = val
    }
  })

  const makeCore = () => ({ info: jest.fn(), exportVariable: jest.fn() })

  test('creates a session dir when PROTON_PASS_SESSION_DIR is not set', () => {
    const core = makeCore()
    setupSession(core)
    expect(process.env.PROTON_PASS_SESSION_DIR).toMatch(/proton-pass-session-/)
    expect(core.exportVariable).toHaveBeenCalledWith(
      'PROTON_PASS_SESSION_DIR',
      process.env.PROTON_PASS_SESSION_DIR,
    )
  })

  test('reuses existing PROTON_PASS_SESSION_DIR', () => {
    process.env.PROTON_PASS_SESSION_DIR = os.tmpdir()
    const core = makeCore()
    setupSession(core)
    expect(process.env.PROTON_PASS_SESSION_DIR).toBe(os.tmpdir())
    expect(core.exportVariable).toHaveBeenCalledWith('PROTON_PASS_SESSION_DIR', os.tmpdir())
  })

  test('always sets PROTON_PASS_KEY_PROVIDER to fs', () => {
    const core = makeCore()
    setupSession(core)
    expect(process.env.PROTON_PASS_KEY_PROVIDER).toBe('fs')
    expect(core.exportVariable).toHaveBeenCalledWith('PROTON_PASS_KEY_PROVIDER', 'fs')
  })

  test('uses RUNNER_TEMP as base when set', () => {
    process.env.RUNNER_TEMP = os.tmpdir()
    const core = makeCore()
    setupSession(core)
    expect(process.env.PROTON_PASS_SESSION_DIR).toMatch(
      new RegExp(`^${os.tmpdir().replace(/[/\\]/g, '[/\\\\]')}`),
    )
  })
})

describe('findSecretRefs', () => {
  test('finds all pass:// values', () => {
    const refs = findSecretRefs({
      MY_SECRET: 'pass://MyVault/MyItem/MyField',
      ANOTHER: 'pass://VaultA/ItemB/FieldC',
      REGULAR: 'some-regular-value',
      EMPTY: '',
      NUMERIC_LIKE: '12345',
    })
    expect(refs).toHaveLength(2)
    expect(refs).toContainEqual({ key: 'MY_SECRET', uri: 'pass://MyVault/MyItem/MyField' })
    expect(refs).toContainEqual({ key: 'ANOTHER', uri: 'pass://VaultA/ItemB/FieldC' })
  })

  test('returns empty array when no pass:// refs present', () => {
    expect(findSecretRefs({ FOO: 'bar', BAZ: 'qux' })).toHaveLength(0)
  })

  test('returns empty array for empty env object', () => {
    expect(findSecretRefs({})).toHaveLength(0)
  })

  test('skips undefined values without throwing', () => {
    const refs = findSecretRefs({ A: undefined, B: 'pass://v/i/f' })
    expect(refs).toHaveLength(1)
    expect(refs[0].key).toBe('B')
  })

  test('does not match values with pass:// not at start', () => {
    expect(
      findSecretRefs({
        A: 'not-pass://foo',
        B: ' pass://foo',
        C: 'prefix/pass://foo',
      }),
    ).toHaveLength(0)
  })

  test('handles a single secret ref', () => {
    const refs = findSecretRefs({ TOKEN: 'pass://Vault/Item/password' })
    expect(refs).toEqual([{ key: 'TOKEN', uri: 'pass://Vault/Item/password' }])
  })
})

describe('isSessionValid', () => {
  beforeEach(() => jest.resetAllMocks())

  test('returns true when pass-cli info succeeds', () => {
    execFileSync.mockReturnValue('')
    expect(isSessionValid()).toBe(true)
    expect(execFileSync).toHaveBeenCalledWith('pass-cli', ['info'], { stdio: 'pipe' })
  })

  test('returns false when pass-cli info fails', () => {
    execFileSync.mockImplementation(() => {
      throw new Error('not authenticated')
    })
    expect(isSessionValid()).toBe(false)
  })
})

describe('login', () => {
  beforeEach(() => jest.resetAllMocks())

  test('calls pass-cli login with PAT in environment', () => {
    execFileSync.mockReturnValue('')
    login('my-pat')
    expect(execFileSync).toHaveBeenCalledWith(
      'pass-cli',
      ['login'],
      expect.objectContaining({
        env: expect.objectContaining({ PROTON_PASS_PERSONAL_ACCESS_TOKEN: 'my-pat' }),
      }),
    )
  })

  test('throws with exit code on failure', () => {
    const err = new Error('login failed')
    err.status = 1
    execFileSync.mockImplementation(() => {
      throw err
    })
    expect(() => login('my-pat')).toThrow('pass-cli login failed with exit code 1')
  })

  test('throws with unknown exit code when status is not set', () => {
    execFileSync.mockImplementation(() => {
      throw new Error('login failed')
    })
    expect(() => login('my-pat')).toThrow('pass-cli login failed with exit code unknown')
  })
})
