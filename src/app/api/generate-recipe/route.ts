import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateRecipeJson } from '@/lib/ai'
import { checkLimit } from '@/lib/rateLimit'
import { fetchStoreTitles } from '@/lib/recipeTitles'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 })

  const gate = checkLimit(`gen:${user.id}`, 20, 60 * 60 * 1000)
  if (!gate.ok) return NextResponse.json({ error: 'Za dużo żądań, spróbuj później.' }, { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })
  }

  // Bez tego pojedyncze generowanie w adminie nie sprawdzało powtórek w ogóle
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', body.storeSlug ?? '')
    .maybeSingle()
  const avoidTitles = await fetchStoreTitles(supabase, store?.id)

  try {
    const recipe = await generateRecipeJson({
      storeSlug: body.storeSlug ?? '',
      storeName: body.storeName ?? '',
      theme: (body.theme ?? '').toString().slice(0, 300),
      categorySlugs: Array.isArray(body.categorySlugs) ? body.categorySlugs : [],
      promoProducts: Array.isArray(body.promoProducts) ? body.promoProducts : [],
      avoidTitles,
    })
    return NextResponse.json({ recipe })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Błąd generowania.' }, { status: 500 })
  }
}
