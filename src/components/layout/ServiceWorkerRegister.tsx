'use client'

import { useEffect } from 'react'

/**
 * Rejestruje service workera — warunek instalowalności PWA.
 *
 * Ten komponent do v3 robił coś dokładnie odwrotnego: aktywnie WYREJESTROWYWAŁ
 * każdego workera i czyścił cache. Powód był słuszny — stary worker cache'ował
 * zasoby zależne od builda i po każdej przebudowie serwował nieaktualne strony.
 * Skutkiem ubocznym było jednak to, że Chrome nigdy nie uznał serwisu za
 * instalowalny, bo wymaga zarejestrowanego workera z obsługą zdarzenia „fetch",
 * i dlatego nie proponował dodania aplikacji do ekranu głównego.
 *
 * Nowy worker (public/sw.js v3) działa network-first i przechwytuje wyłącznie
 * nawigacje, więc przy działającym internecie nie ma jak podać nieaktualnej
 * treści. Rejestracja jest znowu bezpieczna.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const rejestruj = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          // Bez tego przeglądarka potrafi podać sam plik sw.js z własnego cache
          // i nowa wersja workera nie wchodzi tygodniami.
          updateViaCache: 'none',
        })
        // Wymuszamy sprawdzenie aktualizacji przy każdym wejściu
        reg.update().catch(() => {})
      } catch {
        // Brak workera to nie powód, żeby cokolwiek psuć użytkownikowi —
        // serwis działa normalnie, traci tylko tryb offline i instalowalność.
      }
    }

    // Po załadowaniu strony, żeby rejestracja nie konkurowała o pasmo
    // z zasobami potrzebnymi do pierwszego wyrenderowania.
    if (document.readyState === 'complete') rejestruj()
    else {
      window.addEventListener('load', rejestruj, { once: true })
      return () => window.removeEventListener('load', rejestruj)
    }
  }, [])

  return null
}
