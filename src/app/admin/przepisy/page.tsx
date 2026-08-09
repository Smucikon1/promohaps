import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { RecipeBulkTable } from '@/components/admin/RecipeBulkTable'
import { Plus } from 'lucide-react'

interface Props {
  searchParams: Promise<{ saved?: string; status?: string }>
}

export default async function AdminRecipesPage({ searchParams }: Props) {
  const { saved, status } = await searchParams
  const supabase = await createClient()
  const { data: all } = await supabase
    .from('recipes')
    .select('*, store:stores(name, slug)')
    .order('created_at', { ascending: false })

  const recipes = all ?? []
  const drafts = recipes.filter((r: any) => !r.is_published)
  const published = recipes.filter((r: any) => r.is_published)

  const view = status === 'draft' ? drafts : status === 'published' ? published : recipes

  const tabs = [
    { key: '', label: 'Wszystkie', count: recipes.length, href: '/admin/przepisy' },
    { key: 'draft', label: 'Szkice', count: drafts.length, href: '/admin/przepisy?status=draft' },
    { key: 'published', label: 'Opublikowane', count: published.length, href: '/admin/przepisy?status=published' },
  ]
  const activeKey = status === 'draft' ? 'draft' : status === 'published' ? 'published' : ''

  return (
    <div>
      {saved && (
        <div role="status" className="mb-6 bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">
          {saved === 'new' ? '✅ Przepis został utworzony.' : '✅ Zmiany zostały zapisane.'}
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
          Przepisy
        </h1>
        <Link href="/admin/przepisy/nowy" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nowy przepis
        </Link>
      </div>

      {/* Filtr statusu — kolejka szkiców do akceptacji */}
      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              'inline-flex items-center gap-2 text-sm font-medium px-3.5 py-1.5 rounded-full border transition-colors',
              activeKey === t.key
                ? 'bg-amber-500 text-white border-transparent'
                : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
            )}
          >
            {t.label}
            <span className={cn('text-xs', activeKey === t.key ? 'text-white/90' : 'text-stone-400')}>{t.count}</span>
          </Link>
        ))}
      </div>

      {view.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-stone-500">
              {activeKey === 'draft' ? 'Brak szkiców do akceptacji.' : 'Brak przepisów.'}
            </p>
          </div>
        </div>
      ) : (
        // key = zakładka: przełączenie filtra czyści zaznaczenie, żeby akcja zbiorcza
        // nie objęła przepisów, których użytkownik już nie widzi na ekranie
        <RecipeBulkTable key={activeKey} recipes={view} />
      )}
    </div>
  )
}
