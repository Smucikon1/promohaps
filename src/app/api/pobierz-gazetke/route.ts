import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAKS_MB = 100
const TIMEOUT_MS = 45_000

// Serwer pobiera adres podany przez klienta, więc musi odmówić wchodzenia do
// własnej sieci. Konto admina jest zaufane, ale przejęta sesja nie powinna dawać
// możliwości skanowania hostów wewnętrznych cudzymi rękami.
const ZABRONIONE_HOSTY =
  /^(localhost$|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i

function sprawdzAdres(raw: string): { ok: true; url: URL } | { ok: false; powod: string } {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, powod: 'To nie jest poprawny adres URL.' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, powod: 'Dozwolone są tylko adresy http i https.' }
  }
  if (ZABRONIONE_HOSTY.test(url.hostname)) {
    return { ok: false, powod: 'Adresy w sieci lokalnej są zablokowane.' }
  }
  return { ok: true, url }
}

/**
 * Pobiera plik gazetki spod wskazanego adresu i oddaje jego bajty.
 *
 * Po co pośrednik: przeglądarka nie pobierze pliku z cudzej domeny (CORS), a poza
 * tym adres gazetki bywa przekierowaniem. Serwer to załatwia, a dalej działa już
 * istniejąca ścieżka — pdf.js rozkłada strony w przeglądarce i leci normalny odczyt.
 *
 * Świadomie BEZ adapterów per sieć. Adres wkleja człowiek, więc gdy sklep przebuduje
 * stronę, nic się nie psuje — po prostu wklejasz nowy link. Adaptery trzeba by
 * naprawiać po każdej przebudowie, a Lidl zdążył przenieść swoje gazetki, zanim
 * zdążyłem napisać pierwszą linijkę.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const wynik = sprawdzAdres(String(body?.url ?? '').trim())
  if (!wynik.ok) return NextResponse.json({ error: wynik.powod }, { status: 400 })

  try {
    const res = await fetch(wynik.url, {
      redirect: 'follow',
      headers: {
        // Bez tego część serwisów oddaje stronę błędu zamiast pliku
        'User-Agent': 'Mozilla/5.0 (compatible; zGazetki/1.0)',
        Accept: 'application/pdf,image/*,*/*',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Serwer sklepu odpowiedział ${res.status}. Sprawdź, czy adres prowadzi wprost do pliku.` },
        { status: 502 }
      )
    }

    const typ = (res.headers.get('content-type') ?? '').toLowerCase()
    const toPdf = typ.includes('pdf')
    const toObraz = typ.startsWith('image/')
    if (!toPdf && !toObraz) {
      return NextResponse.json(
        {
          error:
            `Pod tym adresem jest „${typ.split(';')[0] || 'nieznany typ'}", a potrzebny jest PDF albo obraz. ` +
            'To zwykle znaczy, że link prowadzi do strony z przeglądarką gazetki, a nie do samego pliku.',
        },
        { status: 415 }
      )
    }

    const bufor = await res.arrayBuffer()
    if (bufor.byteLength > MAKS_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Plik większy niż ${MAKS_MB} MB.` }, { status: 413 })
    }

    return new Response(bufor, {
      headers: {
        'Content-Type': toPdf ? 'application/pdf' : typ,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    const powod = e?.name === 'TimeoutError' ? 'przekroczono czas pobierania' : (e?.message ?? 'nieznany błąd')
    return NextResponse.json({ error: `Nie udało się pobrać pliku: ${powod}` }, { status: 502 })
  }
}
