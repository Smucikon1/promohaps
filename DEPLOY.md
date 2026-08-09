# Wydanie aplikacji — krok po kroku

Kolejność ma znaczenie: najpierw zabezpiecz bazę, potem wdróż.

## 1. Supabase — zabezpieczenie (panel supabase.com)
- [ ] **Wyłącz otwartą rejestrację**: Authentication → Sign In / Providers → Email → odznacz „Allow new users to sign up". (Konto admina zakładasz ręcznie: Authentication → Users → Add user.)
- [ ] **Uruchom migracje** (SQL Editor):
  ```sql
  alter table promo_products
    add column if not exists condition_type text,
    add column if not exists condition_note text,
    add column if not exists min_quantity integer;

  drop policy if exists "Authenticated manage images" on storage.objects;
  create policy "Authenticated manage images" on storage.objects for all
  to authenticated
  using      (bucket_id in ('recipe-images','promo-images','store-logos'))
  with check (bucket_id in ('recipe-images','promo-images','store-logos'));
  ```
- [ ] **Zrotuj `service_role`**: Settings → API → Reset (był wklejony w czacie).

## 2. Anthropic
- [ ] Utwórz **nowy** klucz (console.anthropic.com → API Keys), usuń stary.
- [ ] (opcjonalnie) Ustaw limit wydatków / budżet.

## 3. GitHub
- [ ] Utwórz prywatne repo i wypchnij projekt:
  ```bash
  git remote add origin https://github.com/<user>/przepisnik.git
  git push -u origin main
  ```
  (`.env.local` NIE trafi do repo — jest w `.gitignore`.)

## 4. Vercel
- [ ] „Add New Project" → import repo z GitHuba (Next.js wykryje się sam).
- [ ] **Environment Variables** (Production):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `ANTHROPIC_API_KEY` (NOWY klucz z pkt 2)
  - `REPLICATE_API_TOKEN` — opcjonalny, zdjęcia dań (replicate.com/account/api-tokens).
    Bez niego przepisy powstają bez zdjęcia, a w panelu pojawia się znacznik „bez zdjęcia".
    Zdjęcia są ważne: bez nich odpada Pinterest i Google Discover, a kafelki mają niższą klikalność.
  - `NEXT_PUBLIC_SITE_URL` (uzupełnij po pkt 5)
- [ ] Deploy.

## 5. Domena
- [ ] Kup domenę, dodaj w Vercel → Domains, ustaw DNS.
- [ ] Ustaw `NEXT_PUBLIC_SITE_URL=https://twoja-domena.pl` w Vercel → redeploy.

## 6. Treść i dane
- [ ] Usuń dane testowe (przepis „ASDFASDASASDASD" i szkice testowe) w /admin/przepizy.
- [ ] Dodaj realne przepisy: /admin/gazetka → wgraj gazetkę → zapisz promocje → generuj szkice → sprawdź, dodaj zdjęcia, publikuj.

## 7. Prawne (wymagane, RODO)
- [ ] Uzupełnij `[nazwa firmy]` i `[adres e-mail]` w:
  - src/app/polityka-prywatnosci/page.tsx
  - src/app/regulamin/page.tsx
  - src/app/reklama/page.tsx
- [ ] Zweryfikuj dokumenty z prawnikiem.

## 8. Po starcie
- [ ] Google Search Console → dodaj domenę, prześlij `/sitemap.xml`.
- [ ] Sprawdź: logowanie admina, upload zdjęcia, odczyt gazetki, publikacja przepisu.
- [ ] Sprawdź, że karta OG działa: wklej link do https://www.opengraph.xyz albo zrób post testowy na LinkedIn/FB.

## 9. Rzeczy dołożone tuż przed startem (weryfikacja po deployu)
- [ ] `src/app/loading.tsx` — pełnoekranowy szkielet home; sprawdź, że nie widać białego błysku między klikiem a renderem.
- [ ] `src/app/przepis/[slug]/loading.tsx` — szkielet przepisu.
- [ ] `src/app/error.tsx` — boundary; przetestuj wyłączając Supabase (chwilowo złe klucze), powinien wyświetlić „Coś poszło nie tak" z przyciskiem „Spróbuj ponownie".
- [ ] `public/og.svg` + `openGraph.images` w `layout.tsx` — placeholder marki. **Docelowo podmień na PNG 1200×630** (WhatsApp/Slack ignorują SVG).
- [ ] `sitemap.ts` — teraz odsiewa przepisy bez trwającej promocji (nie tylko wygasłe). Sprawdź, że `/sitemap.xml` zawiera tylko rzeczy, które user faktycznie zobaczy.

## 10. Ryzyka do rotacji przed publiczną promocją
- [ ] `service_role` w Supabase — Rotate (patrz sekcja 1).
- [ ] `ANTHROPIC_API_KEY` — obrócić w console.anthropic.com (były wklejone w rozmowach; nowy wpisz w Vercel jako Env Var).
