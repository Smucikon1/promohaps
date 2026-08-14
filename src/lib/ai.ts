// Serwerowy moduł AI (Claude Opus 4.8). NIE importować w kodzie klienta.
import Anthropic from '@anthropic-ai/sdk'
// Ten sam próg wiarygodności ceny, co przy liczeniu oszczędności na stronie
import { MIN_PLAUSIBLE_PRICE } from '@/lib/savings'

// Obietnica serwisu: tanio i prosto. Przepis łamiący którykolwiek limit jest
// odrzucany zamiast publikowany — admin generuje ponownie (koszt jednego wywołania).
export const MAX_RECIPE_PRICE = 30
export const MAX_INGREDIENTS = 10

// Składniki „z szafki" — nie doliczamy ich do rachunku, bo nikt nie idzie po sól
// do sklepu dla jednego obiadu. Lista musi być zamknięta: bez niej model kusi się,
// żeby zmieścić się w limicie, wpisując price: null drogiemu mięsu.
// Dopasowanie po CAŁYCH słowach, nie po fragmentach: „makaron" zawiera „mak",
// więc dopasowanie fragmentem uznałoby makaron za darmowy dodatek z szafki
// i zaniżyło kwotę pokazaną użytkownikowi.
const PANTRY_WORDS = new Set([
  'sol', 'soli', 'pieprz', 'pieprzu', 'cukier', 'cukru', 'maka', 'maki',
  'olej', 'oleju', 'oliwa', 'oliwy', 'ocet', 'octu', 'woda', 'wody',
  'przyprawa', 'przyprawy', 'oregano', 'ziola', 'ziol', 'majeranek', 'majeranku',
  'curry', 'tymianek', 'tymianku', 'laurowy', 'laurowe', 'kminek', 'kminku',
  'kurkuma', 'kurkumy', 'cynamon', 'cynamonu', 'gorczyca', 'gorczycy', 'soda',
])

// Frazy, w których pojedyncze słowo byłoby zbyt ryzykowne: samo „mielona" złapałoby
// „wołowinę mieloną", a sama „papryka" — świeżą paprykę za kilka złotych.
const PANTRY_PHRASES = [
  'papryka slodka', 'papryka mielona', 'papryka wedzona', 'papryka ostra',
  'proszek do pieczenia', 'ziola prowansalskie',
]

// Ujednolica polskie znaki, żeby „sól" i „sol" trafiały w ten sam wzorzec
function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ż|ź/g, 'z')
}

function isPantryStaple(name: string): boolean {
  const n = normalize(name)
  if (PANTRY_PHRASES.some((p) => n.includes(p))) return true
  return n.split(/[^a-z0-9]+/).some((w) => PANTRY_WORDS.has(w))
}

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Brak ANTHROPIC_API_KEY w konfiguracji serwera.')
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function firstText(response: any): string {
  const block = response.content?.find((b: any) => b.type === 'text')
  if (!block) throw new Error('Pusta odpowiedź modelu.')
  return block.text
}

// ---------- Generowanie przepisu ----------

export interface GenerateRecipeInput {
  storeSlug: string
  storeName: string
  theme?: string
  categorySlugs?: string[]
  promoProducts?: any[]
  /** Tytuły istniejących przepisów — model ma ich nie powtarzać */
  avoidTitles?: string[]
  /** Produkty użyte w innych przepisach tego tygodnia — warto je wykorzystać ponownie */
  reuseProducts?: string[]
}

// Losowy kierunek kulinarny — bez tego model ciągle proponuje makaron z kurczakiem
const CUISINES = [
  'kuchnia polska domowa', 'włoska', 'azjatycka (stir-fry)', 'meksykańska',
  'śródziemnomorska', 'bliskowschodnia', 'węgierska/bałkańska', 'kuchnia jednogarnkowa',
]
const TECHNIQUES = [
  'zapiekanka z piekarnika', 'danie jednopatelniowe', 'zupa krem', 'gulasz duszony',
  'sałatka na ciepło', 'placki/kotlety smażone', 'danie z blachy', 'makaron z sosem',
]
const MEALS = ['obiad', 'kolacja', 'śniadanie', 'szybki lunch', 'danie na wynos do pracy']

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

