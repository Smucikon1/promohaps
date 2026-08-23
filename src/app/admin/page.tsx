import { createClient } from '@/lib/supabase/server'
import { BookOpen, Eye, Store, Tag, Users } from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [
    { count: recipesCount },
    { count: storesCount },
    { count: eventsCount },
    { data: topRecipes },
    { data: sesje },
  ] = await Promise.all([
    supabase.from('recipes').select('*', { count: 'exact', head: true }),
    supabase.from('stores').select('*', { count: 'exact', head: true }),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('analytics_top_recipes').select('*').limit(5),
    // Unikalne wejścia = liczba różnych sesji. PostgREST nie umie COUNT(DISTINCT),
    // więc bierzemy same identyfikatory i liczymy po stronie serwera. Limit 50 000
    // trzyma to w ryzach — przy większym ruchu trzeba będzie widoku w bazie.
    supabase
      .from('analytics_events')
      .select('session_id, created_at')
      .gte(
        'created_at',
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      )
      .limit(50_000),
  ])

  // Ta sama sesja to jedno wejście, choćby kliknęła w serwisie sto razy.
  const odKiedy = (dni: number) => Date.now() - dni * 24 * 60 * 60 * 1000
  const unikalne = (dni?: number) => {
    const prog = dni ? odKiedy(dni) : 0
    const zbior = new Set<string>()
    for (const e of sesje ?? []) {
      if (!e?.session_id) continue
      if (prog && new Date(e.created_at).getTime() < prog) continue
      zbior.add(e.session_id)
    }
    return zbior.size
  }

  const wejsciaLacznie = unikalne()
  const wejscia30 = unikalne(30)
  const wejscia7 = unikalne(7)
  const wejscia1 = unikalne(1)

  const stats = [
    { label: 'Przepisy', value: recipesCount ?? 0, icon: BookOpen, color: 'bg-amber-50 text-amber-600' },
    { label: 'Sklepy', value: storesCount ?? 0, icon: Store, color: 'bg-blue-50 text-blue-600' },
    { label: 'Zdarzenia (30 dni)', value: eventsCount ?? 0, icon: Eye, color: 'bg-green-50 text-green-600' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
          Dashboard
        </h1>
        <Link href="/admin/przepisy/nowy" className="btn-primary">
          + Nowy przepis
        </Link>
      </div>

      {/* Unikalne wejścia — najważniejsza liczba w serwisie, więc dostaje
          osobny kafel i największy stopień pisma. Reszta to konteksty. */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-stone-500">
              <Users className="w-4 h-4 text-[#12b76a]" />
              Unikalne wejścia
            </div>
            <div
              className="mt-2 text-5xl sm:text-6xl font-extrabold leading-none text-stone-900 tabular-nums"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {wejsciaLacznie.toLocaleString('pl-PL')}
            </div>
            <p className="mt-2 text-xs text-stone-400">
              Liczone po sesjach, z ostatnich 90 dni. Obejmuje wyłącznie osoby, które
              zgodziły się na analitykę — ruch bez zgody nie jest zapisywany.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-stone-100 pt-4">
          {[
            { etykieta: 'dziś', wartosc: wejscia1 },
            { etykieta: '7 dni', wartosc: wejscia7 },
            { etykieta: '30 dni', wartosc: wejscia30 },
          ].map((x) => (
            <div key={x.etykieta}>
              <div className="text-xl font-bold text-stone-800 tabular-nums">
                {x.wartosc.toLocaleString('pl-PL')}
              </div>
              <div className="text-xs text-stone-500">{x.etykieta}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-stone-100 p-5">
            <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-stone-800">{stat.value}</div>
            <div className="text-sm text-stone-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Top przepisy */}
      {topRecipes && topRecipes.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 p-5">
          <h2 className="font-bold text-stone-800 mb-4">🔥 Najpopularniejsze przepisy (30 dni)</h2>
          <div className="space-y-2">
            {(() => {
              const maxViews = Math.max(...topRecipes.map((r: any) => r.views || 0), 1)
              return topRecipes.map((r: any, i: number) => (
                <div key={r.id} className="flex items-center gap-3 py-2 border-b border-stone-50 last:border-0">
                  <span className="text-lg font-bold text-stone-300 w-6">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-700 text-sm truncate">{r.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${((r.views || 0) / maxViews) * 100}%`, minWidth: '4px' }} />
                      <span className="text-xs text-stone-400 flex-shrink-0">{r.store_name}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-amber-600">{r.views} ×</span>
                </div>
              ))
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
