import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'

export const CATALOG_TAG = 'katalog'

// Przepis znika ze strony, gdy JAKAKOLWIEK jego promocja wygasła —
// nieaktualna cena podważa wiarygodność całego przepisu.
//
// unstable_cache + klient bez ciasteczek: wynik żyje MIĘDZY żądaniami,
// więc kliknięcie w filtr nie odpytuje o to Supabase od nowa.
export const expiredRecipeIds = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createPublicClient()
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('promo_products')
      .select('recipe_id')
      .lt('valid_to', today)
      .not('recipe_id', 'is', null)
    return Array.from(new Set((data ?? []).map((r: any) => r.recipe_id).filter(Boolean))) as string[]
  },
  ['katalog-wygasle'],
  { revalidate: 300, tags: [CATALOG_TAG] }
)