// Przepis powstaje dziś i dziś trafia do gazetki, więc ma pasować do pory roku.
// Grzane rosoły w lipcu i zimne sałatki w styczniu odrzucają czytelnika,
// a poza tym sezonowe warzywa są wtedy najtańsze — czyli zgodne z sensem serwisu.
const SEASONS: Record<string, { pora: string; opis: string }> = {
  zima: {
    pora: 'zima',
    opis: 'dania rozgrzewające i sycące: zupy, gulasze, pieczenie, kapusta, buraki, korzeniowe, kiszonki',
  },
  wiosna: {
    pora: 'wiosna',
    opis: 'lżejsze dania, młode warzywa: szparagi, rzodkiewka, botwina, młoda kapusta, szczypiorek, nowalijki',
  },
  lato: {
    pora: 'lato',
    opis: 'dania lekkie i chłodne, krótkie gotowanie: sałatki, grill, chłodniki, pomidory, ogórki, cukinia, owoce sezonowe',
  },
  jesien: {
    pora: 'jesień',
    opis: 'dania cieplejsze, ale nie ciężkie: dynia, grzyby, jabłka, śliwki, pieczone warzywa korzeniowe, kasze',
  },
}

function currentSeason(now = new Date()) {
  const m = now.getMonth() + 1
  if (m === 12 || m <= 2) return SEASONS.zima
  if (m <= 5) return SEASONS.wiosna
  if (m <= 8) return SEASONS.lato
  return SEASONS.jesien
}

