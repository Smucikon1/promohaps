'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Clock, Users, Flame } from 'lucide-react'
import { formatPrice, formatTime, difficultyLabel, cn } from '@/lib/utils'
import { storeColor } from '@/lib/stores'
import { activePromos, totalSavings } from '@/lib/savings'
import { FavoriteButton } from '@/components/recipe/FavoriteButton'
import type { Recipe } from '@/types'
import { track } from '@/lib/analytics'

interface RecipeCardProps {
  recipe: Recipe
  index?: number
}

export function RecipeCard({ recipe, index = 0 }: RecipeCardProps) {
  const promos = activePromos(recipe.promo_products)
  const hasActivePromo = promos.length > 0
  const savings = totalSavings(recipe.promo_products)

  return (
    <div className={cn('recipe-card group relative animate-fade-in-up', `stagger-${(index % 4) + 1}`)}>
      {/* Ulubione — poza <a>, by nie zagnieżdżać interaktywnych elementów */}
      <div className="absolute top-3 right-3 z-10">
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
      </div>

      <Link
        href={`/przepis/${recipe.slug}`}
        className="block"
        onClick={() => track.recipeClick(recipe.id)}
      >
        {/* Zdjęcie */}
        <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
          {recipe.image_url ? (
            <Image
              src={recipe.image_url}
              alt={recipe.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl bg-gradient-to-br from-amber-50 to-stone-100">
              🍽️
            </div>
          )}

          {/* Odznaka sklepu */}
          {recipe.store && (
            <div
              className="store-badge absolute top-3 left-3"
              style={{ backgroundColor: storeColor(recipe.store.slug) }}
            >
              {recipe.store.name}
            </div>
          )}

          {/* Odznaka wartości */}
          {savings > 0 ? (
            <div className="absolute bottom-3 left-3 bg-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
              Oszczędzasz −{formatPrice(savings)}
            </div>
          ) : hasActivePromo ? (
            <div className="absolute bottom-3 left-3 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              🏷️ Promocja
            </div>
          ) : null}
        </div>

        {/* Treść */}
        <div className="p-4">
          {recipe.categories && recipe.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {recipe.categories.slice(0, 2).map((cat) => (
                <span key={cat.id} className="text-xs text-stone-500 bg-stone-50 px-2 py-0.5 rounded-full">
                  {cat.icon} {cat.name}
                </span>
              ))}
            </div>
          )}

          <h3 className="font-bold text-stone-800 text-base leading-snug mb-2 line-clamp-2"
            style={{ fontFamily: 'var(--font-serif)' }}>
            {recipe.title}
          </h3>

          {recipe.description && (
            <p className="text-stone-500 text-sm line-clamp-2 mb-3">{recipe.description}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-stone-500">
            {recipe.prep_time_min && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(recipe.prep_time_min)}
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {recipe.servings} os.
              </span>
            )}
            {recipe.difficulty && (
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                {difficultyLabel(recipe.difficulty)}
              </span>
            )}
          </div>

          {/* Cena całości — wyeksponowana */}
          {recipe.price_total && (
            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Cena całości</span>
              <span className="text-xl font-bold text-amber-600" style={{ fontFamily: 'var(--font-serif)' }}>
                {formatPrice(recipe.price_total)}
              </span>
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}
