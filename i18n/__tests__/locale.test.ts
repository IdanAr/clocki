// i18n/__tests__/locale.test.ts
import { describe, it, expect } from 'vitest'

function resolveLocale(cookieValue: string | undefined): string {
  const locale = cookieValue ?? 'he'
  return ['he', 'en'].includes(locale) ? locale : 'he'
}

describe('locale resolution', () => {
  it('defaults to Hebrew when no cookie', () => {
    expect(resolveLocale(undefined)).toBe('he')
  })

  it('respects Hebrew cookie', () => {
    expect(resolveLocale('he')).toBe('he')
  })

  it('respects English cookie', () => {
    expect(resolveLocale('en')).toBe('en')
  })

  it('falls back to Hebrew for unknown locale', () => {
    expect(resolveLocale('fr')).toBe('he')
  })
})
