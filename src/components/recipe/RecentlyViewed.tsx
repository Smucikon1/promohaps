'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { dedupeRecipes } from '@/lib/recipeDedupe'
import { hasActivePromo } from '@/lib/utils'
import { readRecent, pruneRecent, RECENT_EVENT, type RecentRecipe } from '@/lib/recentlyViewed'

export function RecentlyViewed({ excludeId, title = 'Ostatnio oglądane' }: { excludeId?: string; title?: string }) {
  const [items, setItems] = useState<RecentRecipe[]>([])
  // Historia sprawdzona wobec bazy — tylko przepisy, które nadal istnieją
  const [verified, setVerified] = useState<RecentRecipe[]>([])

  useEffect(() => {
    const sync = () => setItems(readRecent())
    sync()
    window.addEventListener(RECENT_EVENT, sync)
    return () => window.removeEventListener(RECENT_EVENT, sync)
  }, [])

  const idsSig = items.map((i) => i.id).join(',')

  useEffect(() => {
    const local = readRecent()
    if (local.length === 0) {
      setVerified([])
      return
    }
    let alive = true
    createClient()
      .from('recipes')
      .select('id, slug, title, image_url, store:stores(name), promo_products(valid_to)')
      .in(
        'id',
        local.map((r) => r.id)
      )
      .eq('is_published', true)
      // te same zasady co w listingach: bez ceny i bez aktywnej promocji nie pokazujemy
      .gt('price_total', 0)
      .then(({ data }) => {
        if (!alive) return
        const active = (data ?? []).filter((r: any) => hasActivePromo(r.promo_products))
        const byId = new Map(active.map((r: any) => [r.id, r]))
        // historia sama się leczy: martwe wpisy znikają na stałe
        pruneRecent(new Set(byId.keys()))
        const fresh = local
          .filter((r) => byId.has(r.id))
          .map((r) => {
            const d: any = byId.get(r.id)
            const store = Array.isArray(d.store) ? d.store[0] : d.store
            return {
              id: d.id,
              slug: d.slug,
              title: d.title,
              image_url: d.image_url,
              store_name: store?.name ?? null,
            } as RecentRecipe
          })
        setVerified(dedupeRecipes(fresh as any) as unknown as RecentRecipe[])
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSig])

  const list = verified.filter((i) => i.id !== excludeId)
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
