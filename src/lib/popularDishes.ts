// Lista najpopularniejszych polskich dań wraz z doborem i dopasowaniem tytułów.
//
// Osobny moduł, bo korzystają z niego dwa światy: generator przepisów (serwerowy
// `ai.ts`, ciągnący za sobą SDK Anthropica) i strona główna, która pokazuje karuzelę
// klasyków. Import `ai.ts` w komponencie strony wciągałby cały SDK do bundle'a.

const PL_MAP: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
}

/** Ujednolica polskie znaki, żeby „sól" i „sol" trafiały w ten sam wzorzec */
export function normalizePl(s: string): string {
  return String(s ?? '').toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => PL_MAP[c] ?? c)
}

// ---------- Sezon ----------

export type SeasonKey = 'zima' | 'wiosna' | 'lato' | 'jesien'

export function currentSeasonKey(now = new Date()): SeasonKey {
  const m = now.getMonth() + 1
  if (m === 12 || m <= 2) return 'zima'
  if (m <= 5) return 'wiosna'
  if (m <= 8) return 'lato'
  return 'jesien'
}

// ---------- Lista dań ----------

// Ludzie wyszukują „kotlet schabowy" i „gołąbki", nie „tagine z ciecierzycą".
// Przewagą serwisu nad porównywarkami cen są przepisy, więc katalog musi trafiać
// w realne zapytania. Ale popularne danie ma sens tylko wtedy, gdy w tym tygodniu
// wychodzi tanio — a to wiadomo z góry po tym, czy jego trzon jest w gazetce.
export interface PopularDish {
  nazwa: string
  /** Jak chętnie gotuje się to danie w polskich domach — ranking popularności.
   *  5 = kanon obecny w większości domów (schabowy, rosół, pomidorowa),
   *  1 = danie okazjonalne, robione raz na jakiś czas.
   *  Waży dobór: gdy do gazetki pasuje kilka dań, pierwszeństwo ma częściej gotowane. */
  ranga: 1 | 2 | 3 | 4 | 5
  /** Fragmenty nazw produktów (bez polskich znaków) — po nich poznajemy trzon dania
   *  w gazetce. Celowo długie: samo „ser" złapałoby deser, a samo „maka" — makaron. */
  core: string[]
  /** Pory roku, do których danie pasuje. Brak = cały rok. */
  sezon?: SeasonKey[]
}

