'use client'

import { useState, useEffect } from 'react'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isFavorite, toggleFavorite, FAVORITES_EVENT, type FavoriteRecipe } from '@/lib/favorites'

interface Props {
  recipe: FavoriteRecipe
  variant?: 'overlay' | 'inline'
}

export function FavoriteButton({ recipe, variant = 'overlay' }: Props) {
  const [fav, setFav] = useState(false)

  useEffect(() => {
    const sync = () => setFav(isFavorite(recipe.id))
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    return () => window.removeEventListener(FAVORITES_EVENT, sync)
  }, [recipe.id])

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFav(toggleFavorite(recipe))
  }

  const label = fav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'

  if (variant === 'inline') {
    return (
      <button
        onClick={onClick}
        aria-pressed={fav}
        aria-label={label}
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border transition-colors',
          fav
            ? 'bg-red-50 text-red-600 border-red-200'
            : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
        )}
      >
        <Heart className={cn('w-4 h-4', fav && 'fill-current')} />
        {fav ? 'W ulubionych' : 'Zapisz'}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      aria-pressed={fav}
      aria-label={label}
      className="w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-sm flex items-center justify-center transition-colors"
    >
      <Heart className={cn('w-4 h-4', fav ? 'text-red-500 fill-current' : 'text-stone-500')} />
    </button>
  )
}
