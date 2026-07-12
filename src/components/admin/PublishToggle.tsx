'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Check, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PublishToggle({ id, isPublished }: { id: string; isPublished: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const toggle = async () => {
    setLoading(true)
    setError(false)
    const supabase = createClient()
    const { error: err } = await supabase.from('recipes').update({ is_published: !isPublished }).eq('id', id)
    if (err) {
      setError(true)
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={error ? 'Błąd — spróbuj ponownie' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-50',
        isPublished
          ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          : 'bg-green-600 text-white hover:bg-green-700',
        error && 'ring-1 ring-red-400'
      )}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isPublished ? (
        <EyeOff className="w-3.5 h-3.5" />
      ) : (
        <Check className="w-3.5 h-3.5" />
      )}
      {isPublished ? 'Ukryj' : 'Publikuj'}
    </button>
  )
}
