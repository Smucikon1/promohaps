// Budowanie promptu do zdjęcia przepisu.
//
// Prompt z generatora (`image_prompt` w ai.ts) nie jest zapisywany w bazie — powstaje
// przy tworzeniu szkicu, idzie prosto do Fluxa i przepada. Dla przepisów, którym
// zdjęcia zabrakło, odtwarzamy go więc z tego, co w bazie zostało: tytułu i składników.
//
// Kierunek fotograficzny jest po ANGIELSKU, bo Flux rozumie angielskie terminy
// fotograficzne nieporównanie lepiej. Nazwa dania zostaje po polsku — tłumaczenie
// „mizerii" czy „kopytek" gubi danie albo tworzy potworka.

export interface PromptIngredient {
  name: string
  price: number | null
}

/** Ile składników wymieniamy w prompcie. Więcej zaśmieca kadr i model zaczyna je gubić. */
const MAX_WIDOCZNYCH = 4

// Kierunek spisany z referencyjnego zdjęcia, które wygląda jak prawdziwa fotografia:
// ujęcie pod kątem (NIE płasko z góry), kremowy talerz w cętki, lniana serweta,
// drugi plan rozmyty, światło z okna z boku.
const SCENA = [
  'three-quarter overhead angle, plated on a cream speckled ceramic plate,',
  'linen napkin under the plate, rustic weathered wooden table,',
  'small ceramic bowls and a glass of water blurred in the background,',
  'soft diffused daylight from a window on the left, shallow depth of field,',
  '50mm lens at f/2.8, natural muted colors, editorial food photography.',
].join(' ')

// Ślady jedzenia — bez nich talerz wygląda jak wizualizacja producenta, a nie obiad.
const REALIZM = [
  'Home-cooked look: uneven portions, scattered fresh herbs,',
  'a few sauce drips on the plate rim, slightly browned edges.',
].join(' ')

// Antyartefakty. „hyperrealistic", „8k" i „ultra detailed" celowo NIE występują —
// pchają obraz w plastikowy render zamiast w fotografię.
const CZEGO_NIE_MA = [
  'No raw or loose ingredients around the plate, no people, no hands,',
  'no text, no labels, no logos, no watermark, no cutlery in motion,',
  'not a 3D render, not oversaturated, not a glossy stock photo.',
].join(' ')

/** Nagłówek pliku eksportu — zasady wspólne dla całej serii, do jednorazowego wklejenia */
export const WSPOLNY_STYL = [SCENA, REALIZM, CZEGO_NIE_MA].join(' ')

// Składniki, które po ugotowaniu przestają być sobą. Mąka staje się kluską, bułka
// tarta panierką — wypisane wprost każą modelowi domalować kopczyk mąki obok dania.
const BAZOWE = ['maka', 'bulka tarta', 'drozdze', 'zelatyna', 'skrobia', 'kasza manna']

const bezPolskich = (s: string) =>
  s.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) =>
    (({ ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' } as any)[c] ?? c))

/** „Jajka L 10 szt." → „jajka”. Gramatura, procenty i rozmiar nic nie znaczą na talerzu. */
function oczyscNazwe(name: string): string {
  return name
    .replace(/\b\d+([.,]\d+)?\s*%/g, ' ')
    .replace(/\b\d+([.,]\d+)?\s*(kg|g|ml|l|dag|szt|opak)\.?\b/gi, ' ')
    .replace(/[.,;:]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    // Samotna litera na końcu to rozmiar (jajka L, M) — nie część nazwy
    .replace(/\s+[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]$/, '')
    .trim()
    .toLowerCase()
}

/**
 * Składniki, z których widać, że to danie.
 *
 * Produkty „z szafki" (sól, pieprz, olej) mają w bazie `price: null` — taka jest
 * reguła generatora — więc odsiewamy je po cenie, bez drugiej listy do utrzymania.
 * Sortujemy malejąco po cenie, bo najdroższy składnik to praktycznie zawsze trzon
 * dania i to on ma dominować w kadrze.
 */
export function widoczneSkladniki(ingredients: PromptIngredient[] = []): string[] {
  return ingredients
    .filter((i) => i?.name && typeof i.price === 'number' && i.price > 0)
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    .map((i) => oczyscNazwe(i.name))
    .filter((n) => n.length > 1 && !BAZOWE.some((b) => bezPolskich(n).includes(b)))
    .slice(0, MAX_WIDOCZNYCH)
}

/** Gotowy, samodzielny prompt dla jednego przepisu */
export function buildImagePrompt(title: string, ingredients: PromptIngredient[] = []): string {
  const widoczne = widoczneSkladniki(ingredients)

  // „Ugotowane i nałożone", a nie „widać składniki": model maluje dosłownie to,
  // co wymienisz, więc sama lista produktów daje surowe warzywa wokół talerza
  // zamiast obiadu. Ta jedna różnica decyduje o tym, czy zdjęcie wygląda jak jedzenie.
  const skladniki = widoczne.length
    ? ` Served on the plate, cooked and plated: ${widoczne.join(', ')}.`
    : ''

  return `Photograph of a finished Polish home-cooked dish: ${title}.${skladniki} ${WSPOLNY_STYL}`
}
