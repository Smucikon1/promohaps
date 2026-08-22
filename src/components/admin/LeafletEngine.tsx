'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { pickDistinctDishes, type SlotTag } from '@/lib/popularDishes'
import { Loader2, ScanLine, Save, Sparkles, Trash2, ExternalLink, Archive, Link2 } from 'lucide-react'
import type { Store } from '@/types'

type ConditionType = 'brak' | 'karta' | 'wielosztuka' | 'inny'

interface Product {
  name: string
  price_promo: number | null
  price_regular: number | null
  condition_type?: ConditionType
  condition_note?: string | null
  min_quantity?: number | null
  // Okres ważności odczytany z gazetki (YYYY-MM-DD) lub null
  valid_from?: string | null
  valid_to?: string | null
}

const CONDITION_LABEL: Record<ConditionType, string> = {
  brak: '',
  karta: 'z kartą',
  wielosztuka: 'wielosztuka',
  inny: 'warunek',
}

const CONDITION_STYLE: Record<ConditionType, string> = {
  brak: '',
  karta: 'bg-purple-100 text-purple-700',
  wielosztuka: 'bg-green-100 text-green-700',
  inny: 'bg-stone-100 text-stone-600',
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Nie udało się odczytać pliku.'))
    r.readAsDataURL(file)
  })
}

type PageImage = { base64: string; mediaType: string }

// --- Mądry dobór produktów pod filtr ---
type PickProduct = { name: string; price_promo: number | null }
const normName = (s?: string | null) =>
  String(s ?? '').toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => (({ ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' } as any)[c] ?? c))
const nameHas = (name: string | null | undefined, kws: string[]) => {
  const n = normName(name)
  return kws.some((k) => n.includes(k))
}
const MEAT = ['kurcz', 'indyk', 'wieprz', 'wolow', 'mies', 'kielbas', 'szynk', 'boczek', 'schab', 'kark', 'zeberk', 'parow', 'kabanos', 'salami', 'mielon', 'udo', 'podudz', 'skrzydel', 'kaszank', 'baleron', 'pasztet', 'wedlin', 'kotlet']
const FISH = ['losos', 'ryb', 'dorsz', 'mintaj', 'tunczyk', 'sledz', 'makrel', 'krewet', 'panga', 'owoce morza', 'kalmar', 'paluszki ryb', 'poledwica lososiowa']
const NON_AIRFRY = ['mleko', 'jogurt', 'kefir', 'maslank', 'napoj', ' sok', 'woda', 'olej', 'ocet', 'smietan', 'platki', 'kawa', 'herbat', 'przyprawa', 'bulion']
const UNHEALTHY = ['boczek', 'kielbas', 'majonez', 'frytk', 'chips', 'batonik', 'czekolad', 'smalec', 'parow', 'kabanos', 'panierow', 'ciast', ' lod', 'salami']
const isMeatOrFish = (p: PickProduct) => nameHas(p.name, MEAT) || nameHas(p.name, FISH)

// Zostaw najtańsze pozycje (żeby zmieścić się w limicie ceny); fallback: 60% najtańszych.
// Pomijamy ceny < 0,20 zł — to zwykle błędna ekstrakcja (np. „0,01 zł").
function cheapest(list: PickProduct[], underZl: number) {
  const priced = list.filter((p) => (p.price_promo ?? 0) >= 0.3)
  const base = priced.length >= 4 ? priced : list
  const sorted = [...base].sort((a, b) => (a.price_promo ?? 1e9) - (b.price_promo ?? 1e9))
  const cheap = sorted.filter((p) => (p.price_promo ?? 1e9) <= underZl)
  return cheap.length >= 4 ? cheap : sorted.slice(0, Math.max(6, Math.ceil(sorted.length * 0.6)))
}

// Zestaw 12 szkiców — po jednym na każdy filtr; select = jak dobrać produkty pod ten filtr
type SetSpec = { label: string; theme: string; select?: (p: PickProduct[]) => PickProduct[] }
const SET_SPECS: SetSpec[] = [
  { label: 'Wege', theme: 'Danie wegetariańskie (bez mięsa i ryb). Przypisz kategorię „wege".', select: (p) => p.filter((x) => !isMeatOrFish(x)) },
  { label: 'Air fryer', theme: 'Przepis z airfryera (frytkownicy beztłuszczowej) — w krokach wyraźnie użyj airfryera, podaj temperaturę i czas.', select: (p) => p.filter((x) => !nameHas(x.name, NON_AIRFRY)) },
  { label: 'Do 15 zł', theme: 'Bardzo tani przepis: łączny koszt wszystkich opakowań składników NIE MOŻE przekroczyć 15 zł — dobierz najtańsze produkty i małe opakowania.', select: (p) => cheapest(p, 8) },
  { label: 'Do 25 zł', theme: 'Tani przepis: łączny koszt wszystkich opakowań składników do 25 zł.', select: (p) => cheapest(p, 14) },
  { label: 'Do 40 zł', theme: 'Przepis dla rodziny: łączny koszt wszystkich opakowań składników do 40 zł.', select: (p) => cheapest(p, 25) },
  { label: 'Obiad', theme: 'Sycący obiad (danie główne). Przypisz kategorię „obiad".' },
  { label: 'Fit', theme: 'Lekki, fit przepis — mniej tłuszczu, dużo warzyw i białka. Przypisz kategorię „fit".', select: (p) => p.filter((x) => !nameHas(x.name, UNHEALTHY)) },
  { label: 'Śniadanie', theme: 'Pomysł na śniadanie. Przypisz kategorię „śniadanie".' },
  { label: 'Kolacja', theme: 'Lekka kolacja. Przypisz kategorię „kolacja".' },
  { label: 'Szybkie', theme: 'Szybki przepis do ~20 minut. Przypisz kategorie „szybkie" i „do 20 minut".' },
  { label: 'Deser', theme: 'Prosty deser. Przypisz kategorię „deser".', select: (p) => p.filter((x) => !isMeatOrFish(x)) },
  { label: 'Zupa', theme: 'Rozgrzewająca zupa. Przypisz kategorię „zupa".' },
]

const MAX_EDGE = 1600 // dłuższy bok strony/obrazu po przeskalowaniu
// Poniżej tej ceny promocja jest niewiarygodna (błąd odczytu) — nie zapisujemy jej ani nie używamy w przepisach
const MIN_PRICE = 0.3
const PAGES_PER_REQUEST = 1 // jedna strona na żądanie — mniejsze ciało, mniej błędów sieci

function canvasToBase64(canvas: HTMLCanvasElement): PageImage {
  const out = canvas.toDataURL('image/jpeg', 0.85)
  return { base64: out.split(',')[1], mediaType: 'image/jpeg' }
}

// Pojedynczy obraz -> zmniejszony JPEG
async function imageToPage(file: File): Promise<PageImage> {
  const dataUrl = await readDataUrl(file)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Nie udało się wczytać obrazu.'))
    i.src = dataUrl
  })
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvasToBase64(canvas)
}

// PDF -> każda strona zrenderowana do JPEG (omija limit rozmiaru żądania)
async function pdfToPages(file: File, onProgress: (done: number, total: number) => void): Promise<PageImage[]> {
  const pdfjs: any = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const pages: PageImage[] = []

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(2, MAX_EDGE / Math.max(base.width, base.height))
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    pages.push(canvasToBase64(canvas))
    onProgress(n, doc.numPages)
  }
  return pages
}

