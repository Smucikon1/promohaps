import { createServiceClient } from '@/lib/supabase/service'
import { powiadomAdmina } from '@/lib/notify'

export const runtime = 'nodejs'
export const maxDuration = 60

// Sklepy, których pilnujemy. Dodanie kolejnego to dopisanie sluga.
const PILNOWANE = ['biedronka', 'lidl']

// Poniżej tylu aktywnych promocji uznajemy, że sklepowi skończyła się gazetka
// i trzeba wgrać nową. Kilka pojedynczych pozycji o dłuższym terminie potrafi
// zostać po poprzednim wydaniu, więc próg jest wyższy od zera.
const PROG_BRAKU = 5

const dzis = () => new Date().toISOString().slice(0, 10)

/**
 * Zadanie cykliczne: sprząta wygasłe promocje i melduje, którym sklepom
 * skończyła się gazetka.
 *
 * KASOWANIE JEST CELOWO WĄSKIE — tylko promocje bez `recipe_id`, czyli surowy zaczyn
 * z gazetki używany do generowania. Promocje przypięte do przepisu zostają NA ZAWSZE,
 * bo `regularPrice()` odzyskuje z nich rabat, żeby po wygaśnięciu pokazać cenę
 * regularną, a strona przepisu buduje z nich baner „promocja wygasła". Skasowanie ich
 * przywróciłoby masowe 404-ki, które usuwaliśmy wcześniej.
 */
export async function GET(request: Request) {
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

  const stan: { sklep: string; aktywnych: number; brakuje: boolean }[] = []
  for (const s of sklepy ?? []) {
    const { count } = await supabase
      .from('promo_products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', s.id)
      .is('recipe_id', null)
      .gte('valid_to', dzien)

    const aktywnych = count ?? 0
    stan.push({ sklep: s.name, aktywnych, brakuje: aktywnych < PROG_BRAKU })
  }

  // --- 3. Powiadomienie ---
  const bezGazetki = stan.filter((s) => s.brakuje)
  let mail: any = { wyslany: false, powod: 'nie było o czym informować' }

  if (bezGazetki.length > 0) {
    const tresc = [
      'Tym sklepom skończyły się aktualne promocje w bazie zGazetek:',
      '',
      ...bezGazetki.map((s) => `  • ${s.sklep} — aktywnych pozycji: ${s.aktywnych}`),
      '',
      'Wgraj nową gazetkę: https://zgazetki.pl/admin/gazetka',
      '',
      `Przy okazji skasowano wygasłych promocji: ${skasowane}.`,
      '',
      'Stan pozostałych sklepów:',
      ...stan.filter((s) => !s.brakuje).map((s) => `  • ${s.sklep} — ${s.aktywnych} aktywnych`),
    ].join('\n')

    mail = await powiadomAdmina(
      `zGazetki: ${bezGazetki.map((s) => s.sklep).join(', ')} bez aktualnej gazetki`,
      tresc
    )
  }

  return Response.json({
    data: dzien,
    skasowaneWygasle: skasowane,
    stan,
    mail,
  })
}
