import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-7xl mb-6">🍽️</div>
        <h1 className="text-4xl font-bold text-stone-800 mb-3" style={{ fontFamily: 'var(--font-serif)' }}>
          Nie znaleziono strony
        </h1>
        <p className="text-stone-500 text-lg mb-8">
          Strona, której szukasz, nie istnieje lub została przeniesiona.
        </p>
        <Link href="/" className="btn-primary inline-block">
          ← Wróć do przepisów
        </Link>
      </div>
    </div>
  )
}
