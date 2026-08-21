// Powiadomienia mailowe dla administratora (zadania cykliczne).
//
// Celowo bez biblioteki — Resend ma zwykłe REST API, a jedno wywołanie fetch nie jest
// warte kolejnej zależności w package.json i kolejnej rzeczy do aktualizowania.

const RESEND = 'https://api.resend.com/emails'

export interface MailResult {
  wyslany: boolean
  powod?: string
}

/**
 * Wysyła maila do administratora.
 *
 * Nigdy nie rzuca wyjątkiem: brak konfiguracji albo awaria dostawcy nie może wywrócić
 * całego zadania cyklicznego — sprzątanie bazy ma się wykonać nawet wtedy, gdy poczta
 * nie działa. Powód porażki wraca w wyniku i ląduje w logach Vercela.
 */
export async function powiadomAdmina(temat: string, tresc: string): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY
  const to = process.env.ADMIN_EMAIL
  // Domena nadawcy musi być zweryfikowana w Resend. Do pierwszych testów działa
  // onboarding@resend.dev, ale trafia wyłącznie na adres właściciela konta.
  const from = process.env.MAIL_FROM ?? 'zGazetki <onboarding@resend.dev>'

  if (!key) return { wyslany: false, powod: 'brak RESEND_API_KEY' }
  if (!to) return { wyslany: false, powod: 'brak ADMIN_EMAIL' }

  try {
    const res = await fetch(RESEND, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject: temat, text: tresc }),
    })

    if (!res.ok) {
      const szczegoly = await res.text().catch(() => '')
      return { wyslany: false, powod: `Resend ${res.status}: ${szczegoly.slice(0, 200)}` }
    }
    return { wyslany: true }
  } catch (e: any) {
    return { wyslany: false, powod: e?.message ?? 'nieznany błąd sieci' }
  }
}
