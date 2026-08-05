// Serwerowy moduł AI (Claude Opus 4.8). NIE importować w kodzie klienta.
import Anthropic from '@anthropic-ai/sdk'

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
      'ingredients', 'steps', 'promos',
    ],
    additionalProperties: false,
  }

  const system = [
    'Jesteś doświadczonym polskim autorem przepisów dla serwisu o tanim gotowaniu z gazetek promocyjnych.',
    'Tworzysz apetyczne, realistyczne przepisy domowej kuchni z tanich, dostępnych składników.',
    'is_promo_product: true dla składników z promocji/gazetki; meta_title ~60 zn., meta_description ~155 zn.;',
    '',
    'CENY (bardzo ważne):',
    '- price składnika = cena CAŁEGO OPAKOWANIA/produktu tak jak sprzedaje go sklep,',
    '  a NIE cena za zużytą porcję ani za sztukę. Kupujący płaci za całe opakowanie.',
    '- dla składników z gazetki użyj dokładnie ceny promocyjnej z danych wejściowych (price_promo);',
    '- dla pozostałych podaj realistyczną cenę typowego opakowania w polskim sklepie;',
    '- price_total = suma cen opakowań wszystkich składników (ile wydasz kupując wszystko do przepisu).',
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
    'BUDŻET DOCELOWY (bardzo ważne): CELUJ w price_total ≤ 30 zł dla całego przepisu (typowo 4 porcje).',
    '  Jeśli przekracza 30 zł — zmniejsz ilości, wybierz tańsze warianty składników z gazetki, zredukuj listę.',
    '  Twardy limit: NIGDY nie przekraczaj 45 zł. Wyjątki (drogie ryby, sery, mięsa) muszą być uzasadnione tematem.',
    'TREŚCIWOŚĆ: mimo budżetu przepis MA SYCIĆ — porcja realnie zapełnia talerz, nie jest to przekąska.',
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
  ].join('\n')

  const payload = {
    sklep: { slug: storeSlug, nazwa: storeName },
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

  // thinking wyłączone — content generation nie potrzebuje reasoning, a Vercel Hobby ma limit 60s
  const response = await client().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 8000,
    thinking: { type: 'disabled' },
    output_config: { format: { type: 'json_schema', schema }, effort: 'low' },
    system,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  } as any)

  if (response.stop_reason === 'refusal') throw new Error('Model odmówił wygenerowania treści.')
  const recipe = JSON.parse(firstText(response))

  // Cena całości liczona deterministycznie z cen składników — model bywa niespójny,
  // a kafelek („Cena całości") i strona przepisu („Razem") muszą pokazywać to samo.
  const sum = (recipe.ingredients ?? []).reduce(
    (acc: number, i: any) => acc + (typeof i?.price === 'number' ? i.price : 0),
    0
  )
  if (sum > 0) recipe.price_total = Math.round(sum * 100) / 100

  return recipe
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
    '(„drugi −50%", „2. sztuka taniej", „2+1 gratis" to condition_type="wielosztuka" — inna kategoria, nie zwykła obniżka.)',
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
  // Bierzemy tylko promocje CENOWE (zwykłą obniżkę, także „z kartą").
  // Odrzucamy wielosztuki/„2+1"/„3 za 2" i inne warunki złożone.
  return all.filter((p: any) => p.condition_type === 'brak' || p.condition_type === 'karta')
}
