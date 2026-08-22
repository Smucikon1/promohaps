import https from 'node:https'
import zlib from 'node:zlib'

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
  /** Adresy obrazów kolejnych stron gazetki (Biedronka) */
  obrazy: string[]
  /** Adres PDF-a całego wydania (Lidl) — prostszy i lepszej jakości niż obrazy */
  pdf?: string
  /** Ile stron ma wydanie, gdy wiadomo z góry */
  stron?: number
}

const UA = 'Mozilla/5.0 (compatible; zGazetki/1.0)'
const TIMEOUT_MS = 15_000

/**
 * Pobranie strony przez node:https z podniesionym buforem nagłówków.
 *
 * lidl.pl odpowiada zestawem nagłówków przekraczającym domyślne 16 KB Node'a,
 * przez co zwykły fetch przerywa się na UND_ERR_HEADERS_OVERFLOW, zanim zobaczy
 * choćby bajt treści. To limit bufora po naszej stronie, a nie zabezpieczenie
 * serwisu — podnosimy go, zamiast kombinować z nagłówkami żądania.
 */
function pobierzPrzezHttps(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        // identity: node:https nie rozpakowuje odpowiedzi tak jak fetch, wiec bez
        // tego dostalibysmy gzip zinterpretowany jako tekst i zero dopasowan
        headers: { 'User-Agent': UA, Accept: 'text/html,*/*', 'Accept-Encoding': 'gzip, deflate, br' },
        maxHeaderSize: 262_144,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        // Przekierowania obsługujemy sami, bo node:https ich nie śledzi
        const loc = res.headers.location
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && loc) {
          res.resume()
          resolve(pobierzPrzezHttps(new URL(loc, url).href))
          return
        }
        // Serwer i tak wysyła skompresowaną treść, więc zbieramy BAJTY (bez
        // setEncoding) i rozpakowujemy jawnie. fetch robi to sam, node:https nie.
        const kawalki: Buffer[] = []
        res.on('data', (c: Buffer) => kawalki.push(c))
        res.on('end', () => {
          const surowe = Buffer.concat(kawalki)
          const kodowanie = String(res.headers['content-encoding'] ?? '').toLowerCase()
          try {
            if (kodowanie.includes('br')) return resolve(zlib.brotliDecompressSync(surowe).toString('utf8'))
            if (kodowanie.includes('gzip')) return resolve(zlib.gunzipSync(surowe).toString('utf8'))
            if (kodowanie.includes('deflate')) return resolve(zlib.inflateSync(surowe).toString('utf8'))
          } catch {
            // Gdy rozpakowanie zawiedzie, oddajemy surowe — lepsze niż wyjątek
          }
          resolve(surowe.toString('utf8'))
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.end()
  })
}

async function pobierzTekst(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/json,*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
    return res.text()
  } catch (e: any) {
    // Przepełnienie bufora nagłówków to jedyny błąd, który da się obejść drugą drogą
    if (e?.cause?.code === 'UND_ERR_HEADERS_OVERFLOW' || /HEADERS_OVERFLOW/i.test(String(e?.message))) {
      return pobierzPrzezHttps(url)
    }
    throw e
  }
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

// ---------- Lidl ----------

/**
 * Lidl: lista wydań → API Schwarz Group → gotowy PDF wydania.
 *
 * Lidl i Kaufland należą do tej samej grupy, ale Kaufland odrzuca żądania serwerowe
 * (HTTP 403), więc obsługujemy tylko Lidla.
 *
 * Bierzemy PDF, choć API zwraca też obrazy stron i wręcz gotowy tekst gazetki
 * w polu keyWords. Tekst odpada, bo jest zlepkiem słów bez układu — cena „199 499"
 * przy dwóch produktach nie mówi, co do czego należy, a zmyślona cena jest gorsza
 * niż brak gazetki. PDF zachowuje układ, więc odczyt widzi to samo co człowiek.
 */
async function lidl(limit: number): Promise<ZnalezionaGazetka[]> {
  const spis = await pobierzTekst('https://www.lidl.pl/c/nasze-gazetki/s10008614')

  // /l/pl/gazetki/<slug>/ar/0
  const slugi = [
    ...new Set([...spis.matchAll(/\/l\/pl\/gazetki\/([a-z0-9-]+)\//gi)].map((m) => m[1])),
  ]

  const wynik: ZnalezionaGazetka[] = []
  for (const slug of slugi.slice(0, limit)) {
    try {
      const dane = JSON.parse(
        await pobierzTekst(
          `https://endpoints.leaflets.schwarz/v4/flyer?flyer_identifier=${encodeURIComponent(slug)}&region_id=0&region_code=0`
        )
      )
      const f = dane?.flyer
      if (!f?.id) continue

      // W odpowiedzi są też PDF-y wydań powiązanych — bierzemy tylko własny,
      // rozpoznając go po identyfikatorze wydania w ścieżce.
      const pdf = (JSON.stringify(f).match(/https:\/\/[^"']+\.pdf/gi) ?? []).find((u: string) =>
        u.includes(f.id)
      )
      if (!pdf) continue

      wynik.push({
        tytul: [f.name, f.title].filter(Boolean).join(" — ") || slug,
        strona: `https://www.lidl.pl/l/pl/gazetki/${slug}/ar/0`,
        obrazy: [],
        pdf,
        stron: Array.isArray(f.pages) ? f.pages.length : undefined,
      })
    } catch {
      // Jedno wydanie nie może zabrać reszty
    }
  }
  return wynik
}

// ---------- Rejestr ----------

type Zrodlo = (limit: number) => Promise<ZnalezionaGazetka[]>

const ZRODLA: Record<string, Zrodlo> = {
  biedronka,
  lidl,
  // Kaufland odpada: mimo wspólnej z Lidlem infrastruktury Schwarz Group jego
  // własny serwis odrzuca żądania serwerowe (HTTP 403). Obchodzenie tego to już
  // ukrywanie się przed blokadą, więc dla Kauflandu zostaje ręczne wklejenie adresu.
}

export function obslugiwaneSklepy(): string[] {
  return Object.keys(ZRODLA)
}

export async function znajdzGazetki(storeSlug: string, limit = 5): Promise<ZnalezionaGazetka[]> {
  const zrodlo = ZRODLA[storeSlug]
  if (!zrodlo) return []
  return zrodlo(limit)
}
