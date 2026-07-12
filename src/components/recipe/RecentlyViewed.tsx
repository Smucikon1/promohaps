'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { readRecent, RECENT_EVENT, type RecentRecipe } from '@/lib/recentlyViewed'

export function RecentlyViewed({ excludeId, title = 'Ostatnio oglądane' }: { excludeId?: string; title?: string }) {
  const [items, setItems] = useState<RecentRecipe[]>([])

  useEffect(() => {
    const sync = () => setItems(readRecent())
    sync()
    window.addEventListener(RECENT_EVENT, sync)
    return () => window.removeEventListener(RECENT_EVENT, sync)
  }, [])

  const list = items.filter((i) => i.id !== excludeId)
  if (list.length === 0) return null

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold text-stone-900 mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
        {title}
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {list.map((r) => (
          <Link key={r.id} href={`/przepis/${r.slug}`} className="w-40 sm:w-44 flex-shrink-0 group">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-stone-100">
              {r.image_url ? (
                <Image
                  src={r.image_url}
                  alt={r.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="176px"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-3xl bg-gradient-to-br from-amber-50 to-stone-100">
                  🍽️
                </div>
              )}
              {r.store_name && (
                <span className="store-badge absolute top-2 left-2 bg-stone-700 text-[10px]">{r.store_name}</span>
              )}
            </div>
            <p className="text-sm font-medium text-stone-700 mt-2 line-clamp-2">{r.title}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
