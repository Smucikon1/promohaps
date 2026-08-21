// Tytuły przepisów już obecnych w katalogu — podstawa wykrywania powtórek.

/** Ile ostatnich tytułów bierzemy pod uwagę przy sprawdzaniu duplikatów */
const LIMIT = 60

/**
 * Tytuły przepisów TEGO sklepu, od najnowszych.
 *
 * Zawężenie do sklepu jest celowe: ten sam schabowy w Biedronce i w Lidlu to dwa
 * osobne przepisy z innych gazetek, innymi cenami i osobnymi stronami w katalogu.
 * Blokowanie drugiego z nich zubażałoby ofertę sklepu bez żadnego zysku dla czytelnika.
 *
 * Gdy sklepu nie da się ustalić, wracamy do puli globalnej — lepiej sprawdzić za
 * szeroko niż wpuścić duplikat.
 */
export async function fetchStoreTitles(supabase: any, storeId?: string | null): Promise<string[]> {
  let q = supabase
    .from('recipes')
    .select('title')
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  if (storeId) q = q.eq('store_id', storeId)

  const { data } = await q
  return (data ?? []).map((r: any) => r.title).filter(Boolean)
}
