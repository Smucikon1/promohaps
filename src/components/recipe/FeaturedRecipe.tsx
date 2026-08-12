import Link from 'next/link'
import Image from 'next/image'
import { Clock, Flame, Tag, UtensilsCrossed, ArrowRight, Heart } from 'lucide-react'
import { formatPrice, formatTime, difficultyLabel, promoDaysLeftLabel } from '@/lib/utils'
import { StoreLogo } from '@/components/recipe/StoreLogo'
import { activePromos, totalSavings } from '@/lib/savings'
import type { Recipe } from '@/types'

// Jeden przepis „na afiszu” — najtańszy z aktualnych. Cena jest tu bohaterem,
// bo to ona jest powodem, dla którego ktoś wchodzi na zGazetki.
export function FeaturedRecipe({ recipe }: { recipe: Recipe }) {
  const promos = activePromos(recipe.promo_products)
  const savings = totalSavings(recipe.promo_products)
  const nearestEnd =
    promos.length > 0 ? promos.reduce((min, p) => (p.valid_to < min ? p.valid_to : min), promos[0].valid_to) : null
  const needsCard = promos.some((p) => p.condition_type === 'karta')

  return (
    <section className="mb-10">
      <Link
        href={`/przepis/${recipe.slug}`}
        className="group grid md:grid-cols-2 overflow-hidden rounded-3xl border border-stone-100 bg-white transition-colors hover:border-[#12b76a]"
      >
        {/* Zdjęcie — na mobile stała, niska wysokość, by tytuł i cena były od razu widoczne bez przewijania */}
        <div className="relative h-[150px] md:h-auto md:min-h-[340px] bg-stone-100 overflow-hidden">
          {recipe.image_url ? (
            <Image
              src={recipe.image_url}
              alt={recipe.title}
              fill
              priority
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#e6f9f0] to-stone-100">
              <UtensilsCrossed className="w-14 h-14 text-[#12b76a]" />
            </div>
          )}

          {/* Logo o stopień większe niż na zwykłym kafelku — afisz jest największą kartą
              na stronie, więc mniejsze niż w siatce wyglądałoby na pomyłkę. */}
          {recipe.store && (
            <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-white/95 rounded-xl px-3 py-2 shadow-sm text-xs font-semibold text-stone-700">
              <StoreLogo slug={recipe.store.slug} name={recipe.store.name} className="h-8 w-auto max-w-[8rem] object-contain" />
            </div>
          )}

          {nearestEnd && (
            <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                <Tag className="w-3 h-3" />
                {promoDaysLeftLabel(nearestEnd)}
              </span>
              {needsCard && (
                <span className="rounded-full bg-purple-600 px-2 py-1 text-xs font-bold text-white shadow-sm">z kartą</span>
              )}
            </div>
          )}
        </div>

        {/* Treść */}
        <div className="flex flex-col justify-center gap-3 p-5 md:gap-4 md:p-9">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#e6f9f0] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#12b76a]">
            <Flame className="w-3.5 h-3.5" />
            Przepis tygodnia
          </span>

          <h2
            className="text-xl md:text-4xl font-bold leading-tight text-stone-900"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {recipe.title}
          </h2>

          {/* Opis tylko od tabletu — na mobile zjada miejsce potrzebne cenie */}
          {recipe.description && <p className="hidden md:block text-stone-600 line-clamp-3">{recipe.description}</p>}

          <div className="flex items-center gap-4 text-sm text-stone-500">
            {recipe.prep_time_min && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {formatTime(recipe.prep_time_min)}
              </span>
            )}
            {recipe.difficulty && (
              <span className="flex items-center gap-1.5">
                <Flame className="w-4 h-4" />
                {difficultyLabel(recipe.difficulty)}
              </span>
            )}
            {(recipe.favorite_count ?? 0) > 0 && (
              <span className="flex items-center gap-1.5 text-red-500">
                <Heart className="w-4 h-4 fill-current" />
                {recipe.favorite_count}
              </span>
            )}
          </div>

          <div className="flex items-end justify-between gap-4 border-t border-stone-100 pt-4">
            {recipe.price_total && (() => {
              const base = recipe.price_total + savings
              const percent = base > 0 && savings >= 0.5 ? Math.round((savings / base) * 100) : 0
              return (
                <div>
                  <div className="text-xs font-medium text-stone-500">Cena całości <span className="text-stone-400">(orientacyjna)</span></div>
                  <div className="text-4xl font-bold text-amber-600" style={{ fontFamily: 'var(--font-serif)' }}>
                    {formatPrice(recipe.price_total)}
                  </div>
                  {percent > 0 && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 text-sm font-extrabold px-3 py-1 shadow-sm ring-1 ring-green-200">
                      −{percent}% taniej z gazetki
                    </span>
                  )}
                </div>
              )
            })()}
            <span className="btn-primary inline-flex items-center gap-2">
              Zobacz przepis
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </section>
  )
}
