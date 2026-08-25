import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateRecipeImage } from '@/lib/recipeImage'
import { buildImagePrompt } from '@/lib/imagePrompt'
import { dishOfTitle } from '@/lib/popularDishes'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Dogrywa zdjęcie do istniejącego przepisu.
 *
 * Osobna trasa, bo generowanie przepisu zajmuje realnie ponad 40 sekund, a Vercel
 * ubija funkcję po 60. Doklejone do tego zdjęcie — które przy `Prefer: wait` potrafi
 * czekać kolejne 25 s — regularnie przekraczało budżet. Rozdzielone: każde żądanie
 * ma własne 60 s i mieści się z zapasem.
 *
 * Efekt uboczny jest równie cenny: nieudane zdjęcie nie kosztuje już przepisu, da się
 * je ponowić, a przepisy, które zostały bez zdjęcia wcześniej, można uzupełnić tak samo.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const recipeId = String(body?.recipeId ?? '').trim()
  if (!recipeId) return NextResponse.json({ error: 'Brak recipeId.' }, { status: 400 })

  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('id, slug, title, image_url, ingredients(name, price)')
    .eq('id', recipeId)
    .maybeSingle()

  if (error || !recipe) {
    return NextResponse.json({ error: 'Nie znaleziono przepisu.' }, { status: 404 })
  }
  // Domyślnie nie ruszamy przepisu, który zdjęcie już ma — automat wołający tę
  // trasę po każdym szkicu nie powinien nadpisywać cudzej pracy. Przycisk
  // w formularzu podaje force, bo tam podmiana jest właśnie tym, o co prosisz.
  if (recipe.image_url && body?.force !== true) {
    return NextResponse.json({ hasImage: true, pominiete: 'przepis ma już zdjęcie' })
  }

  // ZANIM cokolwiek wygenerujemy: może to danie ma już zdjęcie w katalogu.
  //
  // Schabowy wygląda jak schabowy — dziesiąte zdjęcie tego samego dania nie wnosi nic,
  // a kosztuje i czas, i pieniądze. Adres jest publiczny, więc wystarczy wpisać ten sam
  // image_url; nic nie kopiujemy w storage.
  //
  // Pomijamy to przy force — jeśli ktoś kliknął „Wygeneruj AI", chce NOWEGO zdjęcia,
  // a nie podstawienia cudzego.
  if (body?.force !== true) {
    const danie = dishOfTitle(recipe.title ?? '')
    if (danie) {
      const { data: zeZdjeciem } = await supabase
        .from('recipes')
        .select('id, title, image_url')
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .neq('id', recipeId)
        .order('created_at', { ascending: false })
        .limit(300)

      const bliznjak = (zeZdjeciem ?? []).find(
        (r: any) => dishOfTitle(r.title ?? '')?.nazwa === danie.nazwa
      )

      if (bliznjak?.image_url) {
        const { error: updErr } = await supabase
          .from('recipes')
          .update({ image_url: bliznjak.image_url })
          .eq('id', recipeId)

        if (!updErr) {
          return NextResponse.json({
            hasImage: true,
            imageUrl: bliznjak.image_url,
            ponownieUzyte: true,
            zPrzepisu: bliznjak.title,
          })
        }
        // Gdy zapis się nie uda, lecimy dalej i generujemy normalnie
      }
    }
  }

  // Prompt z generatora jest po angielsku i lepiej opisuje kadr, więc gdy klient go
  // przekazał — używamy go. Dla przepisów uzupełnianych po czasie zostaje wersja
  // odtworzona ze składników, bo oryginalny prompt nigdzie nie jest zapisywany.
  const prompt =
    String(body?.prompt ?? '').trim() ||
    buildImagePrompt(recipe.title ?? '', (recipe as any).ingredients ?? [])

  const image = await generateRecipeImage(prompt, recipe.slug ?? recipeId, supabase)

  if (!image.url) {
    return NextResponse.json(
      { hasImage: false, error: image.warning ?? 'Nie udało się wygenerować zdjęcia.' },
      { status: 502 }
    )
  }

  const { error: updErr } = await supabase
    .from('recipes')
    .update({ image_url: image.url })
    .eq('id', recipeId)

  if (updErr) {
    return NextResponse.json({ hasImage: false, error: `Zapis: ${updErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ hasImage: true, imageUrl: image.url })
}
