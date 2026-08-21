'use client'

import { useState } from 'react'
import { Share2, Printer, Check } from 'lucide-react'
import { FavoriteButton } from '@/components/recipe/FavoriteButton'
import { PinterestSaveButton } from '@/components/recipe/PinterestSaveButton'
import type { FavoriteRecipe } from '@/lib/favorites'

export function RecipeActions({ recipe }: { recipe: FavoriteRecipe }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: recipe.title, url })
      } catch {
        /* użytkownik anulował — ignorujemy */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* brak dostępu do schowka */
    }
  }

  // Jeden rząd z przewijaniem zamiast zawijania: „Drukuj" spadał na telefonie
  // do drugiego rzędu i rozbijał pasek akcji. -mx-4 px-4 daje przewijanie od
  // krawędzi do krawędzi, a shrink-0 nie pozwala ścisnąć przycisków.
  return (
    <div className="no-print flex flex-nowrap items-center gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
      <FavoriteButton variant="inline" recipe={recipe} />

      <PinterestSaveButton
        variant="inline"
        url={`/przepis/${recipe.slug}`}
        imageUrl={recipe.image_url}
        description={recipe.title}
      />

      <button
        onClick={share}
        aria-label="Udostępnij przepis"
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border bg-white text-stone-600 border-stone-200 hover:border-stone-300 transition-colors"
      >
        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4" />}
        {copied ? 'Skopiowano link' : 'Udostępnij'}
      </button>

      <button
        onClick={() => setTimeout(() => window.print(), 0)}
        aria-label="Drukuj przepis"
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border bg-white text-stone-600 border-stone-200 hover:border-stone-300 transition-colors"
      >
        <Printer className="w-4 h-4" />
        Drukuj
      </button>
    </div>
  )
}
