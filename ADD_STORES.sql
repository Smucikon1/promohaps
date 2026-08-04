-- Dodaje Netto i Dino do listy sklepów. Wklej do Supabase → SQL Editor → Run.
-- (Anon key nie ma INSERT na `stores` — musisz to zrobić z panelu.)

insert into stores (name, slug, color, is_active, sort_order)
values
  ('Dino',  'dino',  '#e30613', true, 6),
  ('Netto', 'netto', '#ffd400', true, 7)
on conflict (slug) do update
set name = excluded.name,
    color = excluded.color,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;
