// Kolekcje kuratorskie — gotowe zestawy „tanio i szybko" (nawigacja + SEO).
export interface Collection {
  slug: string
  title: string
  description: string
  categorySlug?: string
  maxPrice?: number
  maxTime?: number
  difficulty?: string
}

export const COLLECTIONS: Collection[] = [
  {
    slug: 'obiad-do-20-zl',
    title: 'Obiad do 20 zł',
    description: 'Sycące obiady z aktualnych promocji za mniej niż 20 zł.',
    categorySlug: 'obiad',
    maxPrice: 20,
  },
  {
    slug: 'dla-rodziny-do-40-zl',
    title: 'Dla rodziny do 40 zł',
    description: 'Dania dla całej rodziny w cenie do 40 zł.',
    categorySlug: 'rodzinne',
    maxPrice: 40,
  },
  {
    slug: 'gotowe-w-20-minut',
    title: 'Gotowe w 20 minut',
    description: 'Szybkie przepisy na wieczór — maksymalnie 20 minut.',
    maxTime: 20,
  },
  {
    slug: 'tanie-kolacje',
    title: 'Tanie kolacje',
    description: 'Lekkie i tanie kolacje z promocji, do 15 zł.',
    categorySlug: 'kolacja',
    maxPrice: 15,
  },
  {
    slug: 'wege-tanio',
    title: 'Wege tanio',
    description: 'Bezmięsne dania z promocji w niskiej cenie.',
    categorySlug: 'wege',
    maxPrice: 20,
  },
  {
    slug: 'caly-obiad-do-30-zl',
    title: 'Cały obiad do 30 zł',
    description: 'Kompletne obiady z promocji za nie więcej niż 30 zł.',
    maxPrice: 30,
  },
]

export function getCollection(slug: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug)
}
