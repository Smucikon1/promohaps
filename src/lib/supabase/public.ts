import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Klient bez ciasteczek — do publicznych zapytań tylko-do-odczytu.
// Brak cookies() to warunek, żeby wynik dało się cache'ować MIĘDZY żądaniami
// (createClient z server.ts czyta ciasteczka, więc każde żądanie liczy się od nowa).
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
