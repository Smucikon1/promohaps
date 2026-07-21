'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ShoppingCart, Heart, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { countShoppingItems, SHOPPING_EVENT } from '@/lib/shopping'
import { countFavorites, FAVORITES_EVENT } from '@/lib/favorites'
import { countPlanned, MEAL_PLAN_EVENT } from '@/lib/mealPlan'

const NAV_LINKS = [
  { href: '/', label: 'Przepisy', exact: true },
  { href: '/plan', label: 'Jadłospis' },
]

export function Header() {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')
  const [count, setCount] = useState(0)
  const [favCount, setFavCount] = useState(0)
  const [planCount, setPlanCount] = useState(0)

  useEffect(() => {
    const update = () => {
      setCount(countShoppingItems())
      setFavCount(countFavorites())
      setPlanCount(countPlanned())
    }
    update()
    window.addEventListener(SHOPPING_EVENT, update)
    window.addEventListener(FAVORITES_EVENT, update)
    window.addEventListener(MEAL_PLAN_EVENT, update)
    window.addEventListener('focus', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(SHOPPING_EVENT, update)
      window.removeEventListener(FAVORITES_EVENT, update)
      window.removeEventListener(MEAL_PLAN_EVENT, update)
      window.removeEventListener('focus', update)
      window.removeEventListener('storage', update)
    }
  }, [pathname])

  if (isAdmin) return null

  const onList = pathname === '/lista-zakupow'

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-stone-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" aria-label="Sapri — strona główna" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Sapri" className="h-7 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'hover:text-amber-600 transition-colors',
                link.exact && pathname === '/' && 'text-amber-600'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Akcje — tylko desktop (na mobile obsługuje je dolny pasek) */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/plan"
            aria-label={`Jadłospis${planCount > 0 ? ` (${planCount})` : ''}`}
            className={cn(
              'relative w-9 h-9 rounded-full flex items-center justify-center transition-colors',
              pathname === '/plan' ? 'bg-amber-500 text-white' : 'text-stone-600 hover:bg-stone-100'
            )}
          >
            <CalendarDays className="w-5 h-5" />
            {planCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {planCount}
              </span>
            )}
          </Link>
          <Link
            href="/ulubione"
            aria-label={`Ulubione${favCount > 0 ? ` (${favCount})` : ''}`}
            className={cn(
              'relative w-9 h-9 rounded-full flex items-center justify-center transition-colors',
              pathname === '/ulubione' ? 'bg-red-500 text-white' : 'text-stone-600 hover:bg-stone-100'
            )}
          >
            <Heart className={cn('w-5 h-5', pathname === '/ulubione' && 'fill-current')} />
            {favCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold bg-red-500 text-white">
                {favCount}
              </span>
            )}
          </Link>
          <Link
            href="/lista-zakupow"
            aria-label="Lista zakupów"
            className={cn(
              'relative inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors',
              onList ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            )}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Lista zakupów</span>
            {count > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-bold',
                  onList ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'
                )}
              >
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
