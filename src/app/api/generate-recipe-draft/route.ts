import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkLimit } from '@/lib/rateLimit'
import { createRecipeDraft, DraftError } from '@/lib/createDraft'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 })

  const gate = checkLimit(`draft:${user.id}`, 20, 60 * 60 * 1000)
  if (!gate.ok) {
    return NextResponse.json(
      { error: 'Za dużo żądań, spróbuj później.' },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })
  }

  try {
    const wynik = await createRecipeDraft(supabase, {
      storeSlug: body.storeSlug ?? '',
      storeName: body.storeName ?? '',
      theme: body.theme,
      promoProducts: body.promoProducts,
      reuseProducts: body.reuseProducts,
      extraAvoidTitles: Array.isArray(body.extraAvoidTitles) ? body.extraAvoidTitles : [],
    })
    return NextResponse.json(wynik)
  } catch (e: any) {
    const status = e instanceof DraftError ? e.status : 500
    return NextResponse.json({ error: e?.message ?? 'Błąd generowania.' }, { status })
  }
}
