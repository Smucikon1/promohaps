import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'zGazetki — przepisy z promocji',
    short_name: 'zGazetki',
    description: 'zGazetki — przepisy dopasowane do aktualnych promocji w Biedronce, Lidlu, Auchan, Carrefour i Kauflandzie.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf9f6',
    theme_color: '#12b76a',
    lang: 'pl',
    categories: ['food', 'lifestyle', 'shopping'],
    // Chrome na Androidzie uznaje aplikację za instalowalną dopiero, gdy manifest
    // ma rastrowe ikony 192 i 512. Przy samym SVG kryterium nie było spełnione
    // i przeglądarka nie proponowała instalacji po odinstalowaniu aplikacji.
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
