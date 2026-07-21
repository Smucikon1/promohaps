import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sapri — przepisy z promocji',
    short_name: 'Sapri',
    description: 'Sapri — przepisy dopasowane do aktualnych promocji w Biedronce, Lidlu, Auchan, Carrefour i Kauflandzie.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf9f6',
    theme_color: '#1595ff',
    lang: 'pl',
    categories: ['food', 'lifestyle', 'shopping'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
