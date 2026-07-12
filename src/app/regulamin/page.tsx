import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Regulamin',
  description: 'Regulamin korzystania z serwisu Przepisnik z Gazetek.',
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-amber-600 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Wróć do przepisów
      </Link>

      <h1 className="text-3xl font-bold text-stone-900 mb-6" style={{ fontFamily: 'var(--font-serif)' }}>
        Regulamin
      </h1>

      <div className="space-y-6 text-stone-700 leading-relaxed">
        <p className="text-sm text-stone-400">
          Dokument stanowi szablon i wymaga uzupełnienia danymi usługodawcy oraz weryfikacji prawnej przed publikacją produkcyjną.
        </p>

        <section>
          <h2 className="text-lg font-bold text-stone-900 mb-2">1. Postanowienia ogólne</h2>
          <p>Serwis „Przepisnik z Gazetek" udostępnia przepisy kulinarne powiązane z aktualnymi promocjami w sieciach handlowych. Usługodawcą jest <strong>[nazwa firmy / imię i nazwisko]</strong>.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-stone-900 mb-2">2. Zasady korzystania</h2>
          <p>Korzystanie z serwisu jest bezpłatne i nie wymaga rejestracji. Treści służą do użytku osobistego.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-stone-900 mb-2">3. Ceny i promocje</h2>
          <p>Ceny oraz oszczędności mają charakter <strong>orientacyjny</strong> i mogą różnić się od cen w sklepie. Nie gwarantujemy dostępności ani aktualności promocji — wiążące są informacje w danym sklepie i jego oficjalnej gazetce.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-stone-900 mb-2">4. Odpowiedzialność</h2>
          <p>Dokładamy starań, aby treści były rzetelne, jednak nie ponosimy odpowiedzialności za decyzje zakupowe podjęte na ich podstawie. Nazwy sieci handlowych należą do ich właścicieli; serwis nie jest z nimi powiązany.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-stone-900 mb-2">5. Kontakt</h2>
          <p>Pytania i reklamacje: <strong>[adres e-mail]</strong>.</p>
        </section>

        <p className="text-sm text-stone-400 pt-4 border-t border-stone-100">
          Ostatnia aktualizacja: {new Date().toLocaleDateString('pl-PL')}
        </p>
      </div>
    </div>
  )
}
