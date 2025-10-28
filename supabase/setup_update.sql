-- setup_update.sql
-- Script idempotente para provisionar/actualizar el esquema de Supabase
-- para la app de idiomas. Incluye tablas, RLS, policies, funciones,
-- grants y utilidades (backfill + notas de promoción a admin).
-- Ejecutar en el SQL Editor (Production) con rol 'postgres'.

-- ===== Permisos base de esquema =====
grant usage on schema public to anon;
grant usage on schema public to authenticated;

-- ===== Tabla: progress (DEMO sin Auth) =====
create table if not exists public.progress (
  id text primary key,
  xp integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.progress enable row level security;
drop policy if exists "anon select progress" on public.progress;
drop policy if exists "anon insert progress" on public.progress;
drop policy if exists "anon update progress" on public.progress;
create policy "anon select progress" on public.progress for select to anon using (true);
create policy "anon insert progress" on public.progress for insert to anon with check (true);
create policy "anon update progress" on public.progress for update to anon using (true) with check (true);
grant select, insert, update on public.progress to anon;

-- ===== Tabla: words (contenido) =====
create table if not exists public.words (
  id text primary key,
  theme text not null,
  en text not null,
  es text not null,
  image text,
  example text
);
alter table public.words enable row level security;

-- Lectura pública (usuarios no autenticados pueden ver palabras)
drop policy if exists "public read words" on public.words;
create policy "public read words" on public.words for select to anon using (true);
grant select on public.words to anon;

-- Lectura para usuarios autenticados (evita 403 en upsert con retorno)
drop policy if exists "auth read words" on public.words;
create policy "auth read words" on public.words for select to authenticated using (true);
grant select on public.words to authenticated;

-- Perfil y rol de usuario (para administración)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "user read own profile" on public.profiles;
drop policy if exists "user update own profile" on public.profiles;
create policy "user read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "user update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
grant select, update on public.profiles to authenticated;

-- Trigger: crear profile automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles(id, role) values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill para usuarios ya existentes (idempotente)
insert into public.profiles(id, role)
select id, 'user' from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Función de ayuda para policies de admin
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- Solo administradores pueden escribir en words
drop policy if exists "admin insert words" on public.words;
drop policy if exists "admin update words" on public.words;
drop policy if exists "admin delete words" on public.words;
create policy "admin insert words" on public.words for insert to authenticated with check (public.is_admin());
create policy "admin update words" on public.words for update to authenticated using (public.is_admin());
create policy "admin delete words" on public.words for delete to authenticated using (public.is_admin());

-- Grants requeridos para que las policies apliquen
grant insert, update, delete on public.words to authenticated;

-- Vista de conteo por tema (útil para el front)
create or replace view public.words_theme_counts as
select theme, count(*)::int as count from public.words group by theme;
grant select on public.words_theme_counts to anon;

-- ===== Tabla: reviews (registro de repasos - DEMO) =====
create extension if not exists pgcrypto;
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'local-user',
  word_id text not null,
  grade smallint not null check (grade between 0 and 3),
  created_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
drop policy if exists "anon insert reviews" on public.reviews;
drop policy if exists "anon read reviews" on public.reviews;
create policy "anon insert reviews" on public.reviews for insert to anon with check (true);
create policy "anon read reviews" on public.reviews for select to anon using (true);
grant select, insert on public.reviews to anon;
create index if not exists reviews_user_word_idx on public.reviews (user_id, word_id, created_at desc);

-- ===== Escuela: listas semanales (dictation/spelling) =====
create extension if not exists pgcrypto;
create table if not exists public.school_items (
  id uuid primary key default gen_random_uuid(),
  week text not null,               -- por ejemplo: 'Lesson 8' o '2025-W44'
  kind text not null check (kind in ('pattern','review')),
  idx smallint not null,            -- orden
  word text not null,
  sentence text,                    -- opcional, para puntos extra
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.school_items enable row level security;

-- Lectura publica de listas (para practicar sin login)
drop policy if exists "public read school_items" on public.school_items;
create policy "public read school_items" on public.school_items
for select to anon using (true);
grant select on public.school_items to anon;

-- Escritura solo admin
drop policy if exists "admin write school_items" on public.school_items;
create policy "admin write school_items" on public.school_items
for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.school_items to authenticated;

-- Columna opcional para traduccion al español (si aun no existe)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'school_items' and column_name = 'es'
  ) then
    alter table public.school_items add column es text;
  end if;
end$$;

-- Índice único para evitar duplicados por (week,kind,idx)
create unique index if not exists school_items_week_kind_idx_uniq
  on public.school_items (week, kind, idx);

-- Mantenimiento opcional: consolidar duplicados existentes (mantener el que tenga 'es')
-- with ranked as (
--   select id, week, kind, idx, es, created_at,
--          row_number() over (partition by week,kind,idx order by (es is not null) desc, created_at desc) rn
--   from public.school_items
-- )
-- delete from public.school_items s using ranked r
-- where s.id = r.id and r.rn > 1;

-- ===== Notas de operación =====
-- 1) Promover un usuario a admin (reemplaza con tu UUID de auth.users):
--    update public.profiles set role = 'admin' where id = '<TU-UUID>'; 
--    -- Si no existe la fila, crea o actualiza:
--    insert into public.profiles(id, role) values ('<TU-UUID>', 'admin')
--    on conflict (id) do update set role = excluded.role;
-- 2) Para migración puntual sin admin (no recomendado, solo temporal):
--    grant insert on public.words to anon;
--    create policy "anon insert words once" on public.words for insert to anon with check (true);
--    -- Ejecuta la migración y luego revoca/elimina:
--    drop policy if exists "anon insert words once" on public.words;
--    revoke insert on public.words from anon;
-- 3) Con Auth de producción: considera usar tablas *_auth y policies con auth.uid().
