create extension if not exists "pgcrypto";

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  product_url text not null check (char_length(trim(product_url)) > 0),
  image_url text not null check (char_length(trim(image_url)) > 0),
  is_reserved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.donation_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  description text,
  product_url text,
  image_url text,
  target_amount numeric(12, 2) not null check (target_amount > 0),
  currency text not null default 'RUB' check (char_length(trim(currency)) > 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.donation_payments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.donation_campaigns(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'yookassa',
  provider_payment_id text not null unique,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'RUB' check (char_length(trim(currency)) > 0),
  status text not null default 'pending' check (status in ('pending', 'waiting_for_capture', 'succeeded', 'canceled')),
  confirmation_url text,
  return_url text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('administrator', 'user')),
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
create index if not exists idx_donation_campaigns_active on public.donation_campaigns(is_active, created_at desc);
create index if not exists idx_donation_payments_campaign_status on public.donation_payments(campaign_id, status);
create index if not exists idx_donation_payments_user_created on public.donation_payments(user_id, created_at desc);

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

drop trigger if exists trg_donation_campaigns_updated_at on public.donation_campaigns;
create trigger trg_donation_campaigns_updated_at
before update on public.donation_campaigns
for each row
execute procedure public.set_updated_at();

drop trigger if exists trg_donation_payments_updated_at on public.donation_payments;
create trigger trg_donation_payments_updated_at
before update on public.donation_payments
for each row
execute procedure public.set_updated_at();

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row
execute procedure public.set_updated_at();

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  requested_admin_code text;
  actual_role text := 'user';
  valid_admin_code text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'requested_role', 'user');
  requested_admin_code := coalesce(new.raw_user_meta_data ->> 'admin_invite_code', '');
  valid_admin_code := public.get_app_setting('admin_invite_code');

  if requested_role = 'administrator'
     and valid_admin_code is not null
     and requested_admin_code = valid_admin_code then
    actual_role := 'administrator';
  end if;

  insert into public.profiles (id, email, role)
  values (new.id, new.email, actual_role)
  on conflict (id) do update
    set email = excluded.email,
        role = excluded.role,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

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

alter table public.profiles enable row level security;
alter table public.gifts enable row level security;
alter table public.app_settings enable row level security;
alter table public.donation_campaigns enable row level security;
alter table public.donation_payments enable row level security;

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;

revoke all on public.gifts from anon;
revoke all on public.gifts from authenticated;
grant select, insert, update, delete on public.gifts to authenticated;

revoke all on public.app_settings from anon;
revoke all on public.app_settings from authenticated;

revoke all on public.donation_campaigns from anon;
revoke all on public.donation_campaigns from authenticated;
grant select, insert, update, delete on public.donation_campaigns to authenticated;

revoke all on public.donation_payments from anon;
revoke all on public.donation_payments from authenticated;
grant select, insert on public.donation_payments to authenticated;

-- Profiles RLS

drop policy if exists "Профиль: чтение своей записи" on public.profiles;
create policy "Профиль: чтение своей записи"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Профиль: чтение всех записей админом" on public.profiles;
create policy "Профиль: чтение всех записей админом"
on public.profiles
for select
to authenticated
using (public.is_admin());

drop policy if exists "Настройки: доступ только админу" on public.app_settings;
create policy "Настройки: доступ только админу"
on public.app_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Donation campaigns RLS

drop policy if exists "Сборы: чтение для авторизованных" on public.donation_campaigns;
create policy "Сборы: чтение для авторизованных"
on public.donation_campaigns
for select
to authenticated
using (true);

drop policy if exists "Сборы: управление только админ" on public.donation_campaigns;
create policy "Сборы: управление только админ"
on public.donation_campaigns
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Donation payments RLS

drop policy if exists "Платежи: чтение для авторизованных" on public.donation_payments;
create policy "Платежи: чтение для авторизованных"
on public.donation_payments
for select
to authenticated
using (true);

drop policy if exists "Платежи: создание своей записи" on public.donation_payments;
create policy "Платежи: создание своей записи"
on public.donation_payments
for insert
to authenticated
with check (auth.uid() = user_id);

-- Gifts RLS

drop policy if exists "Подарки: чтение для авторизованных" on public.gifts;
create policy "Подарки: чтение для авторизованных"
on public.gifts
for select
to authenticated
using (true);

drop policy if exists "Подарки: добавление только админ" on public.gifts;
create policy "Подарки: добавление только админ"
on public.gifts
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Подарки: обновление только админ" on public.gifts;
create policy "Подарки: обновление только админ"
on public.gifts
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Подарки: удаление только админ" on public.gifts;
create policy "Подарки: удаление только админ"
on public.gifts
for delete
to authenticated
using (public.is_admin());

create or replace function public.reserve_gift(gift_id uuid)
returns public.gifts
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role text;
  updated_gift public.gifts;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select role
  into user_role
  from public.profiles
  where id = auth.uid();

  if user_role not in ('administrator', 'user') then
    raise exception 'forbidden';
  end if;

  update public.gifts
  set is_reserved = true,
      updated_at = now()
  where id = gift_id
    and is_reserved = false
  returning * into updated_gift;

  if updated_gift.id is null then
    raise exception 'already_reserved';
  end if;

  return updated_gift;
end;
$$;

drop function if exists public.unreserve_gift(uuid);

revoke all on function public.reserve_gift(uuid) from public;
grant execute on function public.reserve_gift(uuid) to authenticated;

insert into public.app_settings (key, value)
values ('admin_invite_code', 'CHANGE_ME_ADMIN_CODE')
on conflict (key) do nothing;

insert into storage.buckets (id, name, public)
values ('gifts-images', 'gifts-images', true)
on conflict (id) do nothing;

-- Публичное чтение картинок остается, чтобы ссылки из gift.image_url работали без signed URL.
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
