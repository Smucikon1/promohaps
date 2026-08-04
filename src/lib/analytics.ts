'use client'

import { createClient } from '@/lib/supabase/client'
import type { AnalyticsEvent } from '@/types'

const SESSION_KEY = 'przepisnik_session_id'
const CONSENT_KEY = 'przepisnik_analytics_consent'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

// Zgoda opt-in: śledzimy TYLKO po jawnej akceptacji użytkownika
function hasConsent(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(CONSENT_KEY) === 'granted'
}

export function getAnalyticsConsent(): 'granted' | 'denied' | null {
  if (typeof window === 'undefined') return null
  return (localStorage.getItem(CONSENT_KEY) as 'granted' | 'denied' | null) ?? null
}

export function grantAnalyticsConsent() {
  localStorage.setItem(CONSENT_KEY, 'granted')
}

export function denyAnalyticsConsent() {
  localStorage.setItem(CONSENT_KEY, 'denied')
}

export async function trackEvent(event: Omit<AnalyticsEvent, 'session_id'>) {
  if (!hasConsent()) return
  const session_id = getSessionId()
  if (!session_id) return

  const supabase = createClient()
  await supabase.from('analytics_events').insert({
    session_id,
    ...event,
  })
}

export const track = {
  recipeView: (recipeId: string, storeId: string) =>
    trackEvent({ event_type: 'recipe_view', recipe_id: recipeId, store_id: storeId }),

  recipeClick: (recipeId: string) =>
    trackEvent({ event_type: 'recipe_click', recipe_id: recipeId }),

  storeClick: (storeId: string) =>
    trackEvent({ event_type: 'store_click', store_id: storeId }),

  categoryClick: (categoryId: string) =>
    trackEvent({ event_type: 'category_click', category_id: categoryId }),

  search: (query: string) =>
    trackEvent({ event_type: 'search', search_query: query }),

  filterUsed: (filters: Record<string, string>) =>
    trackEvent({ event_type: 'filter_used', metadata: filters }),

  favoriteAdd: (recipeId: string) =>
    trackEvent({ event_type: 'favorite_add', recipe_id: recipeId }),

  shoppingListAdd: (recipeId: string) =>
    trackEvent({ event_type: 'shopping_list_add', recipe_id: recipeId }),

  shoppingListCheck: (recipeId: string) =>
    trackEvent({ event_type: 'shopping_list_check', recipe_id: recipeId }),
}
