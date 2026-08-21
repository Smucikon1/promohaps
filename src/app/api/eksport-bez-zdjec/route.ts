import { createClient } from '@/lib/supabase/server'
import { buildImagePrompt, WSPOLNY_STYL } from '@/lib/imagePrompt'

export const runtime = 'nodejs'

const KRESKA = '-'.repeat(72)

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Brak autoryzacji.', { status: 401 })

  // Generator zapisuje image_url jako pusty string, gdy zdjęcie się nie udało,
  // ale ręcznie dodany przepis zostawia null — łapiemy oba przypadki.
  const { data, error } = await supabase
    .from('recipes')
    .select('id, title, is_published, created_at, store:stores(name), ingredients(name, price)')
    .or('image_url.is.null,image_url.eq.')
    .order('created_at', { ascending: false })

  if (error) return new Response(`Błąd odczytu: ${error.message}`, { status: 500 })

  const przepisy = data ?? []
  const teraz = new Date().toLocaleString('pl-PL')

  const naglowek = [
    'zGAZETKI — PRZEPISY BEZ ZDJĘCIA',
    `Wygenerowano: ${teraz}`,
    `Pozycji: ${przepisy.length}`,
    '',
    KRESKA,
    'JAK TEGO UŻYĆ',
    KRESKA,
    '',
    'Każdy blok PROMPT jest samodzielny — wklejasz go do ChatGPT w całości,',
    'jeden po drugim. Styl jest w każdym identyczny, więc zdjęcia będą do siebie',
    'pasować jak z jednej sesji.',
    '',
    'Gotowe zdjęcie zapisz i wgraj w adminie pod adresem podanym przy przepisie',
    '(pole „Zdjęcie" w formularzu edycji).',
    '',
    'Jeśli któreś zdjęcie wyjdzie plastikowo albo z artefaktami, dopisz do promptu:',
    '„zdjęcie zrobione telefonem przy oknie, bez retuszu".',
    'To zwykle wystarcza, żeby model zszedł z wypolerowanego renderu na zwykłe zdjęcie.',
    '',
    KRESKA,
    'WSPÓLNY STYL (jest już wbudowany w każdy prompt poniżej)',
    KRESKA,
    '',
    WSPOLNY_STYL,
    '',
  ]

  const pozycje = przepisy.map((r: any, i: number) => {
    const sklep = r.store?.name ? ` · ${r.store.name}` : ''
    const status = r.is_published ? 'opublikowany' : 'szkic'
    return [
      KRESKA,
      `${i + 1}. ${r.title}`,
      `   [${status}${sklep}]`,
      `   Wgraj zdjęcie tutaj: /admin/przepisy/${r.id}`,
      '',
      '   PROMPT:',
      `   ${buildImagePrompt(r.title ?? '', r.ingredients ?? [])}`,
      '',
    ].join('\n')
  })

  const stopka = przepisy.length === 0
    ? ['Wszystkie przepisy mają zdjęcia — nie ma czego eksportować.', '']
    : [KRESKA, `Koniec listy — ${przepisy.length} pozycji do uzupełnienia.`, '']

  // CRLF i BOM: plik ląduje na Windowsie i najczęściej otwiera go Notatnik,
  // który bez tego łamie polskie znaki i zlepia wszystko w jedną linię.
  const tekst = '﻿' + [...naglowek, ...pozycje, ...stopka].join('\n').replace(/\n/g, '\r\n')

  return new Response(tekst, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="przepisy-bez-zdjec.txt"',
      'Cache-Control': 'no-store',
    },
  })
}
