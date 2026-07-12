import type { Metadata, Viewport } from 'next'
import { Sora, Plus_Jakarta_Sans } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnalyticsBanner } from '@/components/layout/AnalyticsBanner'
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

const sora = Sora({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Przepisnik z Gazetek | Przepisy z promocji Biedronka, Lidl, Auchan, Carrefour',
    template: '%s | Przepisnik z Gazetek',
  },
  description: 'Przepisy kulinarne oparte na aktualnych promocjach w Biedronce, Lidlu, Auchan i Carrefour. Gotuj taniej korzystając z gazetek promocyjnych.',
  keywords: ['przepisy', 'gazetka promocyjna', 'biedronka', 'lidl', 'auchan', 'carrefour', 'tanie gotowanie'],
  openGraph: { type: 'website', locale: 'pl_PL', siteName: 'Przepisnik z Gazetek' },
  robots: { index: true, follow: true },
  applicationName: 'Przepisnik',
  appleWebApp: { capable: true, title: 'Przepisnik', statusBarStyle: 'default' },
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
    <html lang="pl" className={`${jakarta.variable} ${sora.variable}`}>
      <body>
        <ServiceWorkerRegister />
        <Header />
        <main className="min-h-screen pb-20 md:pb-0">{children}</main>
        <BottomNav />
        <AnalyticsBanner />
        <footer className="hidden md:block bg-white border-t border-stone-100 py-8 mt-16">
          <div className="max-w-6xl mx-auto px-4 text-center text-stone-500 text-sm">
            <p>© {new Date().getFullYear()} Przepisnik z Gazetek · Polska</p>
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
