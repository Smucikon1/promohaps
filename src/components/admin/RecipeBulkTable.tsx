'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { revalidateCatalog } from '@/app/actions/revalidate'
import { formatPrice, formatTime, cn } from '@/lib/utils'
import { DeleteRecipeButton } from '@/components/admin/DeleteRecipeButton'
import { PublishToggle } from '@/components/admin/PublishToggle'
import { Edit, Loader2, Check, EyeOff, Trash2, X } from 'lucide-react'

type BulkAction = 'publish' | 'unpublish' | 'delete'

/**
 * @param wygasle Identyfikatory przepisów, które mimo publikacji nie są widoczne
 *   w serwisie, bo wygasła im promocja. Oznaczamy je, żeby nie szukać przyczyny
 *   „dlaczego tego przepisu nie widać" po stronie użytkownika.
 */
export function RecipeBulkTable({
  recipes,
  wygasle,
}: {
  recipes: any[]
  wygasle?: Set<string>
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<BulkAction | null>(null)
  const [error, setError] = useState('')
  const headCheckbox = useRef<HTMLInputElement>(null)

  const allSelected = recipes.length > 0 && selected.size === recipes.length
  const someSelected = selected.size > 0 && !allSelected

  // React nie ma propa `indeterminate` — stan „część zaznaczona" trzeba ustawić na DOM-ie
  useEffect(() => {
    if (headCheckbox.current) headCheckbox.current.indeterminate = someSelected
  }, [someSelected])

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => (prev.size === recipes.length ? new Set() : new Set(recipes.map((r) => r.id))))
  }

  const run = async (action: BulkAction) => {
    const ids = [...selected]
    if (ids.length === 0) return

    if (action === 'delete') {
      // Nieodwracalne i dotyczy wielu pozycji naraz — pytamy z konkretną liczbą
      const ok = confirm(
        `Usunąć ${ids.length} ${ids.length === 1 ? 'przepis' : ids.length < 5 ? 'przepisy' : 'przepisów'}? Tej operacji nie można cofnąć.`
      )
      if (!ok) return
    }

    setBusy(action)
    setError('')
    const supabase = createClient()

    const { error: err } =
      action === 'delete'
        ? await supabase.from('recipes').delete().in('id', ids)
        : await supabase.from('recipes').update({ is_published: action === 'publish' }).in('id', ids)

    if (err) {
      setError(err.message)
      setBusy(null)
      return
    }

    await revalidateCatalog()
    setSelected(new Set())
    router.refresh()
    setBusy(null)
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  ref={headCheckbox}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={allSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                  className="w-4 h-4 rounded border-stone-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                />
              </th>
              <th className="text-left px-1 py-3 font-medium text-stone-500">Przepis</th>
              <th className="text-left px-4 py-3 font-medium text-stone-500 hidden md:table-cell">Sklep</th>
              <th className="text-left px-4 py-3 font-medium text-stone-500 hidden lg:table-cell">Cena</th>
              <th className="text-left px-4 py-3 font-medium text-stone-500 hidden lg:table-cell">Czas</th>
              <th className="text-left px-4 py-3 font-medium text-stone-500">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {recipes.map((recipe: any) => {
              const checked = selected.has(recipe.id)
              return (
                <tr
                  key={recipe.id}
                  className={cn('transition-colors', checked ? 'bg-amber-50/60' : 'hover:bg-stone-50')}
                >
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(recipe.id)}
                      aria-label={`Zaznacz ${recipe.title}`}
                      className="w-4 h-4 rounded border-stone-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                  </td>
                  <td className="px-1 py-3.5">
                    <p className="font-medium text-stone-800 line-clamp-1">{recipe.title}</p>
                    {/* Opublikowany, ale niewidoczny w katalogu — wygasla promocja.
                        Bez tego znacznika jedyna droga do tej informacji to szukanie
                        przepisu w serwisie i dziwienie sie, ze go nie ma. */}
                    {wygasle?.has(recipe.id) && recipe.is_published && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        zeszedl z serwisu — promocja wygasla
                      </span>
                    )}
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
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        recipe.is_published ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {recipe.is_published ? 'Opublikowany' : 'Szkic'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <PublishToggle id={recipe.id} isPublished={!!recipe.is_published} />
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
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pasek akcji zbiorczych — pływa nad treścią, żeby był pod ręką także
          po przewinięciu długiej listy. BottomNav na /admin się nie renderuje,
          więc nie ma o co kolidować. */}
      {selected.size > 0 && (
        <div
          role="region"
          aria-label="Akcje dla zaznaczonych przepisów"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(calc(100vw-2rem),44rem)]"
        >
          <div className="bg-stone-900 text-white rounded-2xl shadow-2xl px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold mr-1">
                Zaznaczono {selected.size}
              </span>

              <button
                onClick={() => run('publish')}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-green-600 hover:bg-green-500 transition-colors disabled:opacity-50"
              >
                {busy === 'publish' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Publikuj
              </button>

              <button
                onClick={() => run('unpublish')}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-stone-700 hover:bg-stone-600 transition-colors disabled:opacity-50"
              >
                {busy === 'unpublish' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
                Ukryj
              </button>

              <button
                onClick={() => run('delete')}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {busy === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Usuń
              </button>

              <button
                onClick={() => setSelected(new Set())}
                disabled={busy !== null}
                className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full text-stone-300 hover:text-white hover:bg-stone-800 transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Odznacz
              </button>
            </div>

            {error && <p className="mt-2 text-xs text-red-300">Nie udało się: {error}</p>}
          </div>
        </div>
      )}
    </>
  )
}
