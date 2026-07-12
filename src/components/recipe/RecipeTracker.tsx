'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

interface Props {
  recipeId: string
  storeId: string
}

export function RecipeTracker({ recipeId, storeId }: Props) {
  useEffect(() => {
    track.recipeView(recipeId, storeId)
  }, [recipeId, storeId])

  return null
}
