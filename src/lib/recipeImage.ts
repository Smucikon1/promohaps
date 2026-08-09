import { createClient } from '@/lib/supabase/server'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

const BUCKET = 'recipe-images'
// flux-schnell: ~2 s i ułamek grosza za zdjęcie. Do fotografii jedzenia w zupełności
// wystarcza, a przy setkach przepisów różnica w koszcie wobec większych modeli jest realna.
const MODEL = 'black-forest-labs/flux-schnell'

// Replicate potrafi odpowiedzieć synchronicznie (Prefer: wait) — bez tego trzeba by
// odpytywać w pętli, co przy limicie 60 s funkcji na Vercelu jest ryzykowne.
const REPLICATE_WAIT_S = 25
const DOWNLOAD_TIMEOUT_MS = 20_000

/**
 * Generuje zdjęcie dania i wrzuca je do Supabase Storage.
 * Zwraca publiczny URL albo null — brak zdjęcia nigdy nie może wywalić tworzenia przepisu,
 * bo przepis bez zdjęcia jest wciąż użyteczny, a nieudany zapis kosztowałby całą generację.
 */
export async function generateRecipeImage(
  prompt: string,
  slug: string,
  supabase: ServerSupabase
): Promise<{ url: string | null; warning?: string }> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) return { url: null } // funkcja wyłączona — cisza, nie błąd
  if (!prompt?.trim()) return { url: null, warning: 'Model nie zwrócił opisu zdjęcia.' }

  try {
    const res = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: `wait=${REPLICATE_WAIT_S}`,
      },
      body: JSON.stringify({
        input: {
          prompt: prompt.trim(),
          aspect_ratio: '3:2', // proporcje kafelka przepisu
          output_format: 'webp',
          output_quality: 85,
          num_outputs: 1,
        },
      }),
      signal: AbortSignal.timeout((REPLICATE_WAIT_S + 5) * 1000),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { url: null, warning: `Generator zdjęć odmówił (${res.status}). ${detail.slice(0, 120)}` }
    }

    const data = await res.json()
    if (data.status === 'failed') {
      return { url: null, warning: `Nie udało się wygenerować zdjęcia: ${data.error ?? 'nieznany błąd'}` }
    }

    // Przy Prefer: wait zwykle jest już 'succeeded'; gdy model nie zdążył, output bywa pusty
    const imageUrl: string | undefined = Array.isArray(data.output) ? data.output[0] : data.output
    if (!imageUrl) return { url: null, warning: 'Generator zdjęć nie zdążył w wyznaczonym czasie.' }

    const img = await fetch(imageUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
    if (!img.ok) return { url: null, warning: 'Nie udało się pobrać wygenerowanego zdjęcia.' }
    const bytes = await img.arrayBuffer()

    // Adresy z Replicate wygasają, więc trzymamy kopię u siebie
    const path = `ai/${slug}-${Date.now()}.webp`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: 'image/webp', upsert: false })

    if (upErr) return { url: null, warning: `Zapis zdjęcia do storage nie powiódł się: ${upErr.message}` }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return { url: pub.publicUrl }
  } catch (e: any) {
    const msg = e?.name === 'TimeoutError' ? 'przekroczono czas oczekiwania' : (e?.message ?? 'nieznany błąd')
    return { url: null, warning: `Generowanie zdjęcia nie powiodło się: ${msg}` }
  }
}
