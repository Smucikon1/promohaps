import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { znajdzGazetki, obslugiwaneSklepy } from '@/lib/leafletSources'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Lista aktualnych gazetek danej sieci, prosto z jej własnej strony.
 *
 * Zwraca też, które wydania są już wciągnięte — po adresie strony wydania, bo tytuły
 * się powtarzają („Codziennie niskie ceny" wychodzi co tydzień pod tą samą nazwą),
 * a adres zawiera identyfikator konkretnego wydania.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const storeSlug = String(body?.storeSlug ?? '').trim()

  if (!obslugiwaneSklepy().includes(storeSlug)) {
    return NextResponse.json(
      {
        error: `Automatyczne wykrywanie działa na razie tylko dla: ${obslugiwaneSklepy().join(', ')}. Dla pozostałych sieci wklej adres pliku ręcznie.`,
      },
      { status: 400 }
    )
  }

  try {
    const gazetki = await znajdzGazetki(storeSlug, 6)

    // Które wydania już wciągnęliśmy — sprawdzamy po źródłowym adresie
    const { data: sklep } = await supabase.from('stores').select('id').eq('slug', storeSlug).maybeSingle()
    // Kolumna source_url jest opcjonalna — bez niej po prostu nie oznaczamy wydań
    // jako wciągniętych. Feature ma działać także zanim ktokolwiek ruszy schemat bazy:
    //   alter table promo_products add column if not exists source_url text;
    let znane = new Set<string>()
    if (sklep) {
      const { data: promo, error } = await supabase
        .from('promo_products')
        .select('source_url')
        .eq('store_id', sklep.id)
        .not('source_url', 'is', null)
        .limit(500)
      if (!error) znane = new Set((promo ?? []).map((p: any) => p.source_url).filter(Boolean))
    }

    return NextResponse.json({
      gazetki: gazetki.map((g) => ({ ...g, wciagnieta: znane.has(g.strona) })),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Nie udało się odczytać listy gazetek: ${e?.message ?? 'nieznany błąd'}` },
      { status: 502 }
    )
  }
}
