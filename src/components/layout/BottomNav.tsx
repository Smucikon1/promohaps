'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Home, ShoppingCart, Heart, ShoppingBasket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { countShoppingItems, SHOPPING_EVENT } from '@/lib/shopping'
import { countFavorites, FAVORITES_EVENT } from '@/lib/favorites'

const EVENTS = [SHOPPING_EVENT, FAVORITES_EVENT, 'focus', 'storage']

export function BottomNav() {
  const pathname = usePathname()
  const [cart, setCart] = useState(0)
  const [fav, setFav] = useState(0)

  useEffect(() => {
    const update = () => {
      setCart(countShoppingItems())
      setFav(countFavorites())
    }
    update()
    EVENTS.forEach((e) => window.addEventListener(e, update))
    return () => EVENTS.forEach((e) => window.removeEventListener(e, update))
  }, [pathname])

  if (pathname.startsWith('/admin')) return null

  // Zestaw na tydzień był tylko w górnej nawigacji, która na mobile jest ukryta —
  // czyli na telefonie nie dało się do niego dojść w ogóle.
  const tabs = [
    { href: '/', label: 'Przepisy', icon: Home, active: pathname === '/', badge: 0, fill: false },
    { href: '/zestaw', label: 'Na tydzień', icon: ShoppingBasket, active: pathname === '/zestaw', badge: 0, fill: false },
    { href: '/lista-zakupow', label: 'Lista', icon: ShoppingCart, active: pathname === '/lista-zakupow', badge: cart, fill: false },
    { href: '/ulubione', label: 'Ulubione', icon: Heart, active: pathname === '/ulubione', badge: fav, fill: true },
  ]

  return (
    <nav
      className="no-print md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-stone-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch justify-around">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-label={t.label}
            aria-current={t.active ? 'page' : undefined}
            className={cn(
              'relative flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
              t.active ? 'text-amber-600' : 'text-stone-500'
            )}
          >
            <span className="relative">
              <t.icon className={cn('w-[22px] h-[22px]', t.active && t.fill && 'fill-current')} />
              {t.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {t.badge}
                </span>
              )}
            </span>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
