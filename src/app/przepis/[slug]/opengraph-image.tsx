import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'
import { savingsPercent, regularPrice } from '@/lib/savings'
import { pricePerServing, hasActivePromo } from '@/lib/utils'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Promohaps'

// Dynamiczny OG per przepis — tytuł, cena, % oszczędności. Fallback do domyślnego, gdy braknie danych.
// Satori (silnik pod ImageResponse) wymaga explicit display: flex na każdym elemencie z >1 dzieckiem.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: recipe } = await supabase
    .from('recipes')
    .select('title, price_total, servings, image_url, store:stores(name), promo_products(price_promo, price_regular, valid_from, valid_to)')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  const title = recipe?.title ?? 'Promohaps — przepisy z gazetek promocyjnych'
  const storeName = (recipe?.store as any)?.name as string | undefined
  const promos = (recipe?.promo_products as any) ?? []
  // Po wygaśnięciu promocji nie wolno rozsyłać w social mediach nieaktualnej ceny
  const price = hasActivePromo(promos) ? recipe?.price_total : regularPrice(recipe?.price_total, promos)
  const percent = savingsPercent(recipe?.price_total, promos)
  const perServing = pricePerServing(price, recipe?.servings)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#faf9f6',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {recipe?.image_url ? (
          <img
            src={recipe.image_url}
            alt=""
            width={520}
            height={630}
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div style={{ display: 'flex', width: 520, height: 630, background: '#e6f9f0' }} />
        )}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '60px',
            flex: 1,
            background: '#faf9f6',
          }}
        >
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 800, color: '#12b76a' }}>Promohaps</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {storeName && (
              <div style={{ display: 'flex', alignSelf: 'flex-start', padding: '8px 18px', background: '#12b76a', color: 'white', borderRadius: 999, fontSize: 20, fontWeight: 700 }}>
                {storeName}
              </div>
            )}
            <div style={{ display: 'flex', fontSize: 48, fontWeight: 800, color: '#1a1a1a', lineHeight: 1.1 }}>
              {title.length > 80 ? title.slice(0, 77) + '…' : title}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {/* Cena za porcję na pierwszym planie — najmocniejszy argument w podglądzie linku */}
            {perServing != null && (
              <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 24px', background: '#e6f9f0', borderRadius: 20 }}>
                <span style={{ fontSize: 18, color: '#0c7d49' }}>Za porcję</span>
                <span style={{ fontSize: 40, fontWeight: 800, color: '#0c7d49' }}>{perServing.toFixed(2).replace('.', ',')} zł</span>
              </div>
            )}
            {typeof price === 'number' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 18, color: '#78716c' }}>Całość</span>
                <span style={{ fontSize: 40, fontWeight: 800, color: '#1a1a1a' }}>{price.toFixed(2).replace('.', ',')} zł</span>
              </div>
            )}
            {percent > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 24px', background: '#dcfce7', borderRadius: 20 }}>
                <span style={{ fontSize: 18, color: '#166534' }}>Oszczędzasz</span>
                <span style={{ fontSize: 40, fontWeight: 800, color: '#166534' }}>−{percent}%</span>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