export function LeafletEngine({ stores }: { stores: Store[] }) {
  const [storeSlug, setStoreSlug] = useState(stores[0]?.slug ?? '')
  const [extracting, setExtracting] = useState(false)
  const [progress, setProgress] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  const [theme, setTheme] = useState('')
  const [adresGazetki, setAdresGazetki] = useState('')
  const [dostepne, setDostepne] = useState<any[] | null>(null)
  const [szukam, setSzukam] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [batchStatus, setBatchStatus] = useState('')
  const [drafts, setDrafts] = useState<{ id: string; title: string; editUrl: string; hasImage?: boolean }[]>([])
  // Nieudane zdjęcie nie jest błędem generacji — przepis powstał, więc osobny, łagodniejszy komunikat
  const [imageNotice, setImageNotice] = useState('')
  // Produkty użyte w dotychczas wygenerowanych przepisach (współdzielenie zakupów)
  const [usedProducts, setUsedProducts] = useState<string[]>([])
  // Zapisana pula promocji dla sklepu (recipe_id=null, aktywne) — do generowania w innej sesji
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(false)

  const store = stores.find((s) => s.slug === storeSlug)
  const todayStr = () => new Date().toISOString().slice(0, 10)

  // Ile zapisanych, jeszcze niewykorzystanych i aktywnych promocji ma ten sklep
  const refreshSavedCount = useCallback(async () => {
    if (!store) {
      setSavedCount(null)
      return
    }
    const supabase = createClient()
    // Auto-sprzątanie: usuwamy zapisane promocje (niepowiązane z przepisem), którym minął termin
    await supabase.from('promo_products').delete().eq('store_id', store.id).is('recipe_id', null).lt('valid_to', todayStr())
    const { count } = await supabase
      .from('promo_products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', store.id)
      .is('recipe_id', null)
      .gte('valid_to', todayStr())
      .gte('price_promo', MIN_PRICE)
    setSavedCount(count ?? 0)
  }, [store?.id])

  useEffect(() => {
    refreshSavedCount()
  }, [refreshSavedCount])

  // Wczytaj zapisaną pulę do tabeli — dzięki temu generujesz z niej także po powrocie
  const loadSavedPromos = async () => {
    if (!store) return
    setLoadingSaved(true)
    setError('')
    setSavedMsg('')
    const supabase = createClient()
    const { data, error: e } = await supabase
      .from('promo_products')
      .select('name, price_promo, price_regular, condition_type, condition_note, min_quantity, valid_from, valid_to')
      .eq('store_id', store.id)
      .is('recipe_id', null)
      .gte('valid_to', todayStr())
      .gte('price_promo', MIN_PRICE)
      .order('valid_to', { ascending: true })
    setLoadingSaved(false)
    if (e) {
      setError(`Wczytywanie promocji: ${e.message}`)
      return
    }
    const mapped: Product[] = (data ?? []).map((p: any) => ({
      name: p.name,
      price_promo: p.price_promo,
      price_regular: p.price_regular,
      condition_type: p.condition_type ?? 'brak',
      condition_note: p.condition_note ?? null,
      min_quantity: p.min_quantity ?? null,
      valid_from: p.valid_from ?? null,
      valid_to: p.valid_to ?? null,
    }))
    if (mapped.length === 0) {
      setError('Brak zapisanych, aktywnych promocji dla tego sklepu.')
      return
    }
    setProducts(mapped)
    setSavedMsg(`Wczytano ${mapped.length} zapisanych promocji — możesz teraz wygenerować z nich przepisy.`)
  }

  // Usuń całą zapisaną pulę promocji sklepu (bez ruszania promocji przypisanych do przepisów)
  const deleteAllSaved = async () => {
    if (!store) return
    if (!confirm(`Usunąć WSZYSTKIE zapisane promocje sklepu ${store.name}? Nie dotyczy promocji przypisanych do gotowych przepisów.`)) return
    setLoadingSaved(true)
    setError('')
    setSavedMsg('')
    const supabase = createClient()
    const { error: e } = await supabase.from('promo_products').delete().eq('store_id', store.id).is('recipe_id', null)
    setLoadingSaved(false)
    if (e) {
      setError(`Usuwanie promocji: ${e.message}`)
      return
    }
    setSavedMsg(`🗑️ Usunięto zapisane promocje sklepu ${store.name}.`)
    setSavedCount(0)
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // pozwala wgrać ten sam plik drugi raz
    if (file) await przetworzPlik(file)
  }

  // Pyta stronę sieci o listę aktualnych wydań. Biedronka trzyma je pod własnym
  // API gazetek, więc nie potrzeba ani agregatora, ani szukania PDF-a ręcznie.
  const sprawdzGazetki = async () => {
    setSzukam(true)
    setError('')
    setDostepne(null)
    try {
      const res = await fetch('/api/gazetki-dostepne', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeSlug }),
      })
      const dane = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(dane?.error ?? `Błąd ${res.status}`)
      setDostepne(dane.gazetki ?? [])
    } catch (e: any) {
      setError(e?.message ?? 'Nie udało się sprawdzić gazetek.')
    } finally {
      setSzukam(false)
    }
  }

  // Ściąga strony wybranego wydania i wpuszcza je w zwykły odczyt
  const wczytajZnaleziona = async (g: any) => {
    setExtracting(true)
    setError('')
    setSavedMsg('')
    setProducts([])
    try {
      // Lidl oddaje gotowy PDF całego wydania, Biedronka — osobne obrazy stron.
      // PDF jest lepszy: jedno pobranie zamiast kilkudziesięciu i pewny układ strony.
      if (g.pdf) {
        setProgress('Pobieram PDF gazetki…')
        const res = await fetch('/api/pobierz-gazetke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: g.pdf }),
        })
        if (!res.ok) {
          const dane = await res.json().catch(() => ({}))
          throw new Error(dane?.error ?? `Nie udało się pobrać PDF-a (${res.status}).`)
        }
        const blob = await res.blob()
        const pdfStrony = await pdfToPages(
          new File([blob], 'gazetka.pdf', { type: 'application/pdf' }),
          (done, total) => setProgress(`Renderuję strony: ${done}/${total}`)
        )
        setExtracting(false)
        await przetworzStrony(pdfStrony)
        setDostepne(null)
        return
      }

      const strony: PageImage[] = []
      for (let i = 0; i < g.obrazy.length; i++) {
        setProgress(`Pobieram strony: ${i + 1}/${g.obrazy.length}`)
        const res = await fetch('/api/pobierz-gazetke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: g.obrazy[i] }),
        })
        if (!res.ok) continue // pojedyncza strona nie może zabrać całego wydania
        const blob = await res.blob()
        strony.push(await imageToPage(new File([blob], `str-${i + 1}.png`, { type: blob.type })))
      }
      if (strony.length === 0) throw new Error('Nie udało się pobrać żadnej strony.')
      setExtracting(false)
      await przetworzStrony(strony)
      setDostepne(null)
    } catch (e: any) {
      setExtracting(false)
      setProgress('')
      setError(e?.message ?? 'Nie udało się wczytać gazetki.')
    }
  }

  // Pobiera gazetkę spod adresu i wpuszcza ją w tę samą ścieżkę co plik z dysku.
  // Bez adapterów per sieć: adres wkleja człowiek, więc przebudowa strony sklepu
  // niczego nie psuje — wklejasz nowy link zamiast czekać na poprawkę w kodzie.
  const pobierzZAdresu = async () => {
    const adres = adresGazetki.trim()
    if (!adres) return
    setExtracting(true)
    setError('')
    setSavedMsg('')
    setProgress('Pobieram plik ze strony sklepu…')
    try {
      const res = await fetch('/api/pobierz-gazetke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: adres }),
      })
      if (!res.ok) {
        const dane = await res.json().catch(() => ({}))
        throw new Error(dane?.error ?? `Błąd ${res.status}`)
      }
      const typ = res.headers.get('content-type') ?? 'application/pdf'
      const blob = await res.blob()
      const nazwa = typ.includes('pdf') ? 'gazetka.pdf' : 'gazetka.jpg'
      setExtracting(false)
      await przetworzPlik(new File([blob], nazwa, { type: typ }))
      setAdresGazetki('')
    } catch (e: any) {
      setExtracting(false)
      setProgress('')
      setError(e?.message ?? 'Nie udało się pobrać pliku.')
    }
  }

  // Wspólna ścieżka dla pliku z dysku i pliku pobranego po adresie — dalej wszystko
  // dzieje się tak samo: pdf.js rozkłada strony, paczki lecą do odczytu.
  const przetworzPlik = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      setError('Plik za duży (maks. 100 MB).')
      return
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    setExtracting(true)
    setError('')
    setSavedMsg('')
    setProducts([])

    try {
      // 1) Przygotowanie stron (PDF rozkładamy na obrazy w przeglądarce)
      let pages: PageImage[]
      if (isPdf) {
        setProgress('Wczytuję PDF...')
        pages = await pdfToPages(file, (done, total) => setProgress(`Renderuję strony: ${done}/${total}`))
      } else {
        pages = [await imageToPage(file)]
      }
      if (pages.length === 0) throw new Error('PDF nie zawiera stron.')
      await przetworzStrony(pages)
    } catch (err: any) {
      setError(`Błąd: ${err?.message ?? 'nieznany'}`)
      setExtracting(false)
      setProgress('')
    }
  }

  // Odczyt gotowych stron — wspólne dla pliku, PDF-a i gazetki pobranej ze strony sieci
  const przetworzStrony = async (pages: PageImage[]) => {
    setExtracting(true)
    try {
      // 2) Wysyłka partiami — omija limit rozmiaru żądania.
      // Ponawiamy przy błędach sieci, 429 (rate limit — respect Retry-After) i 5xx.
      const fetchBatch = async (slice: PageImage[], attempt = 0): Promise<any> => {
        const MAX_ATTEMPTS = 4
        try {
          const res = await fetch('/api/extract-leaflet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: slice, storeName: store?.name ?? '' }),
          })
          if (res.status === 429 && attempt < MAX_ATTEMPTS) {
            const retryAfter = Number(res.headers.get('Retry-After')) || 30
            await new Promise((r) => setTimeout(r, Math.min(retryAfter * 1000, 60_000)))
            return fetchBatch(slice, attempt + 1)
          }
          if (res.status >= 500 && res.status < 600 && attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
            return fetchBatch(slice, attempt + 1)
          }
          if (!res.ok) {
            const isJson = res.headers.get('content-type')?.includes('application/json')
            const d = isJson ? await res.json().catch(() => ({})) : {}
            throw new Error(d.error ?? `Serwer zwrócił błąd ${res.status}.`)
          }
          return await res.json()
        } catch (err: any) {
          const isNetwork =
            err?.name === 'TypeError' || /NetworkError|Failed to fetch|networkerror|load failed/i.test(err?.message ?? '')
          if (isNetwork && attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
            return fetchBatch(slice, attempt + 1)
          }
          throw err
        }
      }

      const merged: Product[] = []
      const seen = new Set<string>()
      const batches = Math.ceil(pages.length / PAGES_PER_REQUEST)
      let failedPages = 0

      const errorSample: string[] = []
      for (let b = 0; b < batches; b++) {
        const slice = pages.slice(b * PAGES_PER_REQUEST, (b + 1) * PAGES_PER_REQUEST)
        setProgress(`Odczytuję promocje: strona ${b + 1}/${batches}`)
        try {
          const data = await fetchBatch(slice)
          for (const p of data.products ?? []) {
            const key = String(p.name ?? '').trim().toLowerCase()
            if (!key || seen.has(key)) continue
            seen.add(key)
            merged.push(p)
          }
          setProducts([...merged]) // pokazuj wyniki na bieżąco
        } catch (err: any) {
          // Jedna strona padła — nie przerywamy całości, lecimy dalej.
          // Logujemy pierwsze 3 błędy do konsoli, żeby użytkownik/dev widział przyczynę.
          failedPages += slice.length
          if (errorSample.length < 3) {
            const msg = (err?.message ?? String(err)).slice(0, 200)
            errorSample.push(`s.${b + 1}: ${msg}`)
            console.warn('[leaflet-extract]', msg)
          }
        }
      }

      if (merged.length === 0) {
        throw new Error(
          failedPages > 0
            ? `Nie udało się połączyć z serwerem odczytu (${failedPages} stron). Pierwszy błąd: ${errorSample[0] ?? 'nieznany'}`
            : 'Nie znaleziono produktów spożywczych w tej gazetce.'
        )
      }
      if (failedPages > 0) {
        const hint = errorSample[0]?.includes('429')
          ? ' (limit żądań — odczekaj kilka minut i spróbuj ponownie)'
          : errorSample[0]?.includes('502') || errorSample[0]?.includes('504')
          ? ' (timeout serwera AI — spróbuj wgrać ponownie)'
          : ''
        setError(`Odczytano ${merged.length} produktów, ale ${failedPages} stron nie przetworzono${hint}. Szczegóły w konsoli (F12).`)
      }

      // Prefill okresu ważności z odczytanych dat (najczęstsza wartość)
      const mode = (vals: string[]) => {
        const c = new Map<string, number>()
        vals.forEach((v) => c.set(v, (c.get(v) ?? 0) + 1))
        return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
      }
      const froms = merged.map((p) => p.valid_from).filter(Boolean) as string[]
      const tos = merged.map((p) => p.valid_to).filter(Boolean) as string[]
      if (froms.length) setValidFrom(mode(froms))
      if (tos.length) setValidTo(mode(tos))
    } catch (err: any) {
      setError(`Błąd: ${err?.message ?? 'nieznany'}`)
    } finally {
      setExtracting(false)
      setProgress('')
      /* input czyszczony jest w onFile, tu nie ma już zdarzenia */
    }
  }

  // Pola tekstowe/daty trzymamy jako string, ceny parsujemy na liczby
  const STRING_FIELDS = new Set(['name', 'valid_from', 'valid_to', 'condition_note', 'condition_type'])
  const updateProduct = (i: number, field: keyof Product, value: string) => {
    setProducts((prev) => {
      const next = [...prev]
      let v: any
      if (field === 'name') v = value
      else if (STRING_FIELDS.has(field as string)) v = value === '' ? null : value
      else v = value === '' ? null : parseFloat(value.replace(',', '.'))
      next[i] = { ...next[i], [field]: v }
      return next
    })
  }

  // Daty produktu: własne z gazetki -> globalne z formularza -> rozsądny domyślny zakres
  const resolveDates = (p: Product) => {
    const today = new Date().toISOString().slice(0, 10)
    const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return {
      valid_from: p.valid_from || validFrom || today,
      valid_to: p.valid_to || validTo || in7,
    }
  }

  const savePromos = async () => {
    setError('')
    setSavedMsg('')
    const withName = products.filter((p) => p.name && p.price_promo != null)
    const valid = withName.filter((p) => (p.price_promo ?? 0) >= MIN_PRICE)
    const skipped = withName.length - valid.length
    if (!store || valid.length === 0) { setError('Brak produktów do zapisu (po odrzuceniu podejrzanie niskich cen).'); return }
    const supabase = createClient()
    const { error: insErr } = await supabase.from('promo_products').insert(
      valid.map((p) => ({
        store_id: store.id,
        name: p.name,
        price_promo: p.price_promo,
        price_regular: p.price_regular,
        condition_type: p.condition_type ?? 'brak',
        condition_note: p.condition_note ?? null,
        min_quantity: p.min_quantity ?? null,
        ...resolveDates(p),
        recipe_id: null,
      }))
    )
    if (insErr) { setError(`Zapis promocji: ${insErr.message}`); return }
    setSavedMsg(
      `✅ Zapisano ${valid.length} promocji do bazy.` +
        (skipped > 0 ? ` Pominięto ${skipped} z podejrzanie niską ceną (< ${MIN_PRICE.toFixed(2)} zł).` : '') +
        ' Możesz do nich wrócić i generować przepisy także później.'
    )
    refreshSavedCount()
  }

  const payloadFrom = (list: Product[]) =>
    list
      .filter((p) => p.name && p.price_promo != null && (p.price_promo ?? 0) >= MIN_PRICE)
      .map((p) => ({ ...p, ...resolveDates(p) }))
  const promoPayload = () => payloadFrom(products)

  // Jeden szkic dla danego tematu. `used` = produkty już użyte (współdzielenie opakowań).
  // promoOverride = zawężona lista produktów pod konkretny filtr (zestaw 12).
  const generateOne = async (
    themeArg: string,
    used: string[],
    promoOverride?: any[],
    avoidExtra: string[] = []
  ): Promise<{ draft: { id: string; title: string; editUrl: string; hasImage: boolean }; used: string[]; imageWarning?: string }> => {
    const res = await fetch('/api/generate-recipe-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeSlug,
        storeName: store?.name ?? '',
        theme: themeArg,
        promoProducts: promoOverride ?? promoPayload(),
        reuseProducts: used,
        extraAvoidTitles: avoidExtra,
      }),
    })
    const isJson = res.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await res.json().catch(() => ({})) : {}
    if (!res.ok) throw new Error(data.error ?? (res.status === 504 ? 'Timeout serwera — spróbuj ponownie.' : `Błąd (${res.status}).`))
    return {
      draft: { id: data.recipeId, title: data.title, editUrl: data.editUrl, hasImage: !!data.hasImage },
      used: Array.from(new Set([...used, ...(data.usedProducts ?? [])])),
      imageWarning: data.imageWarning ?? undefined,
    }
  }

  const generateDraft = async () => {
    if (promoPayload().length === 0) { setError('Najpierw odczytaj gazetkę lub wczytaj zapisane promocje.'); return }
    setGenerating(true)
    setError('')
    try {
      const r = await generateOne(theme, usedProducts)
      setDrafts((d) => [r.draft, ...d])
      setUsedProducts(r.used)
      setImageNotice(r.imageWarning ?? '')
    } catch (err: any) {
      setError(`Błąd: ${err?.message ?? 'nieznany'}`)
    } finally {
      setGenerating(false)
    }
  }

  // Zestaw 9 klasyków: 3 obiady, 2 fit, 2 zupy, 2 wege.
  //
  // Każdy slot dostaje z góry PRZYPISANE, inne danie z listy klasyków. Wcześniejsze
  // podejście — ten sam temat wysłany trzy razy, w dodatku z prośbą o ponowne użycie
  // tych samych produktów — dawało trzy warianty tego samego obiadu. Model robił
  // dokładnie to, o co go proszono; problem był w zapytaniu, nie w modelu.
  const SLOTY: { tag: SlotTag | null; ile: number; etykieta: string }[] = [
    { tag: null, ile: 3, etykieta: 'polski klasyczny obiad' },
    { tag: 'fit', ile: 2, etykieta: 'polski klasyczny obiad fit' },
    { tag: 'zupa', ile: 2, etykieta: 'polska klasyczna zupa' },
    { tag: 'wege', ile: 2, etykieta: 'polski klasyczny obiad wege' },
  ]

  const generateClassicSet = async () => {
    if (promoPayload().length === 0) { setError('Najpierw odczytaj gazetkę lub wczytaj zapisane promocje.'); return }
    setGenerating(true)
    setError('')
    setSavedMsg('')

    // Tytuły już w katalogu tego sklepu — żeby nie zamawiać dania, które masz
    const supabase = createClient()
    const { data: istniejace } = await supabase
      .from('recipes')
      .select('title')
      .eq('store_id', store?.id ?? '')
      .limit(200)
    const wKatalogu: string[] = (istniejace ?? []).map((r: any) => r.title).filter(Boolean)

    // Dobór dań: nic się nie powtarza ani między slotami, ani z katalogiem
    const zadania: { danie: string; opis: string; etykieta: string }[] = []
    const zajete = [...wKatalogu]
    for (const slot of SLOTY) {
      for (const d of pickDistinctDishes(slot.ile, slot.tag, zajete)) {
        zadania.push({ danie: d.nazwa, opis: d.opis, etykieta: slot.etykieta })
        zajete.push(d.nazwa)
      }
    }

    if (zadania.length === 0) {
      setError('Brak dań do wygenerowania — wszystkie klasyki z tej pory roku są już w katalogu tego sklepu.')
      setGenerating(false)
      return
    }

    let used = [...usedProducts]
    let tytuly: string[] = []
    let failed = 0
    let noImage = 0

    for (let i = 0; i < zadania.length; i++) {
      const z = zadania[i]
      setBatchStatus(`Zestaw klasyków: ${i + 1}/${zadania.length} — ${z.danie}…`)
      const temat =
        `${z.etykieta}: ${z.danie} (${z.opis}). ` +
        'Zrób to danie klasycznie, tak jak się je zna z domu. ' +
        'Tytuł ma być rozpoznawalny od pierwszego spojrzenia.'
      try {
        const r = await generateOne(temat, used, undefined, tytuly)
        used = r.used
        tytuly = [...tytuly, r.draft.title]
        setDrafts((d) => [r.draft, ...d])
        if (r.imageWarning) noImage++
      } catch {
        failed++
      }
    }

    setUsedProducts(used)
    setImageNotice(noImage > 0 ? `${noImage} z ${zadania.length} przepisów powstało bez zdjęcia — dodasz je ręcznie przy akceptacji.` : '')
    setBatchStatus('')
    setGenerating(false)
    if (failed > 0) setError(`Zestaw gotowy, ale ${failed} z ${zadania.length} przepisów się nie udało — spróbuj wygenerować je pojedynczo.`)
    else setSavedMsg(`✅ Wygenerowano ${zadania.length} klasyków — sprawdź i opublikuj.`)
  }

  // Zestaw 12 szkiców — po jednym na każdy filtr serwisu
  const generateSet = async () => {
    if (promoPayload().length === 0) { setError('Najpierw odczytaj gazetkę lub wczytaj zapisane promocje.'); return }
    setGenerating(true)
    setError('')
    setSavedMsg('')
    const pool = products.filter((p) => p.name && p.price_promo != null)
    let used = [...usedProducts]
    let failed = 0
    let noImage = 0
    for (let i = 0; i < SET_SPECS.length; i++) {
      const spec = SET_SPECS[i]
      setBatchStatus(`Generuję zestaw: ${i + 1}/${SET_SPECS.length} — ${spec.label}…`)
      // Mądry dobór produktów pod filtr; fallback do pełnej puli, gdy zostałoby za mało
      let selected = spec.select ? spec.select(pool) : pool
      if (selected.length < 3) selected = pool
      try {
        const r = await generateOne(spec.theme, used, payloadFrom(selected as Product[]))
        used = r.used
        setDrafts((d) => [r.draft, ...d]) // pokazuj na bieżąco
        if (r.imageWarning) noImage++
      } catch {
        failed++
      }
    }
    setUsedProducts(used)
    setImageNotice(noImage > 0 ? `${noImage} z ${SET_SPECS.length} przepisów powstało bez zdjęcia — dodasz je ręcznie przy akceptacji.` : '')
    setBatchStatus('')
    setGenerating(false)
    if (failed > 0) setError(`Zestaw gotowy, ale ${failed} z ${SET_SPECS.length} przepisów się nie udało — spróbuj wygenerować je pojedynczo.`)
    else setSavedMsg(`✅ Wygenerowano zestaw ${SET_SPECS.length} szkiców — sprawdź i opublikuj.`)
  }

  return (
    <div className="space-y-6">
      {/* Krok 1 — odczyt gazetki */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">1</span>
          <h2 className="font-bold text-stone-800">Wczytaj gazetkę</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="lf-store" className="block text-xs font-medium text-stone-600 mb-1">Sklep</label>
            <select
              id="lf-store"
              value={storeSlug}
              onChange={(e) => setStoreSlug(e.target.value)}
              className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-amber-400"
            >
              {stores.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
            </select>
          </div>
          <label className="cursor-pointer flex items-center gap-2 btn-outline text-sm">
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
            {extracting ? 'Odczytuję...' : 'Wgraj zdjęcie / PDF gazetki'}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} disabled={extracting} />
          </label>

          {/* Wykrywanie wydań wprost ze strony sieci — bez szukania i wklejania */}
          <button
            type="button"
            onClick={sprawdzGazetki}
            disabled={szukam || extracting}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#12b76a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0ea25d] disabled:opacity-50"
          >
            {szukam ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
            {szukam ? 'Sprawdzam…' : 'Sprawdź nowe gazetki'}
          </button>

          {dostepne && (
            <div className="mt-3 rounded-xl border border-stone-200 divide-y divide-stone-100">
              {dostepne.length === 0 ? (
                <p className="px-4 py-3 text-sm text-stone-500">Nie znaleziono wydań.</p>
              ) : (
                dostepne.map((g: any) => (
                  <div key={g.strona} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    {/* Nazwa i okres w osobnych kolumnach: przy Lidlu wszystkie
                        wydania nazywają się „Gazetka" i dopiero daty je rozróżniają */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-800">{g.tytul}</p>
                      <p className="text-xs text-stone-500">
                        {g.pdf ? `PDF · ${g.stron ?? '?'} stron` : `${g.obrazy.length} stron`}
                        {g.wciagnieta ? ' · już wciągnięta' : ''}
                      </p>
                    </div>
                    {g.daty && (
                      <span className="flex-shrink-0 whitespace-nowrap rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 tabular-nums">
                        {g.daty}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => wczytajZnaleziona(g)}
                      disabled={extracting}
                      className="flex-shrink-0 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 hover:border-[#12b76a] hover:text-[#12b76a] disabled:opacity-50"
                    >
                      Wczytaj
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Wklejenie adresu oszczędza pobieranie pliku na dysk i szukanie go w oknie wyboru */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              inputMode="url"
              value={adresGazetki}
              onChange={(e) => setAdresGazetki(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') pobierzZAdresu() }}
              placeholder="albo wklej adres PDF-a gazetki ze strony sklepu"
              disabled={extracting}
              className="flex-1 min-w-0 rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm disabled:opacity-50"
            />
            <button
              type="button"
              onClick={pobierzZAdresu}
              disabled={extracting || !adresGazetki.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:border-stone-300 disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" />
              Pobierz
            </button>
          </div>

          {/* Zapisane wcześniej promocje tego sklepu — generuj z nich także w innej sesji */}
          {savedCount != null && savedCount > 0 && (
            <>
              <button
                type="button"
                onClick={loadSavedPromos}
                disabled={loadingSaved || extracting}
                className="flex items-center gap-2 rounded-xl border border-[#12b76a] bg-[#e6f9f0] text-[#0c7d49] text-sm font-semibold px-4 py-2.5 hover:bg-[#c6f2dd] transition-colors disabled:opacity-60"
              >
                {loadingSaved ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                Wczytaj zapisane promocje ({savedCount})
              </button>
              <button
                type="button"
                onClick={deleteAllSaved}
                disabled={loadingSaved || extracting}
                title={`Usuń wszystkie zapisane promocje sklepu ${store?.name ?? ''}`}
                className="flex items-center gap-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold px-4 py-2.5 hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                Usuń zapisane ({savedCount})
              </button>
            </>
          )}
        </div>
        {progress ? (
          <p className="text-xs text-amber-700 font-medium flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {progress}
          </p>
        ) : (
          <p className="text-xs text-stone-400">
            Claude odczyta produkty spożywcze i ceny. Wielostronicowy PDF jest automatycznie dzielony na strony i analizowany partiami.
          </p>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Krok 2 — weryfikacja + zapis promocji */}
      {products.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">2</span>
            <h2 className="font-bold text-stone-800">Sprawdź i zapisz promocje ({products.length})</h2>
          </div>

          {/* Ogólny termin — używany dla produktów bez własnych dat (te ustawiasz w kolumnie „Ważność") */}
          <div className="flex flex-wrap items-end gap-3 bg-stone-50 rounded-xl p-3">
            <div>
              <label htmlFor="le-from" className="block text-xs font-medium text-stone-500 mb-1">Ogólnie ważne od</label>
              <input id="le-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)}
                className="px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm bg-white" />
            </div>
            <div>
              <label htmlFor="le-to" className="block text-xs font-medium text-stone-500 mb-1">Ogólnie ważne do</label>
              <input id="le-to" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)}
                className="px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm bg-white" />
            </div>
            <p className="text-xs text-stone-400 pb-1.5 flex-1 min-w-[200px]">
              {validFrom || validTo
                ? 'Odczytane z gazetki — sprawdź przed zapisem. Po dacie „do" przepisy z tymi produktami znikną ze strony.'
                : 'Gazetka nie podała dat — ustaw ręcznie (domyślnie 7 dni od dziś).'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-stone-500 border-b border-stone-100">
                <tr><th className="py-2 pr-3">Produkt</th><th className="py-2 px-2 w-24">Promo</th><th className="py-2 px-2 w-24">Regularna</th><th className="py-2 px-2 w-48">Ważność</th><th className="w-8" /></tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {products.map((p, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-3">
                      <input value={p.name} onChange={(e) => updateProduct(i, 'name', e.target.value)}
                        className="w-full px-2 py-1.5 border border-stone-200 rounded-lg" />
                      {p.condition_type && p.condition_type !== 'brak' && (
                        <span
                          title={p.condition_note ?? ''}
                          className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${CONDITION_STYLE[p.condition_type]}`}
                        >
                          {CONDITION_LABEL[p.condition_type]}
                          {p.min_quantity ? ` · min. ${p.min_quantity} szt.` : ''}
                          {p.condition_note ? ` — ${p.condition_note}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" step="0.01" value={p.price_promo ?? ''} onChange={(e) => updateProduct(i, 'price_promo', e.target.value)}
                        className="w-full px-2 py-1.5 border border-stone-200 rounded-lg" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" step="0.01" value={p.price_regular ?? ''} onChange={(e) => updateProduct(i, 'price_regular', e.target.value)}
                        className="w-full px-2 py-1.5 border border-stone-200 rounded-lg" />
                    </td>
                    <td className="py-1.5 px-2">
                      {/* Własna ważność promocji tego produktu (pusta = użyty zostanie ogólny termin z góry) */}
                      <div className="flex items-center gap-1">
                        <input
                          type="date"
                          value={p.valid_from ?? ''}
                          onChange={(e) => updateProduct(i, 'valid_from', e.target.value)}
                          className="w-[6.5rem] px-1.5 py-1.5 border border-stone-200 rounded-lg text-xs"
                          aria-label={`Ważne od — ${p.name}`}
                        />
                        <span className="text-stone-300">–</span>
                        <input
                          type="date"
                          value={p.valid_to ?? ''}
                          onChange={(e) => updateProduct(i, 'valid_to', e.target.value)}
                          className="w-[6.5rem] px-1.5 py-1.5 border border-stone-200 rounded-lg text-xs"
                          aria-label={`Ważne do — ${p.name}`}
                        />
                      </div>
                      {!p.valid_from && !p.valid_to && (
                        <span className="text-[11px] text-stone-400">wg terminu ogólnego</span>
                      )}
                    </td>
                    <td className="py-1.5">
                      <button onClick={() => setProducts((prev) => prev.filter((_, j) => j !== i))} aria-label="Usuń" className="text-stone-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {savedMsg && <div className="bg-green-50 text-green-700 text-sm px-4 py-2 rounded-xl">{savedMsg}</div>}
          <button onClick={savePromos} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" /> Zapisz promocje do bazy
          </button>
        </div>
      )}

      {/* Krok 3 — generacja przepisu-szkicu */}
      {products.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">3</span>
            <h2 className="font-bold text-stone-800">Wygeneruj przepis (szkic do akceptacji)</h2>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label htmlFor="lf-theme" className="block text-xs font-medium text-stone-600 mb-1">Temat (opcjonalnie)</label>
              <input id="lf-theme" value={theme} onChange={(e) => setTheme(e.target.value)}
                placeholder="np. obiad z kurczaka, danie jednogarnkowe..."
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-amber-400" />
            </div>
            <button onClick={generateDraft} disabled={generating} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {generating && !batchStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating && !batchStatus ? 'Generuję...' : 'Wygeneruj szkic'}
            </button>
            <button
              onClick={generateSet}
              disabled={generating}
              title="12 przepisów: wege, air fryer, do 15/25/40 zł, obiad, fit, śniadanie, kolacja, szybkie, deser, zupa"
              className="inline-flex items-center gap-2 rounded-xl border border-[#12b76a] bg-[#e6f9f0] text-[#0c7d49] text-sm font-semibold px-4 py-2.5 hover:bg-[#c6f2dd] transition-colors disabled:opacity-50"
            >
              {batchStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Wygeneruj zestaw 12
            </button>
            <button
              onClick={generateClassicSet}
              disabled={generating}
              title="9 przepisów: 3 klasyczne obiady, 2 fit, 2 zupy, 2 wege — każdy inne danie"
              className="inline-flex items-center gap-2 rounded-xl bg-[#12b76a] text-white text-sm font-semibold px-4 py-2.5 hover:bg-[#0ea25d] transition-colors disabled:opacity-50"
            >
              {batchStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Zestaw 9 klasyków
            </button>
          </div>
          {batchStatus && (
            <p className="text-xs font-medium text-[#0c7d49] flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {batchStatus} (nie zamykaj strony)
            </p>
          )}
          <p className="text-xs text-stone-400">Przepisy powstają na bazie produktów z gazetki i zapisują się jako niepublikowane szkice. Zestaw 12 tworzy po jednym przepisie na każdy filtr — to potrwa kilka minut. Zdjęcie generuje się automatycznie; jeśli się nie uda, podmienisz je przy akceptacji.</p>

          {imageNotice && (
            <p className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
              Przepis zapisany, ale bez zdjęcia: {imageNotice}
            </p>
          )}

          {drafts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-stone-50">
              <p className="text-sm font-medium text-stone-700">Wygenerowane szkice do akceptacji:</p>
              {drafts.map((d) => (
                <div key={d.id} className="flex items-center gap-2 flex-wrap">
                  <Link href={d.editUrl ?? `/admin/przepisy/${d.id}`}
                    className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700">
                    <ExternalLink className="w-4 h-4" /> {d.title} — otwórz do akceptacji
                  </Link>
                  {d.hasImage === false && (
                    <span className="text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                      bez zdjęcia
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
