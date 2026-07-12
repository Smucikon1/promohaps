'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export function AdminLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Nieprawidłowy email lub hasło.')
      setLoading(false)
    } else {
      router.push('/admin')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm space-y-4">
      {error && (
        <div role="alert" className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}
      <div>
        <label htmlFor="admin-email" className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
        <input
          id="admin-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          placeholder="admin@example.com"
        />
      </div>
      <div>
        <label htmlFor="admin-password" className="block text-sm font-medium text-stone-700 mb-1.5">Hasło</label>
        <div className="relative">
          <input
            id="admin-password"
            type={showPass ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 pr-10"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            aria-label={showPass ? 'Ukryj hasło' : 'Pokaż hasło'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Zaloguj się
      </button>
    </form>
  )
}
