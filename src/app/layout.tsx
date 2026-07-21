import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnalyticsBanner } from '@/components/layout/AnalyticsBanner'
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister'

// Outfit dla całego dokumentu — tekst (--font-sans) i nagłówki (--font-serif)
const outfitSans = Outfit({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

const outfitDisplay = Outfit({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Sapri — przepisy z promocji: Biedronka, Lidl, Auchan, Carrefour, Kaufland',
    template: '%s | Sapri',
  },
  description: 'Sapri — przepisy kulinarne oparte na aktualnych promocjach w Biedronce, Lidlu, Auchan, Carrefour i Kauflandzie. Gotuj taniej dzięki gazetkom promocyjnym.',
  keywords: ['sapri', 'przepisy', 'gazetka promocyjna', 'biedronka', 'lidl', 'auchan', 'carrefour', 'kaufland', 'tanie gotowanie'],
  openGraph: { type: 'website', locale: 'pl_PL', siteName: 'Sapri' },
  robots: { index: true, follow: true },
  applicationName: 'Sapri',
  appleWebApp: { capable: true, title: 'Sapri', statusBarStyle: 'default' },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#f59e0b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${outfitSans.variable} ${outfitDisplay.variable}`}>
      <body>
        <ServiceWorkerRegister />
        <Header />
        <main className="min-h-screen pb-20 md:pb-0">{children}</main>
        <BottomNav />
        <AnalyticsBanner />
        <footer className="hidden md:block bg-white border-t border-stone-100 py-8 mt-16">
          <div className="max-w-6xl mx-auto px-4 text-center text-stone-500 text-sm">
            <p>© {new Date().getFullYear()} Sapri</p>
            <p className="mt-1">Przepisy tworzone na podstawie aktualnych gazetek promocyjnych</p>
            <p className="mt-3 flex items-center justify-center gap-4">
              <Link href="/polityka-prywatnosci" className="hover:text-stone-600 transition-colors">Polityka prywatności</Link>
              <Link href="/regulamin" className="hover:text-stone-600 transition-colors">Regulamin</Link>
              <Link href="/reklama" className="hover:text-stone-600 transition-colors">Reklama</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
