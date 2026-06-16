'use strict'

const { findSecretRefs } = require('../src/secrets')

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
