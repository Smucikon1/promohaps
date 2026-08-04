import type { NextConfig } from 'next'

// Globalne nagłówki bezpieczeństwa. Bez CSP (skomplikowane z Next inline styles);
// resztę bierzemy, bo są bezpłatne i eliminują całe klasy podatności (clickjacking,
// MIME sniffing, referer leak, downgrade do HTTP).
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'zcjfarhgtatcjylkdjmq.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
