import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Megaphone, Target, BarChart3, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Reklama i współpraca',
  description: 'Dotrzyj do osób planujących zakupy spożywcze i gotowanie z promocji. Reklama displayowa i przepisy sponsorowane w Sapri.',
  robots: { index: true, follow: true },
}

const FORMATS = [
  { icon: Megaphone, title: 'Przepis sponsorowany', desc: 'Przepis wykorzystujący Twój produkt, oznaczony jako „Materiał sponsorowany", wyróżniony na stronie głównej i w wynikach.' },
  { icon: Target, title: 'Produkt w gazetce', desc: 'Twój produkt jako wyróżniona pozycja „z gazetki" w przepisach i na liście zakupów użytkownika.' },
  { icon: BarChart3, title: 'Reklama displayowa', desc: 'Bannery w kluczowych miejscach: strona główna, strony przepisów, lista zakupów.' },
]

export default function AdvertisePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-amber-600 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Wróć do przepisów
      </Link>

      <h1 className="text-3xl md:text-4xl font-bold text-stone-900 mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
        Dotrzyj do kupujących w momencie decyzji
      </h1>
      <p className="text-lg text-stone-600 mb-10 max-w-2xl">
        Nasi użytkownicy planują tygodniowe zakupy i szukają oszczędności na produktach z promocji — to idealny moment,
        by pokazać im Twój produkt.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {FORMATS.map((f) => (
          <div key={f.title} className="bg-white rounded-2xl border border-stone-100 p-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <f.icon className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-stone-800 mb-1">{f.title}</h2>
            <p className="text-sm text-stone-500">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h2 className="font-bold text-stone-900 text-lg">Porozmawiajmy o kampanii</h2>
          <p className="text-sm text-stone-500 mt-1">Wyślemy media-kit z aktualnymi statystykami zasięgu i cennikiem.</p>
        </div>
        <a
          href="mailto:[adres e-mail]?subject=Reklama w Sapri"
          className="btn-primary inline-flex items-center gap-2 justify-center"
        >
          <Mail className="w-4 h-4" />
          Napisz do nas
        </a>
      </div>

      <p className="text-xs text-stone-400 mt-6">
        Treści sponsorowane są zawsze wyraźnie oznaczane zgodnie z wytycznymi UOKiK.
      </p>
    </div>
  )
}
