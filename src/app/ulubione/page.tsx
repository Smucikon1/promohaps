'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Heart, ArrowLeft, X } from 'lucide-react'
import {
  readFavorites,
  removeFavorite,
  FAVORITES_EVENT,
  type FavoriteRecipe,
} from '@/lib/favorites'

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteRecipe[]>([])
  const [loaded, setLoaded] = useState(false)

  const sync = useCallback(() => {
    setItems(readFavorites())
    setLoaded(true)
  }, [])

  useEffect(() => {
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    return () => window.removeEventListener(FAVORITES_EVENT, sync)
  }, [sync])

  if (!loaded) return null

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-amber-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Wróć do przepisów
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
          <Heart className="w-5 h-5 text-white fill-current" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>
            Ulubione
          </h1>
          {items.length > 0 && (
            <p className="text-sm text-stone-500">{items.length} zapisanych przepisów</p>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-stone-100">
          <div className="text-5xl mb-4">❤️</div>
          <h2 className="text-xl font-bold mb-2 text-stone-700">Brak ulubionych</h2>
          <p className="text-stone-400 mb-6">
            Kliknij serduszko na dowolnym przepisie, aby zapisać go tutaj.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors"
          >
            Przeglądaj przepisy
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((r) => (
            <div key={r.id} className="recipe-card group relative">
              <button
                onClick={() => removeFavorite(r.id)}
                aria-label={`Usuń ${r.title} z ulubionych`}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-sm flex items-center justify-center text-red-500 hover:text-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <Link href={`/przepis/${r.slug}`} className="block">
                <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
                  {r.image_url ? (
                    <Image
                      src={r.image_url}
                      alt={r.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-4xl bg-gradient-to-br from-amber-50 to-stone-100">
                      🍽️
                    </div>
                  )}
                  {r.store_name && (
                    <div className="store-badge absolute top-3 left-3 bg-stone-700">{r.store_name}</div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-stone-800 text-base leading-snug line-clamp-2"
                    style={{ fontFamily: 'var(--font-serif)' }}>
                    {r.title}
                  </h3>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
