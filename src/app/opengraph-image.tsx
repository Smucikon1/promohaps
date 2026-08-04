import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Promohaps — przepisy z gazetek promocyjnych'

// Satori wymaga explicit `display: flex` na każdym elemencie z >1 dzieckiem.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background: 'linear-gradient(135deg, #faf9f6 0%, #e6f9f0 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: '#12b76a' }}>Promohaps</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              padding: '10px 20px',
              background: '#12b76a',
              color: 'white',
              borderRadius: '999px',
              fontSize: 22,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Przepisy gazetkowe
          </div>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, color: '#1a1a1a', lineHeight: 1.05, maxWidth: 1000 }}>
            Oszczędzaj, gotując z gazetek promocyjnych
          </div>
        </div>
        <div style={{ display: 'flex', gap: '20px', fontSize: 24, color: '#57534e', fontWeight: 600, flexWrap: 'wrap' }}>
          <span>Biedronka</span>
          <span>Lidl</span>
          <span>Kaufland</span>
          <span>Dino</span>
          <span>Netto</span>
          <span>Auchan</span>
          <span>Carrefour</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
