import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin'],
      },
    ],
    sitemap: 'https://przepisnik-z-gazetek.pl/sitemap.xml',
  }
}
