// Jedno źródło prawdy dla kolorów marek sklepów
export const STORE_COLORS: Record<string, string> = {
  biedronka: '#e3000b',
  lidl: '#0050aa',
  auchan: '#cc0000',
  carrefour: '#004a97',
}

export function storeColor(slug?: string | null): string {
  return STORE_COLORS[slug ?? ''] ?? '#78716c'
}
