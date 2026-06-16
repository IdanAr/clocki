import { describe, it, expect } from 'vitest'
import { validatePassword } from '../password'

describe('validatePassword', () => {
  it('rejects password shorter than 8 chars', () => {
    const r = validatePassword('Ab1!')
    expect(r.valid).toBe(false)
    expect(r.lengthOk).toBe(false)
  })

  it('rejects password longer than 16 chars', () => {
    const r = validatePassword('Ab1!Ab1!Ab1!Ab1!X')
    expect(r.valid).toBe(false)
    expect(r.lengthOk).toBe(false)
  })

  it('accepts exactly 8 chars with 3 rules met', () => {
    // uppercase + lowercase + number
    expect(validatePassword('Password1').valid).toBe(true)
  })

  it('accepts exactly 16 chars with 3 rules met', () => {
    expect(validatePassword('Password1234567X').valid).toBe(true)
  })

  it('detects uppercase rule', () => {
    expect(validatePassword('password1!').rules.uppercase).toBe(false)
    expect(validatePassword('Password1!').rules.uppercase).toBe(true)
  })

  it('detects lowercase rule', () => {
    expect(validatePassword('PASSWORD1!').rules.lowercase).toBe(false)
    expect(validatePassword('Password1!').rules.lowercase).toBe(true)
  })

  it('detects number rule', () => {
    expect(validatePassword('Password!!').rules.number).toBe(false)
    expect(validatePassword('Password1!').rules.number).toBe(true)
  })

  it('detects special character rule', () => {
    expect(validatePassword('Password12').rules.special).toBe(false)
    expect(validatePassword('Password1!').rules.special).toBe(true)
  })

  it('rejects when only 2 of 4 rules met', () => {
    // lowercase + number only, 8 chars
    const r = validatePassword('password1')
    expect(r.rulesCount).toBe(2)
    expect(r.valid).toBe(false)
  })

  it('accepts when exactly 3 of 4 rules met', () => {
    // uppercase + lowercase + number, no special
    const r = validatePassword('Password12')
    expect(r.rulesCount).toBe(3)
    expect(r.valid).toBe(true)
  })

  it('accepts when all 4 rules met', () => {
    const r = validatePassword('Password1!')
    expect(r.rulesCount).toBe(4)
    expect(r.valid).toBe(true)
  })

  it('returns individual rule booleans correctly', () => {
    const r = validatePassword('Password1!')
    expect(r.rules).toEqual({ uppercase: true, lowercase: true, number: true, special: true })
  })
})
