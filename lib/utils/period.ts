// lib/utils/period.ts

export function getCurrentPeriod(): { start: string; end: string } {
  const now = new Date()
  return monthBounds(now.getFullYear(), now.getMonth() + 1)
}

export function parsePeriod(param: string | undefined): { start: string; end: string } {
  if (!param || !/^\d{4}-\d{2}$/.test(param)) return getCurrentPeriod()
  const [year, month] = param.split('-').map(Number)
  return monthBounds(year, month)
}

export function prevPeriod(periodStart: string): string {
  const d = new Date(periodStart + 'T00:00:00')
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function nextPeriod(periodStart: string): string {
  const d = new Date(periodStart + 'T00:00:00')
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function periodParam(periodStart: string): string {
  return periodStart.slice(0, 7)
}

export function formatPeriodLabel(periodStart: string, locale: string): string {
  return new Date(periodStart + 'T00:00:00').toLocaleDateString(
    locale === 'he' ? 'he-IL' : 'en-US',
    { year: 'numeric', month: 'long' }
  )
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthBounds(year: number, month: number): { start: string; end: string } {
  return {
    start: fmt(new Date(year, month - 1, 1)),
    end: fmt(new Date(year, month, 0)),
  }
}
