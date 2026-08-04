// Ikona airfryera (frytkownicy beztłuszczowej) — liniowa, w stylu załączonego wzoru.
export function AirfryerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Korpus: zaokrąglony u góry, węższe zaokrąglenia u dołu */}
      <path d="M14 5h20a8 8 0 0 1 8 8v26a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V13a8 8 0 0 1 8-8z" />
      {/* Panel: pokrętło i kropka */}
      <circle cx="28" cy="14.5" r="5" />
      <circle cx="17.5" cy="14.5" r="1.6" />
      {/* Linia oddzielająca kosz */}
      <line x1="6" y1="25" x2="42" y2="25" />
      {/* Uchwyt kosza */}
      <path d="M21 25v9a3 3 0 0 0 6 0v-9" />
    </svg>
  )
}
