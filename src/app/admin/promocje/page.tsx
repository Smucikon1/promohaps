import { createClient } from '@/lib/supabase/server'
import { PromoImport } from '@/components/admin/PromoImport'

export default async function AdminPromoPage() {
  const supabase = await createClient()
  const { data: stores } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
        Import promocji
      </h1>
      <p className="text-sm text-stone-500 mb-8">
        Wklej produkty z gazetki. Zasilą przepisy (ceny, oszczędności) i generator AI.
      </p>
      <PromoImport stores={stores ?? []} />
    </div>
  )
}