export async function generateRecipeJson(input: GenerateRecipeInput): Promise<any> {
  const {
    storeSlug, storeName, theme, categorySlugs = [], promoProducts = [],
    avoidTitles = [], reuseProducts = [],
  } = input

  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      store_slug: { type: 'string', enum: storeSlug ? [storeSlug] : undefined },
      category_slugs: {
        type: 'array',
        items: categorySlugs.length ? { type: 'string', enum: categorySlugs } : { type: 'string' },
      },
      prep_time_min: { type: 'integer' },
      difficulty: { type: 'string', enum: ['latwy', 'sredni', 'trudny'] },
      servings: { type: 'integer' },
      price_total: { type: 'number' },
      meta_title: { type: 'string' },
      meta_description: { type: 'string' },
      // Prompt po angielsku do generatora zdjęć (Flux rozumie angielski znacznie lepiej)
      image_prompt: { type: 'string' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'string' },
            unit: { type: 'string' },
            price: { type: 'number' },
            is_promo_product: { type: 'boolean' },
          },
          required: ['name', 'amount', 'unit', 'price', 'is_promo_product'],
          additionalProperties: false,
        },
      },
      steps: { type: 'array', items: { type: 'string' } },
      promos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            price_promo: { type: 'number' },
            price_regular: { type: 'number' },
            condition_type: { type: 'string', enum: ['brak', 'karta', 'wielosztuka', 'inny'] },
            condition_note: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            min_quantity: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
            valid_from: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            valid_to: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['name', 'price_promo', 'price_regular', 'condition_type', 'condition_note', 'min_quantity', 'valid_from', 'valid_to'],
          additionalProperties: false,
        },
      },
    },
    required: [
      'title', 'slug', 'description', 'store_slug', 'category_slugs', 'prep_time_min',
      'difficulty', 'servings', 'price_total', 'meta_title', 'meta_description',
      'image_prompt', 'ingredients', 'steps', 'promos',
    ],
    additionalProperties: false,
  }

  const system = [
    'Jesteś doświadczonym polskim autorem przepisów dla serwisu o tanim gotowaniu z gazetek promocyjnych.',
    'Tworzysz apetyczne, realistyczne przepisy domowej kuchni z tanich, dostępnych składników.',
    'is_promo_product: true dla składników z promocji/gazetki; meta_title ~60 zn., meta_description ~155 zn.;',
    '',
    'CENY — MYŚL O PARAGONIE, NIE O TALERZU (reguła nadrzędna):',
    'price_total to kwota, jaką użytkownik zapłaci przy kasie, kupując wszystko z listy.',
    'Dlatego price KAŻDEGO składnika = cena CAŁEGO OPAKOWANIA ze sklepowej półki.',
    '  Przykład: przepis używa 200 g twarogu, ale w sklepie leży kostka 250 g za 4,99 zł',
    '  → price = 4.99 (cena kostki), NIE 3,99 za „200 g". Reszta zostaje w lodówce, ale zapłacone jest 4,99.',
    'Nigdy nie licz cen „za zużytą część", „za sztukę z opakowania" ani proporcjonalnie do gramatury.',
    'amount/unit opisuj tak, jak produkt leży na półce (np. „500 g", „1 opakowanie", „6 sztuk"),',
    '  żeby użytkownik mógł porównać cenę z etykietą w sklepie.',
    '- dla składników z gazetki użyj dokładnie ceny promocyjnej z danych wejściowych (price_promo);',
    '- dla pozostałych podaj realistyczną cenę typowego opakowania w polskim sklepie;',
    '',
    'PRODUKTY „Z SZAFKI" — price: null (nie doliczaj ich do rachunku):',
    '  sól, pieprz, cukier, mąka, olej, ocet, woda oraz typowe suszone przyprawy',
    '  (papryka, oregano, zioła prowansalskie, majeranek, curry, tymianek, liść laurowy).',
    '  Tego każdy ma w domu i nikt nie idzie po to do sklepu dla jednego obiadu.',
    '  Ta lista jest ZAMKNIĘTA — każdy inny składnik MUSI mieć realną cenę opakowania.',
    '  Nie wpisuj null masłu, jajkom, śmietanie, serowi, świeżym ziołom ani niczemu spoza listy.',
    '',
    'gdy condition_type="karta", cena wymaga karty/aplikacji lojalnościowej — użyj tej ceny opakowania;',
    'w polach promos KOPIUJ DOKŁADNIE z danych wejściowych: name, ceny, condition_type, condition_note,',
    'min_quantity oraz valid_from i valid_to (nie wymyślaj dat — przy braku daj null).',
    '',
    'OSZCZĘDNOŚĆ (bardzo ważne — to sedno serwisu):',
    'CEL: cena przepisu ma zaskakiwać niskim kosztem, a % oszczędności widoczny użytkownikowi ma być JAK NAJWYŻSZY.',
    'ZASADA WYBORU SKŁADNIKÓW — najpierw analizuj wszystkie pozycje w `produkty_z_gazetki`',
    'i policz dla każdej realną oszczędność w PLN (price_regular − price_promo).',
    'Weź z gazetki TOP produkty o NAJWIĘKSZEJ oszczędności (min. 20% obniżki i sensowna kwota) i uczyń je BAZĄ dania.',
    'CEL POKRYCIA: co najmniej ~70% wartości przepisu (i większość ilościowa składników) MA POCHODZIĆ Z GAZETKI.',
    '  Tylko brakujące uzupełnienia (przyprawy, sól, olej itp.) mogą być spoza gazetki — używaj ich oszczędnie.',
    'ANTY-UBOGI PRZEPIS: mimo taniości danie ma być pełnowartościowe — musi mieć źródło białka (mięso/ryba/strączki/nabiał/jajka),',
    '  bazę węglowodanową (ziemniaki/ryż/makaron/kasza/pieczywo) i warzywa/owoce. Nie tylko sama sałatka z pomidora.',
    '',
    'BUDŻET — TWARDY LIMIT 30 zł NA PARAGONIE (najważniejsza reguła serwisu):',
    '  suma price wszystkich składników (bez tych z price: null) MUSI wyjść ≤ 30 zł. Bez wyjątków.',
    '  Zanim zwrócisz JSON: ZSUMUJ price wszystkich ingredients. Jeśli > 30 zł — przerób przepis.',
    '  Nie mieść się w limicie przez zaniżanie cen ani przez wpisywanie null poza listą „z szafki".',
    '  Jak się zmieścić uczciwie: tańsze białko (mielone/udka/jaja/strączki zamiast piersi, schabu, łososia),',
    '  mniej pozycji spoza gazetki, oprzyj danie na 2–3 produktach promocyjnych zamiast pięciu.',
    'PORCJE dobierz do wielkości kupionych opakowań, nie odwrotnie — skoro kupujesz 500 g mięsa',
    '  i kilogram ziemniaków, to wychodzi obiad dla 4 osób, a nie dla 2. Typowo servings = 4.',
    'PROSTOTA (równie ważna jak cena): 5–8 składników łącznie, maksymalnie 10.',
    '  Zwykłe produkty z każdego sklepu — żadnych niszowych, drogich czy „wymyślnych" dodatków',
    '  (bez pinii, świeżej bazylii poza sezonem, parmezanu, wina do gotowania, egzotycznych przypraw).',
    '  Przyprawy: sól, pieprz, papryka, czosnek, zioła prowansalskie — to ma być kuchnia domowa, nie restauracyjna.',
    'TREŚCIWOŚĆ: mimo budżetu i prostoty danie MA SYCIĆ — porcja realnie zapełnia talerz, nie jest to przekąska.',
    '  Zapewnij min. 400–600 kcal na porcję (nie licz — dobierz składniki: pełne białko + porządny węglowodan',
    '  + warzywo, w rozsądnych ilościach na 4 osoby). Uwaga na sałatki-nic — jeśli sałatka, dodaj ser/mięso/jajko/kaszę.',
    'CENY: składniki spoza gazetki wyceniaj REALISTYCZNIE (cena typowego opakowania, nie zaniżaj).',
    'w polu promos zwróć KAŻDY użyty produkt z gazetki wraz z price_promo ORAZ price_regular',
    '  (bez price_regular nie da się pokazać oszczędności — jeśli była podana, przepisz ją).',
    'slug bez polskich znaków, myślniki; difficulty dokładnie jedno z latwy|sredni|trudny;',
    'nie kopiuj treści gazetek — twórz oryginalny przepis (fakty: nazwy i ceny produktów są dozwolone).',
    '',
    'JAKOŚĆ I RÓŻNORODNOŚĆ (bardzo ważne):',
    '- kroki konkretne i wykonalne: temperatura, czas, wielkość kawałków, na co zwrócić uwagę;',
    '- 5–9 kroków, każdy jedno działanie; bez lania wody i pustych zwrotów;',
    '- description to 1–2 zdania sprzedające danie (smak, tekstura), nie spis składników;',
    '- NIE powtarzaj przepisów z listy „unikaj_tytulow" ani ich wariantów (inny szyk słów to nadal ten sam przepis);',
    '- unikaj oklepanych domyślnych dań (makaron z kurczakiem w śmietanie) — chyba że temat tego wymaga;',
    '- RÓŻNICUJ: białko (drób / wieprzowina / ryba / strączki / jajka / wege) oraz typ dania',
    '  (jednogarnkowe, pieczone, sałatka, zupa, zapiekanka, patelnia, airfryer) — za każdym razem inny zestaw;',
    '- trzymaj się zadanego kierunku (kuchnia, technika, pora posiłku) z pola „wytyczne".',
    '',
    'ZDJĘCIE (image_prompt) — pisz PO ANGIELSKU, 1 zdanie, opis gotowego dania na talerzu:',
    '  co widać (danie + kluczowe składniki), naczynie, tło, światło. Wzór:',
    '  "overhead shot of roast pork loin sliced on a white plate with roasted potatoes and celery,',
    '   fresh parsley, rustic wooden table, soft natural window light, shallow depth of field".',
    '  Bez ludzi, bez rąk, bez napisów i logotypów. Ma wyglądać jak zdjęcie z bloga kulinarnego,',
    '  nie jak render 3D ani zdjęcie stockowe z lat 2000.',
    '',
    'SEZON (pole „sezon" w danych) — przepis czytany jest teraz, więc ma pasować do pory roku:',
    '  charakter dania i warzywa dobieraj do podanej pory. Nie proponuj grzejących gulaszy',
    '  i grochówek w lipcu ani chłodników i sałatek z pomidorów w styczniu.',
    '  Sezonowe warzywa są wtedy najtańsze, więc to gra też na cenę.',
    '  Jeśli pole „temat" narzuca coś innego, temat jest ważniejszy.',
  ].join('\n')

  const season = currentSeason()

  const payload = {
    sklep: { slug: storeSlug, nazwa: storeName },
    sezon: { pora: season.pora, miesiac: new Date().toLocaleDateString('pl-PL', { month: 'long' }), pasuje: season.opis },
    temat: theme || '(dowolny — dobierz apetyczny, tani przepis)',
    wytyczne: theme
      ? '(temat nadrzędny — kieruj się tematem)'
      : { kuchnia: pick(CUISINES), technika: pick(TECHNIQUES), pora: pick(MEALS) },
    dostepne_kategorie: categorySlugs,
    produkty_z_gazetki: promoProducts,
    unikaj_tytulow: avoidTitles.slice(0, 40),
    wykorzystaj_ponownie: reuseProducts.length
      ? {
          produkty: reuseProducts,
          po_co: 'Te produkty są już kupowane do innych przepisów w tym tygodniu — użyj przynajmniej jednego, żeby jedno opakowanie starczyło na dwa dania.',
        }
      : undefined,
    instrukcja: 'Wygeneruj jeden kompletny przepis zgodny ze schematem, wykorzystując produkty z gazetki jako składniki, jeśli podano.',
  }

  // Model bywa rozrzutny mimo instrukcji. Zamiast odrzucać całą generację, dajemy
  // mu drugą szansę z konkretną informacją zwrotną — mieści się w limicie czasu Vercela.
  const messages: any[] = [{ role: 'user', content: JSON.stringify(payload) }]

  for (let attempt = 0; attempt < 2; attempt++) {
    // thinking wyłączone — content generation nie potrzebuje reasoning, a Vercel Hobby ma limit 60s
    const response = await client().messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema }, effort: 'low' },
      system,
      messages,
    } as any)

    if (response.stop_reason === 'refusal') throw new Error('Model odmówił wygenerowania treści.')
    const raw = firstText(response)
    const recipe = JSON.parse(raw)

    // Cena całości liczona deterministycznie z cen składników — model bywa niespójny,
    // a kafelek („Cena całości") i strona przepisu („Razem") muszą pokazywać to samo.
    const sum = (recipe.ingredients ?? []).reduce(
      (acc: number, i: any) => acc + (typeof i?.price === 'number' ? i.price : 0),
      0
    )
    if (sum > 0) recipe.price_total = Math.round(sum * 100) / 100

    const overBudget = recipe.price_total > MAX_RECIPE_PRICE
    const tooManyIngredients = (recipe.ingredients ?? []).length > MAX_INGREDIENTS
    // Bez ceny może zostać wyłącznie sól/pieprz/olej itp. Inaczej rachunek pokazany
    // użytkownikowi byłby niższy od tego, co naprawdę zapłaci przy kasie.
    const unpricedNonStaples = (recipe.ingredients ?? [])
      .filter((i: any) => typeof i?.price !== 'number' && i?.name && !isPantryStaple(i.name))
      .map((i: any) => i.name)

    if (!overBudget && !tooManyIngredients && unpricedNonStaples.length === 0) return recipe

    const problems = [
      overBudget ? `suma wyszła ${recipe.price_total.toFixed(2)} zł (limit ${MAX_RECIPE_PRICE} zł)` : '',
      tooManyIngredients ? `użyto ${recipe.ingredients.length} składników (limit ${MAX_INGREDIENTS})` : '',
      unpricedNonStaples.length
        ? `brak ceny przy składnikach spoza listy „z szafki": ${unpricedNonStaples.join(', ')} — każdy z nich musi mieć cenę opakowania`
        : '',
    ].filter(Boolean).join(' oraz ')

    if (attempt === 1) throw new Error(`Nie udało się zmieścić w limitach: ${problems}. Spróbuj ponownie.`)

    // Druga próba: model widzi własny wynik i wie dokładnie, co poprawić
    messages.push({ role: 'assistant', content: raw })
    messages.push({
      role: 'user',
      content:
        `Ten przepis łamie limity serwisu: ${problems}. ` +
        'Przerób go: tańsze białko, mniej pozycji spoza gazetki, mniejsze opakowania. ' +
        'NIE zaniżaj cen — zmień składniki. Zwróć poprawiony przepis w tym samym formacie.',
    })
  }

  throw new Error('Nie udało się wygenerować przepisu.')
}