export const POPULAR_DISHES: PopularDish[] = [
  // --- ranga 5: kanon, gotowany w większości polskich domów ---
  { nazwa: 'kotlet schabowy', ranga: 5, core: ['schab'] },
  { nazwa: 'kotlety mielone', ranga: 5, core: ['mieso mielon', 'mielone wieprz', 'mielone wolow'] },
  { nazwa: 'spaghetti bolognese', ranga: 5, core: ['mieso mielon', 'mielone wieprz', 'passat', 'makaron'] },
  { nazwa: 'zupa pomidorowa', ranga: 5, core: ['passat', 'koncentrat pomidor', 'pomidory w puszce'] },
  { nazwa: 'nalesniki z serem', ranga: 5, core: ['twarog', 'mleko', 'jajk'] },
  { nazwa: 'rosol', ranga: 5, core: ['kurcz', 'wloszczyzn', 'porcja rosolow'], sezon: ['jesien', 'zima', 'wiosna'] },

  // --- ranga 4: bardzo częste, tydzień w tydzień ---
  { nazwa: 'placki ziemniaczane', ranga: 4, core: ['ziemniak'] },
  { nazwa: 'pierogi ruskie', ranga: 4, core: ['twarog', 'ziemniak'] },
  { nazwa: 'udka pieczone', ranga: 4, core: ['udk', 'podudz', 'cwiartk'] },
  { nazwa: 'kurczak pieczony w sosie', ranga: 4, core: ['kurcz', 'filet z kurcz'] },
  { nazwa: 'kotlet z piersi kurczaka', ranga: 4, core: ['filet z kurcz', 'piers z kurcz'] },
  { nazwa: 'klopsiki w sosie pomidorowym', ranga: 4, core: ['mieso mielon', 'mielone wieprz', 'passat', 'koncentrat pomidor'] },
  { nazwa: 'zupa ogorkowa', ranga: 4, core: ['ogorki kiszon', 'ogorek kiszon'] },
  { nazwa: 'golabki', ranga: 4, core: ['mieso mielon', 'mielone wieprz', 'kapust', 'ryz'], sezon: ['jesien', 'zima'] },
  { nazwa: 'bigos', ranga: 4, core: ['kapusta kiszon', 'kielbas'], sezon: ['jesien', 'zima'] },

  // --- ranga 3: solidna klasyka, ale rzadziej niż powyższe ---
  { nazwa: 'schab pieczony', ranga: 3, core: ['schab'] },
  { nazwa: 'kopytka', ranga: 3, core: ['ziemniak', 'maka ziemniacz'] },
  { nazwa: 'kluski slaskie', ranga: 3, core: ['ziemniak', 'maka ziemniacz'] },
  { nazwa: 'potrawka z kurczaka z ryzem', ranga: 3, core: ['kurcz', 'filet z kurcz', 'ryz'] },
  { nazwa: 'makaron w sosie serowym', ranga: 3, core: ['makaron', 'ser zolty', 'serek'] },
  { nazwa: 'zupa pieczarkowa', ranga: 3, core: ['pieczark'] },
  { nazwa: 'salatka jarzynowa', ranga: 3, core: ['marchew', 'majonez', 'wloszczyzn'] },
  { nazwa: 'fasolka po bretonsku', ranga: 3, core: ['fasol', 'kielbas'], sezon: ['jesien', 'zima'] },
  { nazwa: 'gulasz wieprzowy', ranga: 3, core: ['lopatk', 'kark', 'wolow'], sezon: ['jesien', 'zima'] },
  { nazwa: 'barszcz czerwony', ranga: 3, core: ['burak'], sezon: ['jesien', 'zima'] },
  { nazwa: 'krupnik', ranga: 3, core: ['kasza', 'wloszczyzn'], sezon: ['jesien', 'zima'] },
  { nazwa: 'zurek', ranga: 3, core: ['zurek', 'kielbas', 'jajk'], sezon: ['wiosna', 'jesien', 'zima'] },
  { nazwa: 'leczo', ranga: 3, core: ['papryk', 'cukini', 'kielbas'], sezon: ['lato', 'jesien'] },
  { nazwa: 'racuchy z jablkami', ranga: 3, core: ['jablk', 'maka pszen'], sezon: ['lato', 'jesien'] },
  { nazwa: 'makaron z truskawkami', ranga: 3, core: ['truskaw', 'makaron'], sezon: ['lato'] },

  // --- ranga 2: robione od święta albo mocno sezonowo ---
  { nazwa: 'zapiekanka ziemniaczana', ranga: 2, core: ['ziemniak', 'ser zolty', 'kielbas'], sezon: ['jesien', 'zima'] },
  { nazwa: 'zapiekanka z pieczarkami', ranga: 2, core: ['pieczark', 'bagietk', 'ser zolty'] },
  { nazwa: 'ryba po grecku', ranga: 2, core: ['mintaj', 'mirun', 'dorsz'] },
  { nazwa: 'chlodnik', ranga: 2, core: ['botwin', 'burak', 'kefir'], sezon: ['lato'] },
  { nazwa: 'salatka grecka', ranga: 2, core: ['pomidor', 'ogorek', 'ogorki', 'feta'], sezon: ['lato'] },
]

// Nie zawsze klasyk: przy 100% katalog skurczyłby się do tych kilkudziesięciu pozycji
// i zaczął się powtarzać. Reszta idzie starą ścieżką (losowa kuchnia + technika).
const POPULAR_SHARE = 0.7

export interface PopularPick {
  nazwa: string
  /** Pozycja w rankingu popularności (5 = kanon) — do wglądu przy diagnostyce doboru */
  ranga: number
  /** Produkty z gazetki, które czynią to danie tanim — model ma na nich oprzeć przepis */
  matched: string[]
}

// ---------- Dopasowanie tytułów ----------

// Polski odmienia końcówki („w sosie" / „sosem"), więc porównujemy przycięte rdzenie.
// Pięć znaków to kompromis: krócej daje fałszywe trafienia („maka" w „makaronie"),
// dłużej gubi odmianę.
const STEM = 5
const STOPWORDS = new Set(['z', 'w', 'po', 'na', 'do', 'i', 'ze', 'od', 'dla', 'oraz'])

// Przymiotniki z tytułów, które nie mówią nic o tym, CO to za danie. Zostawione
// w porównaniu zbliżałyby do siebie dowolne dwa przepisy („domowy", „szybki").
const FILLER = new Set([
  'domow', 'szybk', 'prost', 'tani', 'pyszn', 'najle', 'przep', 'obiad',
  'danie', 'klasy', 'trady', 'super', 'latwy', 'latwe', 'expre',
])

