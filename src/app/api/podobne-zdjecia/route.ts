import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { dishOfTitle, titlesTooSimilar } from '@/lib/popularDishes'

export const runtime = 'nodejs'

/**
 * Zdjęcia z już istniejących przepisów, które pasują do podanego tytułu.
 *
 * Schabowy wygląda jak schabowy — nie ma powodu generować go dziesiąty raz i płacić
 * za to, skoro w katalogu leży gotowe zdjęcie tego samego dania. Adres jest publiczny,
 * więc „użycie" to po prostu wpisanie tego samego image_url; nic nie kopiujemy.
 *
 * Dopasowanie idzie dwiema drogami. Najpierw po ROZPOZNANYM DANIU z listy klasyków —
 * to najpewniejsze, bo „Kotlet schabowy z ziemniakami" i „Schabowy w panierce" to
 * jedno danie mimo różnych słów. Potem po podobieństwie tytułów, które łapie dania
 * spoza listy.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const tytul = String(body?.title ?? '').trim()
  const pomin = String(body?.excludeId ?? '')
  if (tytul.length < 3) return NextResponse.json({ zdjecia: [] })

  const { data, error } = await supabase
    .from('recipes')
    .select('id, title, image_url, created_at')
    .not('image_url', 'is', null)
    .neq('image_url', '')
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const danie = dishOfTitle(tytul)

  const kandydaci = (data ?? [])
    .filter((r: any) => r.id !== pomin && r.image_url)
    .map((r: any) => {
      // 2 = to samo danie z listy klasyków, 1 = podobny tytuł, 0 = nie pasuje
      const inne = dishOfTitle(r.title ?? '')
      if (danie && inne && danie.nazwa === inne.nazwa) return { r, trafnosc: 2 }
      if (titlesTooSimilar(tytul, r.title ?? '')) return { r, trafnosc: 1 }
      return { r, trafnosc: 0 }
    })
    .filter((x) => x.trafnosc > 0)
    .sort((a, b) => b.trafnosc - a.trafnosc)
    .slice(0, 6)

  return NextResponse.json({
    zdjecia: kandydaci.map((x) => ({
      id: x.r.id,
      title: x.r.title,
      imageUrl: x.r.image_url,
      toSamoDanie: x.trafnosc === 2,
    })),
  })
}
