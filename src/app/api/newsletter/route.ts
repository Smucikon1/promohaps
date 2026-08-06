import { NextResponse } from 'next/server'
import { checkLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 15

// Zapisy do newslettera przez Beehiiv. Wymaga BEEHIIV_PUBLICATION_ID + BEEHIIV_API_KEY w env.
// Bez env — zwraca 501 (klient pokaże komunikat "wkrótce").
const PUB = process.env.BEEHIIV_PUBLICATION_ID
const KEY = process.env.BEEHIIV_API_KEY

export async function POST(request: Request) {
  if (!PUB || !KEY) {
    return NextResponse.json({ error: 'Newsletter jeszcze nieaktywny.' }, { status: 501 })
  }

  // Rate limit anonimowego endpointu — 10 zapisów na godzinę z jednego IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const gate = checkLimit(`newsletter:${ip}`, 10, 60 * 60 * 1000)
  if (!gate.ok) return NextResponse.json({ error: 'Zbyt wiele prób. Spróbuj później.' }, { status: 429 })

  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Podaj poprawny adres e-mail.' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.beehiiv.com/v2/publications/${PUB}/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        send_welcome_email: true,
        utm_source: 'promohaps.pl',
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return NextResponse.json(
        { error: 'Zapis nie powiódł się.', detail: detail.slice(0, 200) },
        { status: 502 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Serwer nie odpowiada.' }, { status: 502 })
  }
}
