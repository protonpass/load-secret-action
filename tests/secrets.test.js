'use strict'

jest.mock('child_process')

const { execFileSync } = require('child_process')
const { findSecretRefs, isSessionValid, login } = require('../src/secrets')

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
