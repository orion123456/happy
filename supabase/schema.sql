create extension if not exists "pgcrypto";

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  product_url text not null check (char_length(trim(product_url)) > 0),
  image_url text not null check (char_length(trim(image_url)) > 0),
  is_reserved boolean not null default false,
  reserved_by text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'administrator' check (role in ('administrator')),
  share_id uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_share_id on public.profiles(share_id);
create index if not exists idx_gifts_owner_id on public.gifts(owner_id);

-- ---- Triggers: updated_at ----

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_gifts_updated_at on public.gifts;
create trigger trg_gifts_updated_at
before update on public.gifts
for each row
execute procedure public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.set_updated_at();

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row
execute procedure public.set_updated_at();

-- ---- Helper: get app setting ----

create or replace function public.get_app_setting(p_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.value
  from public.app_settings s
  where s.key = p_key
  limit 1;
$$;

revoke all on function public.get_app_setting(text) from public;
grant execute on function public.get_app_setting(text) to authenticated;

-- ---- Trigger: auto-create administrator profile on signup ----

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'administrator')
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- ---- Helper: is current user an admin? ----

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'administrator'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---- RLS ----

alter table public.profiles enable row level security;
alter table public.gifts enable row level security;
alter table public.app_settings enable row level security;

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;

revoke all on public.gifts from anon;
revoke all on public.gifts from authenticated;
grant select, insert, update, delete on public.gifts to authenticated;

revoke all on public.app_settings from anon;
revoke all on public.app_settings from authenticated;

-- Profiles: each user reads only their own row
drop policy if exists "Профиль: чтение своей записи" on public.profiles;
create policy "Профиль: чтение своей записи"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Профиль: чтение всех записей админом" on public.profiles;

-- App settings: admin-only
drop policy if exists "Настройки: доступ только админу" on public.app_settings;
create policy "Настройки: доступ только админу"
on public.app_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Gifts: owner-scoped access for authenticated users
drop policy if exists "Подарки: чтение для авторизованных" on public.gifts;
drop policy if exists "Подарки: добавление только админ" on public.gifts;
drop policy if exists "Подарки: обновление только админ" on public.gifts;
drop policy if exists "Подарки: удаление только админ" on public.gifts;

create policy "Подарки: чтение своих"
on public.gifts
for select
to authenticated
using (owner_id = auth.uid());

create policy "Подарки: добавление своих"
on public.gifts
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Подарки: обновление своих"
on public.gifts
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Подарки: удаление своих"
on public.gifts
for delete
to authenticated
using (owner_id = auth.uid());

-- ---- Public RPC: get wishlist by share link ----

drop function if exists public.get_public_wishlist(uuid);

create or replace function public.get_public_wishlist(p_share_id uuid)
returns setof public.gifts
language sql
stable
security definer
set search_path = public
as $$
  select g.*
  from public.gifts g
  join public.profiles p on g.owner_id = p.id
  where p.share_id = p_share_id
  order by g.created_at desc;
$$;

revoke all on function public.get_public_wishlist(uuid) from public;
grant execute on function public.get_public_wishlist(uuid) to anon;
grant execute on function public.get_public_wishlist(uuid) to authenticated;

-- ---- Public RPC: get wishlist owner info ----

drop function if exists public.get_wishlist_owner(uuid);

create or replace function public.get_wishlist_owner(p_share_id uuid)
returns table (email text)
language sql
stable
security definer
set search_path = public
as $$
  select p.email
  from public.profiles p
  where p.share_id = p_share_id
  limit 1;
$$;

revoke all on function public.get_wishlist_owner(uuid) from public;
grant execute on function public.get_wishlist_owner(uuid) to anon;
grant execute on function public.get_wishlist_owner(uuid) to authenticated;

-- ---- Public RPC: guest reserves a gift ----

drop function if exists public.reserve_gift(uuid);
drop function if exists public.reserve_gift_public(uuid, text);

create or replace function public.reserve_gift_public(p_gift_id uuid, p_guest_name text)
returns public.gifts
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_gift public.gifts;
begin
  if p_guest_name is null or char_length(trim(p_guest_name)) = 0 then
    raise exception 'guest_name_required';
  end if;

  update public.gifts
  set is_reserved = true,
      reserved_by = trim(p_guest_name),
      updated_at = now()
  where id = p_gift_id
    and is_reserved = false
  returning * into updated_gift;

  if updated_gift.id is null then
    raise exception 'already_reserved';
  end if;

  return updated_gift;
end;
$$;

revoke all on function public.reserve_gift_public(uuid, text) from public;
grant execute on function public.reserve_gift_public(uuid, text) to anon;
grant execute on function public.reserve_gift_public(uuid, text) to authenticated;

-- ---- Storage ----

insert into storage.buckets (id, name, public)
values ('gifts-images', 'gifts-images', true)
on conflict (id) do nothing;

drop policy if exists "Публичное чтение изображений" on storage.objects;
create policy "Публичное чтение изображений"
on storage.objects
for select
using (bucket_id = 'gifts-images');

drop policy if exists "Загрузка изображений только админ" on storage.objects;
create policy "Загрузка изображений только админ"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'gifts-images' and public.is_admin());

drop policy if exists "Удаление изображений только админ" on storage.objects;
create policy "Удаление изображений только админ"
on storage.objects
for delete
to authenticated
using (bucket_id = 'gifts-images' and public.is_admin());
