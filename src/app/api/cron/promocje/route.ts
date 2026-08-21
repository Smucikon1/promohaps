import { createServiceClient } from '@/lib/supabase/service'
import { powiadomAdmina } from '@/lib/notify'
import { createRecipeDraft } from '@/lib/createDraft'

export const runtime = 'nodejs'
export const maxDuration = 60

// Sklepy, których pilnujemy. Dodanie kolejnego to dopisanie sluga.
const PILNOWANE = ['biedronka', 'lidl']

// Poniżej tylu aktywnych promocji uznajemy, że sklepowi skończyła się gazetka
// i trzeba wgrać nową. Kilka pojedynczych pozycji o dłuższym terminie potrafi
// zostać po poprzednim wydaniu, więc próg jest wyższy od zera.
const PROG_BRAKU = 5

// Powyżej tylu nieprzejrzanych szkiców przestajemy dogenerowywać. Kolejka, której
// nikt nie akceptuje, nie jest automatyzacją tylko rosnącym długiem — a przy każdym
// szkicu płacisz za wywołanie API.
const MAX_KOLEJKA = 15

// Vercel ubija funkcję po 60 s. Zostawiamy margines na zapisy do bazy i maila.
const BUDZET_MS = 52_000
// Po tym czasie nie zaczynamy już zdjęcia — flux zwykle schodzi w 2–5 s, ale
// Prefer: wait pozwala mu czekać do 25 s i wtedy nie zmieścilibyśmy się w budżecie.
const PROG_ZDJECIA_MS = 26_000

const dzis = () => new Date().toISOString().slice(0, 10)

/**
 * Zadanie cykliczne: sprząta wygasłe promocje, dogenerowuje jeden przepis
 * i melduje mailem, co się wydarzyło.
 *
 * KASOWANIE JEST CELOWO WĄSKIE — tylko promocje bez `recipe_id`, czyli surowy zaczyn
 * z gazetki. Promocje przypięte do przepisu zostają NA ZAWSZE, bo `regularPrice()`
 * odzyskuje z nich rabat, żeby po wygaśnięciu pokazać cenę regularną, a strona
 * przepisu buduje z nich baner „promocja wygasła". Skasowanie ich przywróciłoby
 * masowe 404-ki, które usuwaliśmy wcześniej.
 *
 * JEDEN PRZEPIS NA URUCHOMIENIE — Vercel Hobby daje jednego crona dziennie i 60 s
 * na wywołanie, co akurat starcza na przepis ze zdjęciem. Siedem tygodniowo bez
 * udziału człowieka to sensowne tempo publikacji.
 */
