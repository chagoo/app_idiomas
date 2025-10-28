-- Supabase schema backup / bootstrap
-- Ejecutar en Supabase SQL Editor (Production) o con psql.
-- Este script configura un modo DEMO (sin Auth) para esta app.

-- ===== Permisos base de esquema =====
grant usage on schema public to anon;
grant usage on schema public to authenticated;

-- ===== Tabla: progress (XP por usuario DEMO) =====
create table if not exists public.progress (
  id text primary key,
  xp integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

-- Re-crear policies idempotentemente
drop policy if exists "anon select progress" on public.progress;
drop policy if exists "anon insert progress" on public.progress;
drop policy if exists "anon update progress" on public.progress;

create policy "anon select progress" on public.progress
for select to anon using (true);

create policy "anon insert progress" on public.progress
for insert to anon with check (true);

create policy "anon update progress" on public.progress
for update to anon using (true) with check (true);

grant select, insert, update on public.progress to anon;

-- ===== Tabla: words (contenido de estudio) =====
create table if not exists public.words (
  id text primary key,
  theme text not null,
  en text not null,
  es text not null,
  image text,
  example text
);

alter table public.words enable row level security;

drop policy if exists "public read words" on public.words;
create policy "public read words" on public.words
for select to anon using (true);

grant select on public.words to anon;

-- Perfil de usuario y rol (para administracion)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "user read own profile" on public.profiles;
drop policy if exists "user update own profile" on public.profiles;
create policy "user read own profile" on public.profiles
for select to authenticated using (id = auth.uid());
create policy "user update own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
grant select, update on public.profiles to authenticated;

-- Trigger para crear profile automaticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles(id, role) values (new.id, 'user') on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Funcion para comprobar si el usuario es admin
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- Policies de administracion sobre words (solo admins pueden escribir)
drop policy if exists "admin insert words" on public.words;
drop policy if exists "admin update words" on public.words;
drop policy if exists "admin delete words" on public.words;
create policy "admin insert words" on public.words
for insert to authenticated with check (public.is_admin());
create policy "admin update words" on public.words
for update to authenticated using (public.is_admin());
create policy "admin delete words" on public.words
for delete to authenticated using (public.is_admin());

-- Asegurar privilegios a rol authenticated para que las policies puedan aplicar
grant insert, update, delete on public.words to authenticated;

-- Vista util: conteo de palabras por tema
create or replace view public.words_theme_counts as
select theme, count(*)::int as count from public.words group by theme;
grant select on public.words_theme_counts to anon;

-- ===== Tabla: reviews (registro de repasos DEMO) =====
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

create policy "anon insert reviews" on public.reviews
for insert to anon with check (true);

create policy "anon read reviews" on public.reviews
for select to anon using (true);

grant select, insert on public.reviews to anon;

create index if not exists reviews_user_word_idx
  on public.reviews (user_id, word_id, created_at desc);

-- ===== Datos iniciales opcionales (importar via Table Editor) =====
-- Importar JSON desde frontend/public/base_words.json a public.words

-- ===== Seccion opcional (PRODUCCION con Auth) =====
-- COMENTADA por defecto; usar si activas Supabase Auth y quieres seguridad por usuario.
--
-- -- Progreso seguro por usuario autenticado
-- create table if not exists public.progress_auth (
--   id uuid primary key references auth.users(id) on delete cascade,
--   xp integer not null default 0,
--   updated_at timestamptz not null default now()
-- );
-- alter table public.progress_auth enable row level security;
-- drop policy if exists "user read own progress" on public.progress_auth;
-- drop policy if exists "user upsert own progress" on public.progress_auth;
-- drop policy if exists "user update own progress" on public.progress_auth;
-- create policy "user read own progress" on public.progress_auth for select to authenticated using (id = auth.uid());
-- create policy "user upsert own progress" on public.progress_auth for insert to authenticated with check (id = auth.uid());
-- create policy "user update own progress" on public.progress_auth for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- grant select, insert, update on public.progress_auth to authenticated;
--
-- -- Reviews seguros
-- create table if not exists public.reviews_auth (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid not null references auth.users(id) on delete cascade,
--   word_id text not null,
--   grade smallint not null check (grade between 0 and 3),
--   created_at timestamptz not null default now()
-- );
-- alter table public.reviews_auth enable row level security;
-- drop policy if exists "user insert own reviews" on public.reviews_auth;
-- drop policy if exists "user read own reviews" on public.reviews_auth;
-- create policy "user insert own reviews" on public.reviews_auth for insert to authenticated with check (user_id = auth.uid());
-- create policy "user read own reviews" on public.reviews_auth for select to authenticated using (user_id = auth.uid());
-- grant select, insert on public.reviews_auth to authenticated;
