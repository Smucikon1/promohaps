import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// Generator przepisów AI: na podstawie sklepu + tematu/produktów z gazetki
// zwraca ustrukturyzowany JSON zgodny ze schematem formularza przepisu.
export async function POST(request: Request) {
  // Autoryzacja — tylko zalogowany admin (endpoint nie jest chroniony przez proxy.ts)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Brak ANTHROPIC_API_KEY w konfiguracji serwera.' },
      { status: 500 }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })
  }

  const storeSlug: string = body.storeSlug ?? ''
  const storeName: string = body.storeName ?? ''
  const theme: string = (body.theme ?? '').toString().slice(0, 300)
  const categorySlugs: string[] = Array.isArray(body.categorySlugs) ? body.categorySlugs : []
  const promoProducts: any[] = Array.isArray(body.promoProducts) ? body.promoProducts : []

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
    'Jesteś doświadczonym polskim autorem przepisów kulinarnych dla serwisu, którego misją jest tanie gotowanie',
    'z produktów na promocji z gazetek sieci handlowych. Tworzysz apetyczne, realistyczne przepisy domowej kuchni',
    'z tanich, łatwo dostępnych składników.',
    '',
    'Zasady:',
    '- Pisz po polsku, naturalnie i konkretnie.',
    '- Ceny podawaj w PLN, realistyczne dla polskich sklepów; suma cen składników powinna z grubsza odpowiadać price_total.',
    '- Oznacz is_promo_product: true dla składników, które w przepisie pochodzą z promocji/gazetki.',
    '- meta_title do ~60 znaków, meta_description do ~155 znaków, zoptymalizowane pod SEO.',
    '- slug: małe litery, bez polskich znaków, słowa oddzielone myślnikami.',
    '- Nie kopiuj treści ani grafik gazetek — twórz własny, oryginalny przepis (fakty: nazwy i ceny produktów są dozwolone).',
    '- difficulty: dokładnie jedno z latwy|sredni|trudny.',
  ].join('\n')

  const userPayload = {
    sklep: { slug: storeSlug, nazwa: storeName },
    temat: theme || '(dowolny — dobierz sam apetyczny, tani przepis)',
    dostepne_kategorie: categorySlugs,
    produkty_z_gazetki: promoProducts,
    instrukcja: 'Wygeneruj jeden kompletny przepis zgodny ze schematem. Wykorzystaj produkty z gazetki jako składniki, jeśli podano.',
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: JSON.stringify(userPayload) }],
    } as any)

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'Model odmówił wygenerowania treści.' }, { status: 422 })
    }

    const textBlock = response.content.find((b: any) => b.type === 'text') as { text: string } | undefined
    if (!textBlock) {
      return NextResponse.json({ error: 'Pusta odpowiedź modelu.' }, { status: 502 })
    }

    const recipe = JSON.parse(textBlock.text)
    return NextResponse.json({ recipe })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Błąd generowania: ${e?.message ?? 'nieznany'}` },
      { status: 500 }
    )
  }
}
