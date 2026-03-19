-- ============================================================
-- МИГРАЦИЯ: мультитенантность + публичные ссылки для гостей
-- Запускать в Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 1. Добавляем share_id в profiles
alter table public.profiles
  add column if not exists share_id uuid default gen_random_uuid() unique;

-- Заполняем share_id для существующих профилей, если пустой
update public.profiles
set share_id = gen_random_uuid()
where share_id is null;

-- Делаем NOT NULL после заполнения
alter table public.profiles
  alter column share_id set not null;

-- 2. Сначала обновляем данные, потом меняем constraint
update public.profiles set role = 'administrator' where role = 'user';

alter table public.profiles alter column role set default 'administrator';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('administrator'));

-- 3. Добавляем owner_id и reserved_by в gifts
alter table public.gifts
  add column if not exists reserved_by text;

alter table public.gifts
  add column if not exists owner_id uuid references public.profiles(id) on delete cascade;

-- Привязываем все существующие подарки к первому (или единственному) администратору
update public.gifts
set owner_id = (select id from public.profiles where role = 'administrator' limit 1)
where owner_id is null;

-- Делаем NOT NULL после заполнения
alter table public.gifts
  alter column owner_id set not null;

-- Индексы
create index if not exists idx_profiles_share_id on public.profiles(share_id);
create index if not exists idx_gifts_owner_id on public.gifts(owner_id);

-- ============================================================
-- 4. Обновляем функцию создания профиля (всегда administrator)
-- ============================================================

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

-- ============================================================
-- 5. Удаляем старые RLS-политики для gifts
-- ============================================================

drop policy if exists "Подарки: чтение для авторизованных" on public.gifts;
drop policy if exists "Подарки: добавление только админ" on public.gifts;
drop policy if exists "Подарки: обновление только админ" on public.gifts;
drop policy if exists "Подарки: удаление только админ" on public.gifts;

-- Удаляем старую политику для profiles (чтение всех записей админом)
drop policy if exists "Профиль: чтение всех записей админом" on public.profiles;

-- ============================================================
-- 6. Создаём новые RLS-политики (owner-scoped)
-- ============================================================

-- Profiles: только свою запись
drop policy if exists "Профиль: чтение своей записи" on public.profiles;
create policy "Профиль: чтение своей записи"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- Gifts: owner-scoped
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

-- ============================================================
-- 7. Удаляем старую функцию reserve_gift
-- ============================================================

drop function if exists public.reserve_gift(uuid);
drop function if exists public.unreserve_gift(uuid);

-- ============================================================
-- 8. Публичные RPC-функции (доступны без авторизации)
-- ============================================================

-- Получить список подарков по share_id
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

-- Получить email владельца wishlist
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

-- Бронирование подарка гостем (без авторизации)
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
