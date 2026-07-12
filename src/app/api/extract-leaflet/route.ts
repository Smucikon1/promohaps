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

  const base64: string = body.base64 ?? ''
  const mediaType: string = body.mediaType ?? 'image/jpeg'
  if (!base64) return NextResponse.json({ error: 'Brak pliku.' }, { status: 400 })

  try {
    const products = await extractLeafletProducts({
      base64,
      mediaType,
      storeName: body.storeName ?? '',
    })
    return NextResponse.json({ products })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Błąd odczytu gazetki.' }, { status: 500 })
  }
}