export async function GET(request: Request) {
  const start = Date.now()
  const uplynelo = () => Date.now() - start

  // Vercel dokłada ten nagłówek, gdy w projekcie ustawiony jest CRON_SECRET.
  // Bez sekretu trasa jest publiczna, a kasuje dane — więc wtedy jej nie wpuszczamy.
  const sekret = process.env.CRON_SECRET
  if (!sekret) {
    return Response.json({ error: 'Brak CRON_SECRET — trasa wyłączona.' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${sekret}`) {
    return Response.json({ error: 'Brak autoryzacji.' }, { status: 401 })
  }

  let supabase
  try {
    supabase = createServiceClient()
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }

  const dzien = dzis()

  // --- 1. Sprzątanie wygasłego zaczynu ---
  const { data: doKasacji, error: selErr } = await supabase
    .from('promo_products')
    .select('id')
    .is('recipe_id', null)
    .lt('valid_to', dzien)

  if (selErr) {
    return Response.json({ error: `Odczyt promocji: ${selErr.message}` }, { status: 500 })
  }

  const ids = (doKasacji ?? []).map((p: any) => p.id)
  let skasowane = 0
  if (ids.length > 0) {
    // Kasujemy po konkretnych identyfikatorach, a nie powtórzonym warunkiem —
    // dzięki temu usuwamy dokładnie to, co przed chwilą policzyliśmy, i liczba
    // w raporcie zgadza się z tym, co zniknęło z bazy.
    const { error: delErr } = await supabase.from('promo_products').delete().in('id', ids)
    if (delErr) {
      return Response.json({ error: `Kasowanie: ${delErr.message}` }, { status: 500 })
    }
    skasowane = ids.length
  }

  // --- 2. Którym sklepom skończyła się gazetka ---
  const { data: sklepy } = await supabase
    .from('stores')
    .select('id, slug, name')
    .in('slug', PILNOWANE)

  const stan: { id: string; slug: string; sklep: string; aktywnych: number; brakuje: boolean }[] = []
  for (const s of sklepy ?? []) {
    const { count } = await supabase
      .from('promo_products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', s.id)
      .is('recipe_id', null)
      .gte('valid_to', dzien)

    const aktywnych = count ?? 0
    stan.push({ id: s.id, slug: s.slug, sklep: s.name, aktywnych, brakuje: aktywnych < PROG_BRAKU })
  }

  // --- 3. Dogenerowanie jednego przepisu ---
  // Sklep z największą liczbą aktywnych promocji — tam przepis wyjdzie najtaniej
  // i najbardziej gazetkowo.
  const najlepszy = [...stan].sort((a, b) => b.aktywnych - a.aktywnych)[0]

  const { count: wKolejce } = await supabase
    .from('recipes')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', false)

  let generacja: any = { zrobiono: false, powod: '' }

  if (!najlepszy || najlepszy.aktywnych < PROG_BRAKU) {
    generacja.powod = 'brak aktualnych promocji w żadnym pilnowanym sklepie'
  } else if ((wKolejce ?? 0) >= MAX_KOLEJKA) {
    generacja.powod = `w kolejce czeka już ${wKolejce} nieprzejrzanych szkiców (limit ${MAX_KOLEJKA})`
  } else if (uplynelo() > BUDZET_MS / 2) {
    generacja.powod = 'sprzątanie zajęło za dużo czasu, generowanie odpuszczone do jutra'
  } else {
    try {
      const { data: promo } = await supabase
        .from('promo_products')
        .select('name, price_promo, price_regular, condition_type, condition_note, min_quantity, valid_from, valid_to')
        .eq('store_id', najlepszy.id)
        .is('recipe_id', null)
        .gte('valid_to', dzien)
        .order('valid_to', { ascending: true })
        .limit(60)

      const wynik = await createRecipeDraft(supabase, {
        storeSlug: najlepszy.slug,
        storeName: najlepszy.sklep,
        promoProducts: promo ?? [],
        imageDeadline: start + PROG_ZDJECIA_MS,
      })

      generacja = {
        zrobiono: true,
        tytul: wynik.title,
        sklep: najlepszy.sklep,
        zeZdjeciem: wynik.hasImage,
        editUrl: wynik.editUrl,
        uwaga: wynik.imageWarning,
      }
    } catch (e: any) {
      // Nieudana generacja nie może zepsuć sprzątania, które już się powiodło
      generacja = { zrobiono: false, powod: `błąd generowania: ${e?.message ?? 'nieznany'}` }
    }
  }

  // --- 4. Powiadomienie ---
  const bezGazetki = stan.filter((s) => s.brakuje)
  const wartoPisac = bezGazetki.length > 0 || generacja.zrobiono
  let mail: any = { wyslany: false, powod: 'nie było o czym informować' }

  if (wartoPisac) {
    const linie: string[] = []

    if (generacja.zrobiono) {
      linie.push(
        `Nowy szkic: „${generacja.tytul}" (${generacja.sklep})`,
        generacja.zeZdjeciem ? '  ze zdjęciem' : '  BEZ zdjęcia — trzeba dodać ręcznie',
        `  https://zgazetki.pl${generacja.editUrl}`,
        ''
      )
    }

    if (bezGazetki.length > 0) {
      linie.push(
        'Tym sklepom skończyły się aktualne promocje:',
        ...bezGazetki.map((s) => `  • ${s.sklep} — aktywnych pozycji: ${s.aktywnych}`),
        '',
        'Wgraj nową gazetkę: https://zgazetki.pl/admin/gazetka',
        ''
      )
    }

    linie.push(
      `Skasowano wygasłych promocji: ${skasowane}.`,
      `Szkiców w kolejce do akceptacji: ${wKolejce ?? 0}.`
    )
    if (!generacja.zrobiono && generacja.powod) {
      linie.push(`Nie wygenerowano przepisu: ${generacja.powod}.`)
    }

    const temat = generacja.zrobiono
      ? `zGazetki: nowy szkic „${generacja.tytul}"`
      : `zGazetki: ${bezGazetki.map((s) => s.sklep).join(', ')} bez aktualnej gazetki`

    mail = await powiadomAdmina(temat, linie.join('\n'))
  }

  return Response.json({
    data: dzien,
    skasowaneWygasle: skasowane,
    stan: stan.map(({ sklep, aktywnych, brakuje }) => ({ sklep, aktywnych, brakuje })),
    wKolejce: wKolejce ?? 0,
    generacja,
    mail,
    czasMs: uplynelo(),
  })
}
