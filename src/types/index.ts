export interface Store {
  id: string
  name: string
  slug: string
  logo_url: string | null
  color: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  color: string | null
  sort_order: number
  is_active: boolean
}

export interface Recipe {
  id: string
  store_id: string
  title: string
  slug: string
  description: string | null
  image_url: string | null
  prep_time_min: number | null
  difficulty: 'latwy' | 'sredni' | 'trudny' | null
  servings: number | null
  price_total: number | null
  meta_title: string | null
  meta_description: string | null
  is_published: boolean
  views_count: number
  created_at: string
  updated_at: string
  // joined
  store?: Store
  categories?: Category[]
  ingredients?: Ingredient[]
  steps?: RecipeStep[]
  promo_products?: PromoProduct[]
}

export interface Ingredient {
  id: string
  recipe_id: string
  name: string
  amount: string | null
  unit: string | null
  price: number | null
  sort_order: number
  is_promo_product: boolean
}

export type PromoConditionType = 'brak' | 'karta' | 'wielosztuka' | 'inny'

export interface PromoProduct {
  id: string
  store_id: string
  recipe_id: string | null
  name: string
  price_promo: number
  price_regular: number | null
  image_url: string | null
  valid_from: string
  valid_to: string
  is_active?: boolean
  created_at: string
  // Warunki promocji z gazetki (np. cena tylko z kartą, oferta 2+1)
  condition_type?: PromoConditionType | null
  condition_note?: string | null
  min_quantity?: number | null
}

export interface RecipeStep {
  id: string
  recipe_id: string
  step_number: number
  description: string
  image_url: string | null
}

export interface AnalyticsEvent {
  session_id: string
  event_type: string
  recipe_id?: string
  store_id?: string
  category_id?: string
  search_query?: string
  metadata?: Record<string, unknown>
}

export type Difficulty = 'latwy' | 'sredni' | 'trudny'

export interface RecipeFilters {
  store?: string
  category?: string
  difficulty?: Difficulty
  search?: string
  maxPrice?: number
  maxTime?: number
}
