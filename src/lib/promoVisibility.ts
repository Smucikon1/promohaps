// Przepis znika ze strony, gdy JAKAKOLWIEK jego promocja wygasła —
// nieaktualna cena podważa wiarygodność całego przepisu.

export async function expiredRecipeIds(supabase: any): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('promo_products')
    .select('recipe_id')
    .lt('valid_to', today)
    .not('recipe_id', 'is', null)
  return Array.from(new Set((data ?? []).map((r: any) => r.recipe_id).filter(Boolean))) as string[]
}
