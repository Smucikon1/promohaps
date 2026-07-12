import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const PERIODS = [
  { value: 7, label: '7 dni' },
  { value: 30, label: '30 dni' },
  { value: 90, label: '90 dni' },
]

interface Props {
  searchParams: Promise<{ period?: string }>
}

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const { period } = await searchParams
  const parsed = parseInt(period ?? '', 10)
  const days = PERIODS.some((p) => p.value === parsed) ? parsed : 30

  const supabase = await createClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: views },
    { count: events },
    { data: topRecipes },
    { data: topStores },
    { data: topSearches },
  ] = await Promise.all([
    supabase.from('analytics_events').select('*', { count: 'exact', head: true })
      .eq('event_type', 'recipe_view').gte('created_at', since),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true })
      .gte('created_at', since),
    supabase.from('analytics_top_recipes').select('*').limit(10),
    supabase.from('analytics_top_stores').select('*').limit(10),
    supabase.from('analytics_top_searches').select('*').limit(10),
  ])

  const maxRecipeViews = Math.max(...(topRecipes ?? []).map((r: any) => r.views || 0), 1)
  const maxStoreClicks = Math.max(...(topStores ?? []).map((s: any) => s.clicks || 0), 1)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
          Analityka
        </h1>
        {/* Wybór okresu */}
        <div className="flex gap-1 bg-white border border-stone-100 rounded-xl p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/admin/analityka?period=${p.value}`}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                p.value === days ? 'bg-amber-500 text-white' : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {[
          { label: `Wyświetlenia przepisów (${days} dni)`, value: views ?? 0 },
          { label: `Wszystkie zdarzenia (${days} dni)`, value: events ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-stone-100 p-5">
            <div className="text-2xl font-bold text-stone-800">{stat.value.toLocaleString('pl-PL')}</div>
            <div className="text-sm text-stone-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top przepisy */}
        <div className="bg-white rounded-2xl border border-stone-100 p-5">
          <h2 className="font-bold text-stone-800 mb-4">🔥 Top przepisy</h2>
          {topRecipes?.length === 0 && <p className="text-stone-500 text-sm">Brak danych</p>}
          <div className="space-y-2">
            {topRecipes?.map((r: any, i: number) => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-stone-50 last:border-0">
                <span className="text-sm font-bold text-stone-300 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-700 text-sm truncate">{r.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${((r.views || 0) / maxRecipeViews) * 100}%`, minWidth: '4px' }} />
                    <span className="text-xs text-stone-400 flex-shrink-0">{r.store_name}</span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-amber-600 flex-shrink-0">{r.views}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top sklepy */}
        <div className="bg-white rounded-2xl border border-stone-100 p-5">
          <h2 className="font-bold text-stone-800 mb-4">🏪 Top sklepy</h2>
          {topStores?.length === 0 && <p className="text-stone-500 text-sm">Brak danych</p>}
          <div className="space-y-2">
            {topStores?.map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b border-stone-50 last:border-0">
                <span className="text-sm font-bold text-stone-300 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-700 text-sm">{s.name}</p>
                  <div className="h-1.5 rounded-full bg-amber-400 mt-1" style={{ width: `${((s.clicks || 0) / maxStoreClicks) * 100}%`, minWidth: '4px' }} />
                </div>
                <span className="text-sm font-semibold text-amber-600 flex-shrink-0">{s.clicks}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top wyszukiwania */}
        <div className="bg-white rounded-2xl border border-stone-100 p-5 md:col-span-2">
          <h2 className="font-bold text-stone-800 mb-4">🔍 Najczęstsze wyszukiwania</h2>
          {topSearches?.length === 0 && <p className="text-stone-500 text-sm">Brak danych</p>}
          <div className="flex flex-wrap gap-2">
            {topSearches?.map((s: any) => (
              <span key={s.query} className="inline-flex items-center gap-2 bg-stone-50 text-stone-700 text-sm px-3 py-1.5 rounded-full">
                {s.query}
                <span className="text-xs text-stone-400 font-medium">{s.count}×</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-stone-400 mt-6">
        Rankingi „Top" pokazują dane z ostatnich 30 dni (zdefiniowane w bazie). Wybór okresu powyżej dotyczy wskaźników KPI.
      </p>
    </div>
  )
}
