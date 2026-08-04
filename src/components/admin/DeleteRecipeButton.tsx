'use client'

import { revalidateCatalog } from '@/app/actions/revalidate'
import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  id: string
  title: string
}

export function DeleteRecipeButton({ id, title }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm(`Usunąć przepis "${title}"? Tej operacji nie można cofnąć.`)) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('recipes').delete().eq('id', id)
    await revalidateCatalog()
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      aria-label={`Usuń przepis ${title}`}
      className="p-1.5 text-stone-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  )
}
