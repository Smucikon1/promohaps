// Serwerowy moduł AI (Claude Opus 4.8). NIE importować w kodzie klienta.
import Anthropic from '@anthropic-ai/sdk'

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Brak ANTHROPIC_API_KEY w konfiguracji serwera.')
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function firstText(response: any): string {
  const block = response.content?.find((b: any) => b.type === 'text')
  if (!block) throw new Error('Pusta odpowiedź modelu.')
  return block.text
}

// ---------- Generowanie przepisu ----------

export interface GenerateRecipeInput {
  storeSlug: string
  storeName: string
  theme?: string
  categorySlugs?: string[]
  promoProducts?: any[]
}

export async function generateRecipeJson(input: GenerateRecipeInput): Promise<any> {
  const { storeSlug, storeName, theme, categorySlugs = [], promoProducts = [] } = input

  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      store_slug: { type: 'string', enum: storeSlug ? [storeSlug] : undefined },
      category_slugs: {
        type: 'array',
        items: categorySlugs.length ? { type: 'string', enum: categorySlugs } : { type: 'string' },
      },
      prep_time_min: { type: 'integer' },
      difficulty: { type: 'string', enum: ['latwy', 'sredni', 'trudny'] },
      servings: { type: 'integer' },
      price_total: { type: 'number' },
      meta_title: { type: 'string' },
      meta_description: { type: 'string' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'string' },
            unit: { type: 'string' },
            price: { type: 'number' },
            is_promo_product: { type: 'boolean' },
          },
          required: ['name', 'amount', 'unit', 'price', 'is_promo_product'],
          additionalProperties: false,
        },
      },
      steps: { type: 'array', items: { type: 'string' } },
      promos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            price_promo: { type: 'number' },
            price_regular: { type: 'number' },
          },
          required: ['name', 'price_promo', 'price_regular'],
          additionalProperties: false,
        },
      },
    },
    required: [
      'title', 'slug', 'description', 'store_slug', 'category_slugs', 'prep_time_min',
      'difficulty', 'servings', 'price_total', 'meta_title', 'meta_description',
      'ingredients', 'steps', 'promos',
    ],
    additionalProperties: false,
  }

  const system = [
    'Jesteś doświadczonym polskim autorem przepisów dla serwisu o tanim gotowaniu z gazetek promocyjnych.',
    'Tworzysz apetyczne, realistyczne przepisy domowej kuchni z tanich, dostępnych składników.',
    'Zasady: pisz po polsku; ceny w PLN realistyczne dla polskich sklepów (suma cen składników ~ price_total);',
    'is_promo_product: true dla składników z promocji/gazetki; meta_title ~60 zn., meta_description ~155 zn.;',
    'slug bez polskich znaków, myślniki; difficulty dokładnie jedno z latwy|sredni|trudny;',
    'nie kopiuj treści gazetek — twórz oryginalny przepis (fakty: nazwy i ceny produktów są dozwolone).',
  ].join('\n')

  const payload = {
    sklep: { slug: storeSlug, nazwa: storeName },
    temat: theme || '(dowolny — dobierz apetyczny, tani przepis)',
    dostepne_kategorie: categorySlugs,
    produkty_z_gazetki: promoProducts,
    instrukcja: 'Wygeneruj jeden kompletny przepis zgodny ze schematem, wykorzystując produkty z gazetki jako składniki, jeśli podano.',
  }

  const response = await client().messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  } as any)

  if (response.stop_reason === 'refusal') throw new Error('Model odmówił wygenerowania treści.')
  const recipe = JSON.parse(firstText(response))

  // Cena całości liczona deterministycznie z cen składników — model bywa niespójny,
  // a kafelek („Cena całości") i strona przepisu („Razem") muszą pokazywać to samo.
  const sum = (recipe.ingredients ?? []).reduce(
    (acc: number, i: any) => acc + (typeof i?.price === 'number' ? i.price : 0),
    0
  )
  if (sum > 0) recipe.price_total = Math.round(sum * 100) / 100

  return recipe
}

// ---------- Odczyt gazetki (wizja) ----------

export interface LeafletImage {
  base64: string
  mediaType: string // image/jpeg | image/png | image/webp
}

export interface ExtractLeafletInput {
  images: LeafletImage[]
  storeName?: string
}

export async function extractLeafletProducts(input: ExtractLeafletInput): Promise<any[]> {
  const { images, storeName = '' } = input
  if (!images?.length) return []

  const schema = {
    type: 'object',
    properties: {
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            price_promo: { type: 'number' },
            price_regular: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          },
          required: ['name', 'price_promo', 'price_regular'],
          additionalProperties: false,
        },
      },
    },
    required: ['products'],
    additionalProperties: false,
  }

  const mediaBlocks = images.map((img) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
  }))

  const many = images.length > 1
  const instruction = [
    `Z załączonych ${many ? `${images.length} stron` : 'strony'} gazetki promocyjnej${storeName ? ` sklepu ${storeName}` : ''}`,
    'wypisz WSZYSTKIE produkty spożywcze wraz z ceną promocyjną (price_promo)',
    'i — jeśli widoczna — ceną regularną (price_regular, inaczej null).',
    'Ignoruj produkty niespożywcze (chemia, AGD itp.) i reklamy. Ceny podawaj jako liczby w PLN.',
    'Nazwy skróć do rozpoznawalnej nazwy produktu (np. „Filet z kurczaka 1kg").',
    many ? 'Nie pomijaj żadnej strony i nie duplikuj tego samego produktu.' : '',
  ].filter(Boolean).join(' ')

  const response = await client().messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: [...mediaBlocks, { type: 'text', text: instruction }] }],
  } as any)

  if (response.stop_reason === 'refusal') throw new Error('Model odmówił odczytu.')
  const parsed = JSON.parse(firstText(response))
  return Array.isArray(parsed.products) ? parsed.products : []
}
