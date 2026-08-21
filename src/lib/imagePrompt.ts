// Budowanie promptu do ręcznego wygenerowania zdjęcia przepisu.
//
// Prompt z generatora (`image_prompt` w ai.ts) nie jest zapisywany w bazie — powstaje
// przy tworzeniu szkicu, idzie prosto do Fluxa i przepada. Dla przepisów, którym
// zdjęcia zabrakło, odtwarzamy go więc z tego, co w bazie zostało: tytułu i składników.
//
// Prompt jest po polsku celowo. Tłumaczenie „mizerii", „kopytek" czy „klusek śląskich"
// na angielski gubi danie albo tworzy potworka, a ChatGPT rozumie polski bez problemu.

export interface PromptIngredient {
  name: string
  price: number | null
}

/** Ile składników wymieniamy w prompcie. Więcej zaśmieca kadr i model zaczyna je gubić. */
const MAX_WIDOCZNYCH = 4

// Wspólna część stylu. Trafia do każdego promptu, żeby zdjęcia z różnych dni
// wyglądały jak jedna sesja, a nie zbieranina.
const STYL = [
  'Rustykalny drewniany stół, miękkie naturalne światło z okna z lewej strony,',
  'płytka głębia ostrości, kadr z góry pod lekkim kątem, obiektyw 50 mm, f/2.8.',
].join(' ')

// Antyartefakty. Ręce i palce to najczęstszy wpadkowy element AI, napisy i logotypy
// wychodzą jako bełkot, a „hiperrealistyczny 8k" pcha obraz w plastikowy render —
// dlatego prosimy o zwykłą fotografię, nie o maksymalną jakość.
const REALIZM = [
  'Danie ma wyglądać na zrobione w domu: naturalne nierówności, okruchy,',
  'lekkie przypieczenia, nierówno nałożone porcje, ślady sosu na talerzu.',
  'Bez ludzi, bez rąk i palców, bez napisów, etykiet, logotypów i znaków wodnych.',
  'Bez sztućców w ruchu, bez idealnej symetrii.',
  'Zwykła realistyczna fotografia kulinarna do artykułu — nie render 3D,',
  'nie grafika cyfrowa, nie zdjęcie stockowe, bez efektu przesadnej ostrości.',
].join(' ')

/** Nagłówek pliku — zasady wspólne dla całej serii, do jednorazowego wklejenia */
export const WSPOLNY_STYL = [STYL, REALIZM].join(' ')

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
  // „Przygotowane z", a nie „na talerzu widać": część składników zmienia postać
  // podczas gotowania, a dosłowne „widać jajka" przy schabowym każe modelowi
  // położyć obok kotleta surowe jajko.
  const skladniki = widoczne.length
    ? ` Danie przygotowane z: ${widoczne.join(', ')}.`
    : ''

  return `Zdjęcie kulinarne gotowego dania: ${title}.${skladniki} ${WSPOLNY_STYL}`
}
