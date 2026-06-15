import { describe, it, expect } from 'vitest'
import { parsePeriod, prevPeriod, nextPeriod, periodParam, formatPeriodLabel } from '../period'

describe('parsePeriod', () => {
  it('returns correct start/end for June', () => {
    const { start, end } = parsePeriod('2026-06')
    expect(start).toBe('2026-06-01')
    expect(end).toBe('2026-06-30')
  })

  it('returns 31-day end for January', () => {
    expect(parsePeriod('2026-01').end).toBe('2026-01-31')
  })

  it('returns 28-day end for Feb non-leap', () => {
    expect(parsePeriod('2026-02').end).toBe('2026-02-28')
  })

  it('returns 29-day end for Feb leap year', () => {
    expect(parsePeriod('2024-02').end).toBe('2024-02-29')
  })

  it('falls back to current period for undefined', () => {
    const { start } = parsePeriod(undefined)
    expect(start).toMatch(/^\d{4}-\d{2}-01$/)
  })

  it('falls back for invalid format', () => {
    const { start } = parsePeriod('not-a-period')
    expect(start).toMatch(/^\d{4}-\d{2}-01$/)
  })
})

describe('prevPeriod', () => {
  it('returns previous month param', () => {
    expect(prevPeriod('2026-06-01')).toBe('2026-05')
  })

  it('wraps year correctly', () => {
    expect(prevPeriod('2026-01-01')).toBe('2025-12')
  })
})

describe('nextPeriod', () => {
  it('returns next month param', () => {
    expect(nextPeriod('2026-06-01')).toBe('2026-07')
  })

  it('wraps year correctly', () => {
    expect(nextPeriod('2026-12-01')).toBe('2027-01')
  })
})

describe('periodParam', () => {
  it('extracts YYYY-MM', () => {
    expect(periodParam('2026-06-01')).toBe('2026-06')
  })
})

describe('formatPeriodLabel', () => {
  it('returns non-empty string for he locale', () => {
    expect(formatPeriodLabel('2026-06-01', 'he')).toBeTruthy()
  })

  it('returns non-empty string for en locale', () => {
    expect(formatPeriodLabel('2026-06-01', 'en')).toBeTruthy()
  })
})
