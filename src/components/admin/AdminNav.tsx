'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, BookOpen, BarChart3, LogOut, ChefHat, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/przepisy', label: 'Przepisy', icon: BookOpen },
  { href: '/admin/promocje', label: 'Promocje', icon: Tag },
  { href: '/admin/analityka', label: 'Analityka', icon: BarChart3 },
]

export function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <aside className="w-56 bg-white border-r border-stone-100 flex flex-col min-h-screen">
      <div className="p-5 border-b border-stone-50">
        <Link href="/" className="flex items-center gap-2 text-stone-700 hover:text-amber-600 transition-colors">
          <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
            <ChefHat className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm" style={{ fontFamily: 'var(--font-serif)' }}>
            Przepisnik
          </span>
        </Link>
        <p className="text-xs text-stone-400 mt-1 ml-9">Panel admina</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                active
                  ? 'bg-amber-50 text-amber-700'
                  : 'text-stone-600 hover:bg-stone-50 hover:text-stone-800'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-stone-50">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-sm font-medium text-stone-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Wyloguj
        </button>
      </div>
    </aside>
  )
}
