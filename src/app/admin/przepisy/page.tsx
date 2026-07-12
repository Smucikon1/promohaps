import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatPrice, formatTime } from '@/lib/utils'
import { DeleteRecipeButton } from '@/components/admin/DeleteRecipeButton'
import { Edit, Plus } from 'lucide-react'

interface Props {
  searchParams: Promise<{ saved?: string }>
}

export default async function AdminRecipesPage({ searchParams }: Props) {
  const { saved } = await searchParams
  const supabase = await createClient()
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*, store:stores(name, slug)')
    .order('created_at', { ascending: false })

  return (
    <div>
      {saved && (
        <div role="status" className="mb-6 bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">
          {saved === 'new' ? '✅ Przepis został utworzony.' : '✅ Zmiany zostały zapisane.'}
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
          Przepisy ({recipes?.length ?? 0})
        </h1>
        <Link href="/admin/przepisy/nowy" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nowy przepis
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        {recipes?.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-stone-500">Brak przepisów. Dodaj pierwszy!</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-stone-500">Przepis</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500 hidden md:table-cell">Sklep</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500 hidden lg:table-cell">Cena</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500 hidden lg:table-cell">Czas</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {recipes?.map((recipe: any) => (
                <tr key={recipe.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-stone-800 line-clamp-1">{recipe.title}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{recipe.slug}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-stone-600">{recipe.store?.name ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell text-stone-600">
                    {formatPrice(recipe.price_total)}
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell text-stone-600">
                    {formatTime(recipe.prep_time_min)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      recipe.is_published
                        ? 'bg-green-100 text-green-700'
                        : 'bg-stone-100 text-stone-500'
                    }`}>
                      {recipe.is_published ? 'Opublikowany' : 'Szkic'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/admin/przepisy/${recipe.id}`}
                        aria-label={`Edytuj przepis ${recipe.title}`}
                        className="p-1.5 text-stone-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <DeleteRecipeButton id={recipe.id} title={recipe.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
