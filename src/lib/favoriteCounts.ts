import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { CATALOG_TAG } from '@/lib/promoVisibility'

// Ile razy każdy przepis dodano do ulubionych. Anon nie ma wglądu w surowe
// analytics_events, więc czytamy tylko zagregowane liczniki przez funkcję RPC
// recipe_favorite_counts() (SECURITY DEFINER). Cache + tag „katalog”.
//
// Zwracamy TABLICĘ par, nie Map — unstable_cache serializuje wynik do JSON,
// a Map po serializacji staje się pustym obiektem. Caller robi new Map(...).
export const favoriteCounts = unstable_cache(
  async (): Promise<[string, number][]> => {
    const supabase = createPublicClient()
    const { data, error } = await supabase.rpc('recipe_favorite_counts')
    if (error || !Array.isArray(data)) return []
    return data.map((r: any) => [r.recipe_id as string, Number(r.cnt) || 0])
  },
  ['katalog-ulubione'],
  { revalidate: 300, tags: [CATALOG_TAG] }
)
