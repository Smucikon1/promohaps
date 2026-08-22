// Wykrywanie aktualnych gazetek na stronach samych sieci.
//
// Dane bierzemy od sklepu, który publikuje je po to, żeby się rozeszły — nie od
// agregatora, którego bazę chroni prawo sui generis i który jest naszym konkurentem.
//
// Każde źródło to osobna funkcja, bo każda sieć trzyma gazetki inaczej. Gdy któraś
// przebuduje serwis, psuje się jedna funkcja, a nie całość — i zawsze zostaje ścieżka
// awaryjna: ręczne wklejenie adresu w silniku gazetek.

export interface ZnalezionaGazetka {
  /** Tytuł wydania, np. „Tani weekend od 21.08" */
  tytul: string
  /** Adres strony wydania u sieci — do podglądu i jako klucz przeciw powtórkom */
  strona: string
  /** Adresy obrazów kolejnych stron gazetki */
  obrazy: string[]
}

const UA = 'Mozilla/5.0 (compatible; zGazetki/1.0)'
const TIMEOUT_MS = 15_000

async function pobierzTekst(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/json,*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.text()
}

// ---------- Biedronka ----------

/**
 * Biedronka: lista wydań → UUID w kodzie strony → API gazetek → obrazy stron.
 *
 * Cały łańcuch chodzi po infrastrukturze Biedronki i nie wymaga logowania ani
 * wyboru sklepu. Ważne, bo wydania wychodzą co kilka dni — osobno „Najtańsza
 * sobota", „Tani weekend" i „Codziennie niskie ceny" — a wszystkie są tu naraz.
 */
async function biedronka(limit: number): Promise<ZnalezionaGazetka[]> {
  const spis = await pobierzTekst('https://www.biedronka.pl/pl/gazetki')

  // /pl/press,id,<id>,title,<slug>
  const linki = [...spis.matchAll(/\/pl\/press,id,([a-z0-9]+),title,([a-z0-9-]+)/gi)]
  const unikalne = new Map<string, string>()
  for (const m of linki) {
    if (!unikalne.has(m[1])) unikalne.set(m[1], `https://www.biedronka.pl${m[0]}`)
  }

  const wynik: ZnalezionaGazetka[] = []
  for (const strona of [...unikalne.values()].slice(0, limit)) {
    try {
      const html = await pobierzTekst(strona)

      // window.galleryLeaflet.init("<uuid>")
      const uuid = html.match(/galleryLeaflet\.init\(\s*["']([0-9a-f-]{36})["']/i)?.[1]
      if (!uuid) continue

      const tytul =
        html.match(/<title>([^<]+)<\/title>/i)?.[1]?.replace(/\s*-\s*Gazetka.*$/i, '').trim() ??
        strona

      const dane = JSON.parse(
        await pobierzTekst(`https://leaflet-api.prod.biedronka.cloud/api/leaflets/${uuid}?ctx=web`)
      )

      // API zwraca NIE listę adresów, tylko listę stron:
      //   { page: 0, images: ['', 'https://…/okladka.png'] }
      // gdzie w polu images siedzi kilka wariantów tej samej strony, część pusta.
      // Bierzemy ostatni niepusty — to wersja o najwyższej rozdzielczości, a przy
      // odczytywaniu cen z gazetki rozdzielczość przesądza o skuteczności.
      const strony = dane?.images_desktop ?? dane?.images_mobile ?? []
      const obrazy: string[] = strony
        .slice()
        .sort((x: any, y: any) => (x?.page ?? 0) - (y?.page ?? 0))
        .map((st: any) => {
          const warianty = Array.isArray(st?.images) ? st.images : [st]
          return [...warianty]
            .reverse()
            .find((u: unknown) => typeof u === 'string' && /^https?:\/\//.test(u))
        })
        .filter(Boolean) as string[]
      if (obrazy.length > 0) wynik.push({ tytul, strona, obrazy })
    } catch {
      // Jedno wydanie, którego nie da się odczytać, nie może zabrać reszty
    }
  }
  return wynik
}

// ---------- Rejestr ----------

type Zrodlo = (limit: number) => Promise<ZnalezionaGazetka[]>

const ZRODLA: Record<string, Zrodlo> = {
  biedronka,
  // Lidl: wydania są pod /l/pl/gazetki/<slug>/ar/0, a strony serwuje imgproxy
  // Schwarz Group. Na liście zbiorczej są tylko miniatury 400×400 — za małe do
  // odczytu cen — więc pełne rozmiary trzeba wyciągnąć ze strony wydania.
  // Do dopisania, gdy Biedronka się sprawdzi w praktyce.
}

export function obslugiwaneSklepy(): string[] {
  return Object.keys(ZRODLA)
}

export async function znajdzGazetki(storeSlug: string, limit = 5): Promise<ZnalezionaGazetka[]> {
  const zrodlo = ZRODLA[storeSlug]
  if (!zrodlo) return []
  return zrodlo(limit)
}
