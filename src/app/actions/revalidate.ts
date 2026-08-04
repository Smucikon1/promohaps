'use server'

import { updateTag } from 'next/cache'
import { CATALOG_TAG } from '@/lib/promoVisibility'

// Po zmianie w panelu katalog musi się odświeżyć od razu, zamiast czekać
// na wygaśnięcie cache'u. updateTag (a nie revalidateTag) daje adminowi
// pewność, że zobaczy własną zmianę natychmiast po zapisie.
export async function revalidateCatalog() {
  updateTag(CATALOG_TAG)
}
