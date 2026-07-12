import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number | null): string {
  if (!price) return '—'
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  }).format(price)
}

export function formatTime(minutes: number | null): string {
  if (!minutes) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} godz. ${m} min` : `${h} godz.`
}

export function difficultyLabel(d: string | null): string {
  const map: Record<string, string> = {
    latwy: 'Łatwy',
    sredni: 'Średni',
    trudny: 'Trudny',
  }
  return d ? (map[d] ?? d) : '—'
}

export function difficultyColor(d: string | null): string {
  const map: Record<string, string> = {
    latwy: 'text-green-600 bg-green-50',
    sredni: 'text-amber-600 bg-amber-50',
    trudny: 'text-red-600 bg-red-50',
  }
  return d ? (map[d] ?? '') : ''
}

export function isPromoActive(validFrom: string, validTo: string): boolean {
  const now = new Date()
  return new Date(validFrom) <= now && new Date(validTo) >= now
}

// Skaluje ilość składnika (best-effort). Obsługuje liczby ("200", "1,5") i ułamki ("1/2").
// Tekst nieliczbowy ("szczypta") zostaje bez zmian.
export function scaleAmount(amount: string | null, factor: number): string | null {
  if (!amount || factor === 1) return amount
  const raw = amount.trim().replace(',', '.')

  let value: number | null = null
  const frac = raw.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (frac) {
    const denom = parseInt(frac[2], 10)
    value = denom !== 0 ? parseInt(frac[1], 10) / denom : null
  } else if (/^\d*\.?\d+$/.test(raw)) {
    value = parseFloat(raw)
  }

  if (value == null || !isFinite(value)) return amount

  const scaled = Math.round(value * factor * 100) / 100
  return String(scaled).replace('.', ',')
}
