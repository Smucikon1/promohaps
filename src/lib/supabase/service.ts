import { createClient } from '@supabase/supabase-js'

/**
 * Klient z kluczem serwisowym — WYŁĄCZNIE do zadań cyklicznych.
 *
 * Zadanie z crona leci bez sesji użytkownika, więc klucz anon nie przejdzie przez RLS
 * przy kasowaniu wygasłych promocji. Ten klient omija RLS całkowicie, dlatego nie wolno
 * go importować w niczym, co obsługuje ruch użytkownika — tylko trasy /api/cron.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY — ustaw je w zmiennych środowiskowych Vercela.'
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
