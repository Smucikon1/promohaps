import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Polityka prywatności',
  description: 'Zasady przetwarzania danych i wykorzystania cookies w serwisie Sapri.',
  robots: { index: true, follow: true },
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-amber-600 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Wróć do przepisów
      </Link>

      <h1 className="text-3xl font-bold text-stone-900 mb-6" style={{ fontFamily: 'var(--font-serif)' }}>
        Polityka prywatności
      </h1>

      <div className="space-y-6 text-stone-700 leading-relaxed">
        <p className="text-sm text-stone-400">
          Dokument stanowi szablon i wymaga uzupełnienia danymi administratora oraz weryfikacji prawnej przed publikacją produkcyjną.
        </p>

        <section>
          <h2 className="text-lg font-bold text-stone-900 mb-2">1. Administrator danych</h2>
          <p>Administratorem danych jest <strong>[nazwa firmy / imię i nazwisko]</strong>, kontakt: <strong>[adres e-mail]</strong>.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-stone-900 mb-2">2. Jakie dane przetwarzamy</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Anonimowa analityka</strong> — losowy identyfikator sesji zapisywany w Twojej przeglądarce (localStorage) oraz zdarzenia (np. otwarcie przepisu). Nie zbieramy imienia, e-maila ani innych danych osobowych.</li>
            <li><strong>Dane zapisywane lokalnie</strong> — ulubione przepisy, jadłospis i lista zakupów są przechowywane wyłącznie w Twojej przeglądarce i nie trafiają na nasze serwery.</li>
            <li><strong>Reklamy</strong> — jeśli wyrazisz zgodę, dostawcy reklam (np. Google) mogą używać cookies do personalizacji i pomiaru.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-stone-900 mb-2">3. Zgoda i cookies</h2>
          <p>Analitykę i reklamy uruchamiamy dopiero po wyrażeniu przez Ciebie zgody. Zgodę możesz w każdej chwili wycofać, czyszcząc dane witryny w przeglądarce.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-stone-900 mb-2">4. Odbiorcy danych</h2>
          <p>Korzystamy z zaufanych dostawców infrastruktury: <strong>Supabase</strong> (baza danych, hosting treści) oraz <strong>Vercel</strong> (hosting aplikacji). Po włączeniu reklam — <strong>Google AdSense</strong>.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-stone-900 mb-2">5. Twoje prawa</h2>
          <p>Masz prawo dostępu do danych, ich sprostowania, usunięcia oraz sprzeciwu. W sprawach dotyczących danych napisz na <strong>[adres e-mail]</strong>.</p>
        </section>

        <p className="text-sm text-stone-400 pt-4 border-t border-stone-100">
          Ostatnia aktualizacja: {new Date().toLocaleDateString('pl-PL')}
        </p>
      </div>
    </div>
  )
}
