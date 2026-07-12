import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Przepisnik z Gazetek',
    short_name: 'Przepisnik',
    description: 'Przepisy dopasowane do aktualnych promocji w Biedronce, Lidlu, Auchan i Carrefour.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf9f6',
    theme_color: '#f59e0b',
    lang: 'pl',
    categories: ['food', 'lifestyle', 'shopping'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
