// Bazowy adres serwisu — ustaw NEXT_PUBLIC_SITE_URL na Vercel po podpięciu domeny.
// Fallback pozwala budować lokalnie i przed kupnem docelowej domeny.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://przepisnik-z-gazetek.pl'
).replace(/\/$/, '')