// ---------- Odczyt gazetki (wizja) ----------

export interface LeafletImage {
  base64: string
  mediaType: string // image/jpeg | image/png | image/webp
}

export interface ExtractLeafletInput {
  images: LeafletImage[]
  storeName?: string
}

export async function extractLeafletProducts(input: ExtractLeafletInput): Promise<any[]> {
  const { images, storeName = '' } = input
  if (!images?.length) return []

  const schema = {
    type: 'object',
    properties: {
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            price_promo: { type: 'number' },
            price_regular: { anyOf: [{ type: 'number' }, { type: 'null' }] },
            // Warunek promocji: karta lojalnościowa / wielosztuka / brak
            condition_type: { type: 'string', enum: ['brak', 'karta', 'wielosztuka', 'inny'] },
            condition_note: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            min_quantity: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
            // Okres ważności promocji odczytany z gazetki (YYYY-MM-DD) lub null
            valid_from: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            valid_to: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['name', 'price_promo', 'price_regular', 'condition_type', 'condition_note', 'min_quantity', 'valid_from', 'valid_to'],
          additionalProperties: false,
        },
      },
    },
    required: ['products'],
    additionalProperties: false,
  }

  const mediaBlocks = images.map((img) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
  }))

  const many = images.length > 1
  const instruction = [
    `Z załączonych ${many ? `${images.length} stron` : 'strony'} gazetki promocyjnej${storeName ? ` sklepu ${storeName}` : ''}`,
    'wypisz WSZYSTKIE produkty spożywcze wraz z ceną promocyjną (price_promo)',
    'i — jeśli widoczna — ceną regularną (price_regular, inaczej null).',
    'Ignoruj produkty niespożywcze (chemia, AGD itp.) i reklamy. Ceny podawaj jako liczby w PLN.',
    'Nazwy skróć do rozpoznawalnej nazwy produktu (np. „Filet z kurczaka 1kg").',
    'BARDZO WAŻNE — warunki promocji:',
    'condition_type = "karta" gdy cena obowiązuje tylko z kartą/aplikacją lojalnościową',
    '(np. „tylko z kartą Moja Biedronka", „z Lidl Plus", „z aplikacją");',
    'condition_type = "wielosztuka" przy ofertach typu „2+1 gratis", „3 za 2", „drugi -50%",',
    '„przy zakupie 2 szt." — wtedy min_quantity = wymagana liczba sztuk (np. 2 lub 3);',
    'condition_type = "inny" dla innych warunków; "brak" gdy cena obowiązuje bez warunków.',
    'condition_note = dokładny tekst warunku z gazetki (albo null przy braku).',
    'price_promo zawsze podawaj jako cenę ZA JEDNĄ SZTUKĘ przy spełnionym warunku.',
    'CENY I PROMOCJE PROCENTOWE — zawsze wyznacz price_promo ORAZ price_regular w PLN:',
    '• widać obie ceny (regularną i po obniżce) → użyj ich wprost;',
    '• widać CENĘ PO OBNIŻCE + procent (np. „37% TANIEJ" i „4,99") → 4,99 to price_promo,',
    '  a cenę regularną DOLICZ WSTECZ: price_regular = price_promo / (1 − procent/100), zaokrąglij do 2 miejsc',
    '  (np. 4,99 przy −37% → 4,99 / 0,63 ≈ 7,92; 5,99 przy −50% → 5,99 / 0,50 = 11,98);',
    '• widać CENĘ REGULARNĄ + procent (bez ceny po obniżce) → price_promo = price_regular × (1 − procent/100);',
    '• TYLKO gdy nie ma ŻADNEJ ceny w zł (sam procent) → pomiń produkt.',
    'price_promo ZAWSZE jako liczba w PLN, nigdy jako procent. Nie pomijaj produktu tylko dlatego, że brakuje ceny regularnej — dolicz ją.',
    'GDY NIE DA SIĘ USTALIĆ price_regular (brak ceny regularnej i brak procentu) → POMIŃ produkt.',
    '  Promocja bez ceny sprzed obniżki jest dla nas bezużyteczna — nie ma czego porównać.',
    '',
    'UWAGA NA OFERTY WIELOSZTUKOWE — to najczęstszy błąd odczytu:',
    '  „drugi za 1 zł", „druga sztuka 50% taniej", „2+1 gratis", „3 za 2", „przy zakupie 2 szt."',
    '  Cena z takiego napisu (np. owo 1 zł) NIE JEST ceną produktu — to cena kolejnej sztuki.',
    '  Ustaw condition_type="wielosztuka" i min_quantity, a jako price_promo podaj cenę',
    '  PIERWSZEJ sztuki, jeśli jest widoczna. NIGDY nie wpisuj ceny drugiej sztuki jako price_promo',
    '  i nie oznaczaj takiej oferty jako condition_type="brak".',
    `Daty w formacie YYYY-MM-DD (brakujący rok = ${new Date().getFullYear()}).`,
    'PRIORYTET DAT: napis „OFERTA OD dd.mm DO dd.mm" (lub podobny) wydrukowany PRZY danym produkcie to termin TEGO',
    'produktu — użyj go jako valid_from/valid_to, a NIE ogólnego terminu gazetki, nawet gdy różni się od innych produktów.',
    'Dopiero przy całkowitym braku dat przy produkcie użyj ogólnego terminu gazetki; a gdy i tego nie ma — null.',
    many ? 'Nie pomijaj żadnej strony i nie duplikuj tego samego produktu.' : '',
  ].filter(Boolean).join(' ')

  // Vision + JSON schema — thinking wyłączone by zmieścić się w 60s (Vercel Hobby)
  const response = await client().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 8000,
    thinking: { type: 'disabled' },
    output_config: { format: { type: 'json_schema', schema }, effort: 'low' },
    messages: [{ role: 'user', content: [...mediaBlocks, { type: 'text', text: instruction }] }],
  } as any)

  if (response.stop_reason === 'refusal') throw new Error('Model odmówił odczytu.')
  const parsed = JSON.parse(firstText(response))
  const all = Array.isArray(parsed.products) ? parsed.products : []
  return all.filter(isUsablePromo)
}

