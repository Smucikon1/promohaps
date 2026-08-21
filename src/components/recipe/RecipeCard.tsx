'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Clock, Flame, Tag, UtensilsCrossed, Heart, Users } from 'lucide-react'
import { formatPrice, formatTime, difficultyLabel, promoDaysLeftLabel, cn } from '@/lib/utils'
import { StoreLogo } from '@/components/recipe/StoreLogo'
import { activePromos, savingsPercent } from '@/lib/savings'
import { FavoriteButton } from '@/components/recipe/FavoriteButton'
import { PinterestSaveButton } from '@/components/recipe/PinterestSaveButton'
import { CategoryIcon } from '@/components/recipe/CategoryIcon'
import type { Recipe } from '@/types'
import { track } from '@/lib/analytics'

interface RecipeCardProps {
  recipe: Recipe
  index?: number
}

export function RecipeCard({ recipe, index = 0 }: RecipeCardProps) {
  const promos = activePromos(recipe.promo_products)
  const hasActivePromo = promos.length > 0
  // Najbliższy koniec promocji + wymóg karty lojalnościowej
  const nearestEnd = hasActivePromo
    ? promos.reduce((min, p) => (p.valid_to < min ? p.valid_to : min), promos[0].valid_to)
    : null
  const needsCard = promos.some((p) => p.condition_type === 'karta')

  return (
    <div className={cn('recipe-card group relative animate-fade-in-up', `stagger-${(index % 4) + 1}`)}>
      {/* Akcje (ulubione + Pin it) — poza <a>, by nie zagnieżdżać interaktywnych elementów.
          Pin it pojawia się na hoverze, żeby nie zagęszczać kart. */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <FavoriteButton
          variant="overlay"
          recipe={{
            id: recipe.id,
            slug: recipe.slug,
            title: recipe.title,
            image_url: recipe.image_url,
            store_name: recipe.store?.name ?? null,
          }}
        />
        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <PinterestSaveButton
            url={`/przepis/${recipe.slug}`}
            imageUrl={recipe.image_url}
            description={recipe.title}
          />
        </div>
      </div>

      <Link
        href={`/przepis/${recipe.slug}`}
        className="block"
        onClick={() => track.recipeClick(recipe.id)}
      >
        {/* Zdjęcie — 3:2 zamiast 4:3: niższa karta = więcej przepisów i cen na ekranie */}
        <div className="relative aspect-[3/2] bg-stone-100 overflow-hidden">
          {recipe.image_url ? (
            <Image
              src={recipe.image_url}
              alt={recipe.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-50 to-stone-100">
              <UtensilsCrossed className="w-9 h-9 text-[#12b76a]" />
            </div>
          )}

          {/* Odznaka sklepu — logo na białym kaflu (fallback: kolor + nazwa).
              Sklep to pierwsza rzecz, po której użytkownik ocenia, czy przepis go dotyczy
              („robię zakupy w Biedronce"), więc logo jest wyraźne, a nie ledwo widoczne. */}
          {recipe.store && (
            <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-white/95 rounded-xl px-2.5 py-1.5 shadow-sm text-xs font-semibold text-stone-700">
              <StoreLogo slug={recipe.store.slug} name={recipe.store.name} className="h-7 w-auto max-w-[7rem] object-contain" />
            </div>
          )}

          {/* Ważność promocji + warunek karty */}
          {hasActivePromo && nearestEnd && (
            <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5">
              <div className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                <Tag className="w-3 h-3" />
                {promoDaysLeftLabel(nearestEnd)}
              </div>
              {needsCard && (
                <div className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                  z kartą
                </div>
              )}
            </div>
          )}
        </div>

        {/* Treść */}
        <div className="p-4">
          {recipe.categories && recipe.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {recipe.categories.slice(0, 2).map((cat) => (
                <span key={cat.id} className="inline-flex items-center gap-1 text-xs text-stone-500 bg-stone-50 px-2 py-0.5 rounded-full">
                  <CategoryIcon slug={cat.slug} className="w-3 h-3 text-[#12b76a]" />
                  {cat.name}
                </span>
              ))}
            </div>
          )}

          <h3 className="font-bold text-stone-800 text-base leading-snug mb-2 line-clamp-2"
            style={{ fontFamily: 'var(--font-serif)' }}>
            {recipe.title}
          </h3>

          <div className="flex items-center gap-3 text-xs text-stone-500">
            {recipe.prep_time_min && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(recipe.prep_time_min)}
              </span>
            )}
            {recipe.difficulty && (
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                {difficultyLabel(recipe.difficulty)}
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1" title={`${recipe.servings} porcji`}>
                <Users className="w-3.5 h-3.5" />
                {recipe.servings}
              </span>
            )}
            {/* Dowód społeczny — ile razy dodano do ulubionych. Pokazujemy tylko, gdy > 0 */}
            {(recipe.favorite_count ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-red-500" title="Dodano do ulubionych">
                <Heart className="w-3.5 h-3.5 fill-current" />
                {recipe.favorite_count}
              </span>
            )}
          </div>

          {/* Pokazujemy koszt całych zakupów, a nie cenę „za porcję": w sklepie kupujesz
              całe opakowania, więc podzielenie tej sumy przez porcje dawało kwotę,
              której nikt nigdzie nie zapłaci. */}
          {recipe.price_total && (() => {
            const percent = savingsPercent(recipe.price_total, recipe.promo_products)
            return (
              <div className="mt-3 pt-3 border-t border-stone-100">
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block text-xs font-medium text-stone-500">Zakupy</span>
                    <span className="block text-[10px] text-stone-400">cena orientacyjna</span>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-xl font-bold text-amber-600" style={{ fontFamily: 'var(--font-serif)' }}>
                      {formatPrice(recipe.price_total)}
                    </span>
                    {percent > 0 && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 text-xs font-extrabold px-2 py-0.5 shadow-sm ring-1 ring-green-200">
                        −{percent}% taniej
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </Link>
    </div>
  )
}
