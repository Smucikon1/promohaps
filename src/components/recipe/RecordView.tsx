'use client'

import { useEffect } from 'react'
import { recordView, type RecentRecipe } from '@/lib/recentlyViewed'

export function RecordView({ recipe }: { recipe: RecentRecipe }) {
  useEffect(() => {
    recordView(recipe)
  }, [recipe.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
