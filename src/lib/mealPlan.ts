// Jadłospis tygodniowy — localStorage. Rdzeń aplikacji: planujesz tydzień, dostajesz listę zakupów.

import type { ShoppingItem } from '@/lib/shopping'

export const MEAL_PLAN_KEY = 'przepisnik_meal_plan_v1'
export const MEAL_PLAN_EVENT = 'przepisnik:meal-plan-updated'

export const DAYS = [
  { key: 'mon', label: 'Poniedziałek', short: 'Pon' },
  { key: 'tue', label: 'Wtorek', short: 'Wt' },
  { key: 'wed', label: 'Środa', short: 'Śr' },
  { key: 'thu', label: 'Czwartek', short: 'Czw' },
  { key: 'fri', label: 'Piątek', short: 'Pt' },
  { key: 'sat', label: 'Sobota', short: 'Sob' },
  { key: 'sun', label: 'Niedziela', short: 'Nd' },
] as const

export interface PlannedIngredient {
  id: string
  name: string
  amount: string | null
  unit: string | null
  price: number | null
  isPromo: boolean
}
export interface PlannedPromo {
  id: string
  name: string
  price_promo: number
  price_regular: number | null
}
export interface PlannedRecipe {
  id: string
  slug: string
  title: string
  image_url: string | null
  store_name: string | null
  price_total: number | null
  savings: number
  ingredients: PlannedIngredient[]
  promos: PlannedPromo[]
}
export type MealPlan = Record<string, PlannedRecipe[]>

export function readPlan(): MealPlan {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(MEAL_PLAN_KEY)
    const p = raw ? JSON.parse(raw) : {}
    return p && typeof p === 'object' ? p : {}
  } catch {
    return {}
  }
}

function writePlan(plan: MealPlan) {
  localStorage.setItem(MEAL_PLAN_KEY, JSON.stringify(plan))
  window.dispatchEvent(new Event(MEAL_PLAN_EVENT))
}

export function addToDay(day: string, recipe: PlannedRecipe) {
  const plan = readPlan()
  const list = plan[day] ?? []
  if (!list.some((r) => r.id === recipe.id)) plan[day] = [...list, recipe]
  writePlan(plan)
}

export function removeFromDay(day: string, recipeId: string) {
  const plan = readPlan()
  plan[day] = (plan[day] ?? []).filter((r) => r.id !== recipeId)
  if (plan[day].length === 0) delete plan[day]
  writePlan(plan)
}

export function clearPlan() {
  writePlan({})
}

export function countPlanned(plan?: MealPlan): number {
  const p = plan ?? readPlan()
  return Object.values(p).reduce((n, list) => n + list.length, 0)
}

// Produkty występujące w więcej niż jednym przepisie — kupujesz raz, gotujesz kilka dań
export function sharedProducts(plan?: MealPlan): { name: string; count: number }[] {
  const p = plan ?? readPlan()
  const counts = new Map<string, { name: string; recipes: Set<string> }>()

  for (const list of Object.values(p)) {
    for (const r of list) {
      const names = r.ingredients.map((i) => i.name)
      for (const raw of names) {
        const key = String(raw ?? '').trim().toLowerCase()
        if (!key) continue
        if (!counts.has(key)) counts.set(key, { name: raw, recipes: new Set() })
        counts.get(key)!.recipes.add(r.id)
      }
    }
  }

  return [...counts.values()]
    .filter((v) => v.recipes.size > 1)
    .map((v) => ({ name: v.name, count: v.recipes.size }))
    .sort((a, b) => b.count - a.count)
}

// Ile przepisów w planie używa danego składnika (po nazwie)
export function usageCounts(plan?: MealPlan): Map<string, number> {
  const p = plan ?? readPlan()
  const map = new Map<string, number>()
  for (const list of Object.values(p)) {
    for (const r of list) {
      const seen = new Set<string>()
      for (const i of r.ingredients) {
        const k = i.name.trim().toLowerCase()
        if (!k || seen.has(k)) continue
        seen.add(k)
        map.set(k, (map.get(k) ?? 0) + 1)
      }
    }
  }
  return map
}

// Koszt przepisu W PLANIE: cena OPAKOWANIA każdego składnika podzielona przez
// liczbę przepisów, które go używają (współdzielone opakowanie kupujesz raz).
export function recipeCostInPlan(r: PlannedRecipe, counts: Map<string, number>): number {
  const cost = r.ingredients.reduce((s, i) => {
    if (i.price == null) return s
    const c = counts.get(i.name.trim().toLowerCase()) || 1
    return s + i.price / c
  }, 0)
  return Math.round(cost * 100) / 100
}

export function planTotals(plan?: MealPlan): { cost: number; savings: number; meals: number } {
  const p = plan ?? readPlan()
  const counts = usageCounts(p)
  let cost = 0
  let meals = 0
  for (const list of Object.values(p)) {
    for (const r of list) {
      cost += recipeCostInPlan(r, counts)
      meals++
    }
  }
  return { cost: Math.round(cost * 100) / 100, savings: 0, meals }
}

// Lista zakupów z jadłospisu: każdy produkt raz, po cenie opakowania (bez sumowania,
// bo współdzielone opakowanie kupujesz jednokrotnie).
export function planToShoppingItems(plan?: MealPlan): ShoppingItem[] {
  const p = plan ?? readPlan()
  const ingMap = new Map<string, ShoppingItem>()

  for (const list of Object.values(p)) {
    for (const r of list) {
      for (const ing of r.ingredients) {
        const key = `${ing.name.trim().toLowerCase()}|${(ing.unit ?? '').trim().toLowerCase()}`
        if (ingMap.has(key)) continue
        ingMap.set(key, {
          id: `ing-${key}`,
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
          isPromo: ing.isPromo,
          price: ing.price ?? null,
          priceRegular: null,
          fixedPrice: true,
          checked: false,
        })
      }
    }
  }

  return [...ingMap.values()]
}
