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
