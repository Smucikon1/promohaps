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
  /** Okres obowiązywania, np. „20.08 – 22.08” — osobno od nazwy, żeby tytuł
   *  niósł treść, a nie powtarzał daty */
  daty?: string
}

// Ujednolica polskie znaki. Trzy linijki na miejscu zamiast zaleznosci od modulu
// z lista dan — ten plik nie ma powodu wiedziec o istnieniu przepisow.
function normalizePl(x: string): string {
  return String(x ?? "").toLowerCase().replace(/[ąćęłńóśźż]/g, (c) =>
    (({ ą:"a", ć:"c", ę:"e", ł:"l", ń:"n", ó:"o", ś:"s", ź:"z", ż:"z" } as any)[c] ?? c))
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

/** „2026-08-20" → „20.08" */
function krotkaData(iso?: string): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}.${m[2]}` : ""
}

function okres(od?: string, doo?: string): string | undefined {
  const a = krotkaData(od)
  const b = krotkaData(doo)
  if (!a && !b) return undefined
  return a && b ? `${a} – ${b}` : a || b
}

/**
 * Usuwa z nazwy zwroty o dacie — te trafiają do osobnej kolumny.
 * „Gazetka ważna od 20.08 do 22.08" → „Gazetka", a „Rewolucja cenowa!" zostaje.
 */
function bezDat(nazwa: string): string {
  const czysta = String(nazwa ?? "")
    .replace(/wa[żz]n[ay]?\s+od\s+[\d.]+\s*(?:r\.?)?\s*(?:do\s+[\d.]+\s*(?:r\.?)?)?/gi, " ")
    .replace(/\bod\s+\d{1,2}[.\-]\d{1,2}(?:[.\-]\d{2,4})?/gi, " ")
    .replace(/\bdo\s+\d{1,2}[.\-]\d{1,2}(?:[.\-]\d{2,4})?/gi, " ")
    .replace(/[\s–—-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
  return czysta.length >= 3 ? czysta : "Gazetka"
}

// ---------- Biedronka: starsza przeglądarka (flexpaper) ----------

/**
 * Część wydań Biedronki nie używa nowego API gazetek, tylko starszej przeglądarki
 * opartej na PDF-ie. Wychodzi to na jaw dopiero przy konkretnym wydaniu — „Gang
 * Zaradniaków" był po cichu pomijany, bo kod szukał wyłącznie galleryLeaflet.init.
 *
 * Adresy stron składamy sami ze wzorca; liczbę stron podaje wariant format=json.
 * resolution=200 daje wersję czytelną dla odczytu — domyślna jest za miękka na ceny.
 */
function flexpaperUrl(doc: string, opcje: string): string {
  const podfolder = encodeURIComponent(`_cache/${doc}/`)
  return `https://www.biedronka.pl/flexpaper/view?subfolder=${podfolder}&doc=${doc}.pdf&${opcje}`
}