// Oferty wielosztukowe rozpoznajemy po treści, a nie tylko po tym, co zaklasyfikował
// model: „drugi za 1 zł" potrafi wrócić jako condition_type="brak" z price_promo=1,
// czyli 1 zł ląduje w serwisie jako cena produktu. Tego nie wolno wpuścić.
const MULTIBUY =
  /(\bdrug[aie]\b|\btrzeci\w*\b|\bkolejn\w+\b|\bnastępn\w+\b|\bprzy zakupie\b|\b\d\s*\+\s*\d\b|\b\d\s*za\s*\d\b|\bgratis\b|\bza pół ceny\b|\b\d\s*szt\w*\s*(taniej|w cenie)\b)/i

// Powyżej tego progu „obniżka" to niemal zawsze źle odczytana wielosztuka
// (np. 1 zł przy regularnych 8 zł to −87%). Prawdziwe gazetkowe rabaty rzadko
// przekraczają 70%, a lepiej pominąć okazję niż pokazać zmyśloną cenę.
const MAX_PLAUSIBLE_DISCOUNT = 0.8

export function isUsablePromo(p: any): boolean {
  // 1. Tylko zwykła obniżka albo cena z kartą lojalnościową
  if (p?.condition_type !== 'brak' && p?.condition_type !== 'karta') return false

  // 2. Cena promocyjna musi być wiarygodną kwotą
  if (typeof p.price_promo !== 'number' || p.price_promo < MIN_PLAUSIBLE_PRICE) return false

  // 3. Bez ceny sprzed obniżki nie ma jak pokazać oszczędności — a to sedno serwisu
  if (typeof p.price_regular !== 'number' || p.price_regular <= p.price_promo) return false

  // 4. Wielosztuka przebrana za zwykłą cenę — po nazwie, treści warunku i liczbie sztuk
  if (MULTIBUY.test(`${p.name ?? ''} ${p.condition_note ?? ''}`)) return false
  if (typeof p.min_quantity === 'number' && p.min_quantity > 1) return false

  // 5. Rabat nie z tego świata = najpewniej cena drugiej sztuki
  if (1 - p.price_promo / p.price_regular > MAX_PLAUSIBLE_DISCOUNT) return false

  return true
}