function stems(text: string): string[] {
  return normalizePl(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map((w) => w.slice(0, STEM))
    .filter((w) => !FILLER.has(w))
}

/** Czy tytuł przepisu przedstawia to konkretne danie — wszystkie rdzenie nazwy w tytule */
export function dishMatchesTitle(dish: PopularDish, title: string): boolean {
  const want = stems(dish.nazwa)
  if (want.length === 0) return false
  const has = normalizePl(title)
  return want.every((w) => has.includes(w))
}

/** Które popularne danie przedstawia ten tytuł (null = żadne z listy) */
export function dishOfTitle(title: string): PopularDish | null {
  return POPULAR_DISHES.find((d) => dishMatchesTitle(d, title)) ?? null
}

/**
 * Czy dwa tytuły to w praktyce ten sam przepis.
 *
 * Liczymy pokrycie względem KRÓTSZEGO tytułu, nie Jaccarda: „Placki ziemniaczane"
 * i „Placki ziemniaczane z sosem czosnkowym" to jedno danie, a Jaccard dałby tu
 * tylko 0,5 i przepuścił duplikat.
 */
export function titlesTooSimilar(a: string, b: string, threshold = 0.6): boolean {
  // Gdy OBA tytuły dają się rozpoznać jako konkretne dania z listy, rozstrzyga
  // tożsamość dania, a nie podobieństwo słów. „Kotlety mielone z ziemniakami"
  // i „Kotlet schabowy z ziemniakami" dzielą dwa słowa z trzech, ale to dwa różne
  // obiady — i akurat to wiemy na pewno, więc nie ma po co tego zgadywać z tekstu.
  const daniA = dishOfTitle(a)
  const daniB = dishOfTitle(b)
  if (daniA && daniB) return daniA.nazwa === daniB.nazwa

  const A = new Set(stems(a))
  const B = new Set(stems(b))
  if (A.size === 0 || B.size === 0) return false
  let wspolne = 0
  for (const w of A) if (B.has(w)) wspolne++
  return wspolne / Math.min(A.size, B.size) >= threshold
}

/** Pierwszy z istniejących tytułów, który jest w praktyce tym samym przepisem */
export function findDuplicateTitle(title: string, existing: string[]): string | null {
  return existing.find((t) => t && titlesTooSimilar(title, t)) ?? null
}

// ---------- Dobór dania do generowania ----------

/**
 * Wybiera popularne danie, które w tym tygodniu wyjdzie tanio.
 *
 * Bramka cenowa siedzi w doborze, nie w odrzucaniu gotowego przepisu: schabowy jest
 * tani wtedy, gdy schab jest w gazetce. Gdy go nie ma — po prostu nie proponujemy
 * schabowego, zamiast generować go i wyrzucać (co kosztowałoby kolejne wywołanie API,
 * a Vercel Hobby daje 60 s na całą trasę).
 *
 * Zwraca null, gdy nic nie pasuje albo gdy wypadła „reszta" — wtedy generator wraca
 * do losowej ścieżki CUISINES/TECHNIQUES/MEALS.
 */
export function pickPopularDish(
  promoProducts: any[] = [],
  avoidTitles: string[] = [],
  now = new Date()
): PopularPick | null {
  if (Math.random() > POPULAR_SHARE) return null

  const season = currentSeasonKey(now)
  const names = (promoProducts ?? [])
    .map((p) => normalizePl(String(p?.name ?? '')))
    .filter(Boolean)
  if (names.length === 0) return null

  const scored = POPULAR_DISHES
    .filter((d) => !d.sezon || d.sezon.includes(season))
    // Danie już obecne w katalogu tego sklepu nie ma po co wracać
    .filter((d) => !avoidTitles.some((t) => dishMatchesTitle(d, t)))
    .map((d) => ({
      dish: d,
      matched: names.filter((n) => d.core.some((c) => n.includes(c))),
      // Liczymy trafione TRZONY, nie produkty: pięć rodzajów makaronu w gazetce
      // nie czyni spaghetti tańszym niż jeden makaron plus jedna passata.
      hits: d.core.filter((c) => names.some((n) => n.includes(c))).length,
    }))
    .filter((x) => x.hits > 0)

  if (scored.length === 0) return null

  // Waga = ranga w rankingu × liczba trafionych trzonów. Oba czynniki muszą zagrać:
  // danie ma być i chętnie gotowane w polskich domach, i tanie w tym konkretnym tygodniu.
  // Schabowy (ranga 5) przy jednym trafieniu waży 5, spaghetti (ranga 5) przy trzech — 15,
  // a chłodnik (ranga 2) przy trzech tylko 6. Nisza musi mieć mocne pokrycie w gazetce,
  // żeby wygrać z kanonem, a kanon bez promocji i tak nie wejdzie (hits > 0 to warunek).
  const waga = (x: (typeof scored)[number]) => x.dish.ranga * x.hits
  const total = scored.reduce((s, x) => s + waga(x), 0)
  let roll = Math.random() * total
  let chosen = scored[scored.length - 1]
  for (const x of scored) {
    roll -= waga(x)
    if (roll <= 0) {
      chosen = x
      break
    }
  }

  return {
    nazwa: chosen.dish.nazwa,
    ranga: chosen.dish.ranga,
    matched: [...new Set(chosen.matched)].slice(0, 8),
  }
}