async function stronyZFlexpaper(html: string): Promise<string[]> {
  const doc = html.match(/([A-Za-z0-9]{16,32})\.pdf/)?.[1]
  if (!doc) return []
  try {
    const meta = JSON.parse(await pobierzTekst(flexpaperUrl(doc, 'format=json&page=1')))
    // Każdy wpis niesie łączną liczbę stron w polu pages
    const ile = Number(meta?.[0]?.pages ?? (Array.isArray(meta) ? meta.length : 0))
    if (!ile || ile > 200) return []
    return Array.from({ length: ile }, (_, i) => flexpaperUrl(doc, `format=jpg&page=${i + 1}&resolution=200`))
  } catch {
    return []
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

      const tytulStrony =
        html.match(/<title>([^<]+)<\/title>/i)?.[1]?.replace(/\s*-\s*Gazetka.*$/i, '').trim() ?? strona

      // window.galleryLeaflet.init("<uuid>") — nowsza przeglądarka
      const uuid = html.match(/galleryLeaflet\.init\(\s*["']([0-9a-f-]{36})["']/i)?.[1]
      if (!uuid) {
        // Starsza przeglądarka — inny mechanizm, ta sama wartość dla nas
        const zFlexpaper = await stronyZFlexpaper(html)
        if (zFlexpaper.length > 0) {
          wynik.push({ tytul: tytulStrony, strona, obrazy: zFlexpaper })
        }
        continue
      }

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
        // Nazwa bez dat; okres idzie osobno, żeby lista dała się czytać wzrokiem
        tytul: bezDat(f.name || f.title || slug),
        daty: okres(f.offerStartDate ?? f.startDate, f.offerEndDate ?? f.endDate),
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

// ---------- Dino ----------

/**
 * Dino: lista wydań renderowana serwerowo, z PDF-ami w spłaszczonym payloadzie.
 *
 * Payload to jedna wielka tablica, gdzie tytuł, opis z datami i adres PDF-a leżą
 * blisko siebie, ale bez jawnego powiązania. Wiążemy je po odległości w tekście:
 * dla każdego PDF-a szukamy wstecz najbliższego opisu „Gazetka aktywna od … do …"
 * i stojącego przed nim tytułu. Krucha to metoda, ale alternatywą jest parsowanie
 * całego formatu Nuxta, który zmienia się częściej niż układ tej strony.
 */
async function dino(limit: number): Promise<ZnalezionaGazetka[]> {
  const html = await pobierzTekst('https://marketdino.pl/gazetki/lista/standard')

  // W payloadzie tytuł, data utworzenia i opis z okresem stoją obok siebie:
  //   "Weekendowe okazje","2026-08-19 00:00:00","Gazetka aktywna od … do …"
  // Celujemy w cały ten wzorzec naraz, zamiast szukać tytułu po omacku wstecz —
  // pierwsza wersja łapała tak fragmenty payloadu w rodzaju „:37},132198,".
  const wpisy = [
    ...html.matchAll(
      /"([^"]{4,60})","\d{4}-\d{2}-\d{2}[^"]*","Gazetka aktywna od (\d{4}-\d{2}-\d{2}) do (\d{4}-\d{2}-\d{2})"/g
    ),
  ]

  const wynik: ZnalezionaGazetka[] = []
  for (const w of wpisy.slice(0, limit)) {
    // PDF wydania leży za jego opisem — bierzemy pierwszy napotkany dalej
    const dalej = html.slice(w.index ?? 0)
    const pdf = dalej.match(/https:\/\/[^"\s]+\.pdf/i)?.[0]
    if (!pdf) continue

    // Payload bywa poprzestawiany i w miejscu tytułu trafia się znacznik czasu
    // albo goła liczba — wtedy lepsza jest nazwa ogólna niż „2026-08-25 22:30:00"
    const surowy = w[1]
    const sensowny = !/^[\d\s:.\-]+$/.test(surowy) && /[a-ząćęłńóśźż]/i.test(surowy)

    wynik.push({
      tytul: sensowny ? bezDat(surowy) : "Gazetka Dino",
      strona: pdf,
      obrazy: [],
      pdf,
      daty: okres(w[2], w[3]),
    })
  }
  return wynik
}

// ---------- Netto ----------

/** Identyfikator Netto Polska na platformie Tjek — z niego lecą wszystkie zapytania */
const NETTO_DEALER = 'acc54D'

/**
 * Netto: publiczne API platformy Tjek, z której sieć korzysta.
 *
 * Najprostsze ze wszystkich źródeł — jedno zapytanie zwraca komplet: etykietę,
 * okres obowiązywania, liczbę stron i gotowy adres pobrania PDF-a. Żadnego
 * parsowania HTML-a, więc i nic się nie psuje przy przebudowie strony netto.pl.
 *
 * Obrazy stron też są dostępne, ale mają w adresie podpis i szerokość 700 px
 * wpisaną na sztywno — za mało na pewny odczyt cen. PDF nie ma tego ograniczenia.
 */
async function netto(limit: number): Promise<ZnalezionaGazetka[]> {
  const dane = JSON.parse(
    await pobierzTekst(
      `https://squid-api.tjek.com/v2/catalogs?dealer_ids=${NETTO_DEALER}&limit=${Math.max(limit, 8)}`
    )
  )
  if (!Array.isArray(dane)) return []

  return dane
    .filter((k: any) => k?.pdf_url)
    .slice(0, limit)
    .map((k: any) => ({
      // „Netto Gazetka T35A Food 2026" → „T35A Food"; rok i nazwa sieci nic nie wnoszą,
      // a podkreślenia z etykiet typu „Netto_MK_Wina_34-35/26" psują czytelność
      tytul:
        String(k.label ?? "")
          .replace(/_/g, " ")
          .replace(/\bnetto\b|\bgazetka\b|\b20\d{2}\b/gi, " ")
          .replace(/\s{2,}/g, " ")
          .trim() || "Gazetka Netto",
      strona: k.pdf_url,
      obrazy: [],
      pdf: k.pdf_url,
      stron: typeof k.page_count === "number" ? k.page_count : undefined,
      daty: okres(k.run_from, k.run_till),
    }))
}

// ---------- Rejestr ----------

type Zrodlo = (limit: number) => Promise<ZnalezionaGazetka[]>

const ZRODLA: Record<string, Zrodlo> = {
  biedronka,
  lidl,
  dino,
  netto,
  // Kaufland odpada: mimo wspólnej z Lidlem infrastruktury Schwarz Group jego
  // własny serwis odrzuca żądania serwerowe (HTTP 403). Obchodzenie tego to już
  // ukrywanie się przed blokadą, więc dla Kauflandu zostaje ręczne wklejenie adresu.
}

// Wydania, z których nie da się ugotować obiadu. Sieci wypuszczają obok gazetek
// spożywczych osobne katalogi szkolne, meblowe i alkoholowe — odczyt przemieliłby
// je bez pożytku, a płacisz za każdą stronę wysłaną do modelu.
const NIESPOZYWCZE = [
  /non.?food/i,
  /\bhome\b/i,
  /\bszkol/i,
  /wyprawk/i,
  /\bmebl/i,
  /\bogrod/i,
  /\bmoda\b|\bodziez/i,
  /tekstyl/i,
  /przemyslow/i,
  /\bzabawk/i,
  // BTS = back to school; Netto tak oznacza katalogi szkolne
  /\bbts\b|back.?to.?school/i,
  /\bszkoln/i,
  /\bagd\b|\brtv\b/i,
  // Alkohol to formalnie spożywka, ale katalog samych win nie da żadnego przepisu
  /\balko/i,
  /\bwina\b|\bwino\b/i,
  /\bmocne\b/i,
  /whisky|piwo\b/i,
]

/** Czy z tego wydania da się w ogóle ugotować — po tytule, bo treści jeszcze nie znamy */
export function czySpozywcza(tytul: string): boolean {
  const t = normalizePl(tytul)
  return !NIESPOZYWCZE.some((re) => re.test(t))
}

export function obslugiwaneSklepy(): string[] {
  return Object.keys(ZRODLA)
}

export async function znajdzGazetki(storeSlug: string, limit = 5): Promise<ZnalezionaGazetka[]> {
  const zrodlo = ZRODLA[storeSlug]
  if (!zrodlo) return []
  // Pobieramy z zapasem, bo część wydań odpadnie jako niespożywcza
  const wszystkie = await zrodlo(limit * 3)
  return wszystkie.filter((g) => czySpozywcza(g.tytul)).slice(0, limit)
}
