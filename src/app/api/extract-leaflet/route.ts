import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractLeafletProducts } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })
  }

  // Klient wysyła partię stron (PDF rozłożony na obrazy) albo pojedynczy obraz
  const images: { base64: string; mediaType: string }[] = Array.isArray(body.images)
    ? body.images.filter((i: any) => i?.base64)
    : body.base64
      ? [{ base64: body.base64, mediaType: body.mediaType ?? 'image/jpeg' }]
      : []

  if (images.length === 0) return NextResponse.json({ error: 'Brak pliku.' }, { status: 400 })

  try {
    const products = await extractLeafletProducts({
      images,
      storeName: body.storeName ?? '',
    })
    return NextResponse.json({ products })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Błąd odczytu gazetki.' }, { status: 500 })
  }
}
