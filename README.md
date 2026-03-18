# Список подарков на день рождения

MVP-приложение на React + TypeScript + Supabase с авторизацией, ролями и безопасным резервированием.

## Что реализовано

- Авторизация через Supabase Auth (`email/password`): вход, регистрация, выход, восстановление сессии.
- Роли через `public.profiles.role`:
  - `administrator`
  - `user`
- Ограничения в UI и на уровне базы (RLS).
- Безопасное резервирование через RPC `reserve_gift` (атомарно, без race condition).
- Текущий UI списка подарков и CRUD сохранены, доступ к CRUD оставлен только для `administrator`.

## Auth UX

В UI есть переключение:
- `Авторизация`
- `Регистрация`

В регистрации можно выбрать роль:
- `user`
- `administrator`

Для роли `administrator` приложение автоматически отправляет встроенный код, а БД сверяет его с `public.app_settings`.

## Архитектура

- `src/context/AuthContext.tsx` - состояние сессии, роль, профиль, `signIn/signOut`, restore session.
- `src/components/AuthGate.tsx` - защита приложения: неавторизованный пользователь видит только вход.
- `src/pages/LoginPage.tsx` - экран входа/регистрации на русском.
- `src/utils/permissions.ts` - централизованная ролевая логика (`isAdmin`, `can*`).
- `src/pages/GiftsPage.tsx` - подарки + карточка общего сбора с прогресс-баром.
- `src/services/giftsApi.ts` - CRUD + RPC reserve + admin-only unreserve через update.
- `src/services/donationApi.ts` - чтение сбора, создание платежа ЮKassa, синхронизация статусов.
- `supabase/functions/create-yookassa-donation` - создание redirect-платежа в ЮKassa.
- `supabase/functions/sync-yookassa-donations` - обновление статусов платежей в базе.
- `supabase/schema.sql` - таблицы, триггеры, RLS, RPC, storage policies.

## Локальный запуск

1. Установите зависимости:

```bash
npm install
```

2. Создайте `.env`:

```bash
cp .env.example .env
```

3. Заполните переменные:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_STORAGE_BUCKET` (по умолчанию `gifts-images`)

4. В Supabase откройте `SQL Editor` и выполните `supabase/schema.sql`.

5. Включите Email auth:
- Dashboard -> `Authentication` -> `Providers` -> `Email` -> Enable.

6. Запустите приложение:

```bash
npm run dev
```

## Создание первого администратора

1. Задайте код администратора (один раз, должен совпадать с кодом в клиенте `src/constants/auth.ts`):

```sql
update public.app_settings
set value = 'YOUR_STRONG_ADMIN_CODE'
where key = 'admin_invite_code';
```

2. Зарегистрируйтесь через UI в режиме `Регистрация`, выберите роль `Администратор` и введите этот код.

3. Альтернативно можно назначить роль вручную SQL:

```sql
update public.profiles
set role = 'administrator'
where email = 'admin@example.com';
```

## Создание обычного пользователя

1. Зарегистрируйтесь через UI в режиме `Регистрация` с ролью `Пользователь`  
   (или создайте пользователя в `Authentication -> Users`).
2. Убедитесь, что в `public.profiles` для него роль `user`.

Проверка:

```sql
select id, email, role
from public.profiles
order by created_at desc;
```

## Что важно по безопасности

- Нельзя полагаться на скрытие кнопок: ограничения дублируются RLS-политиками.
- `user` не может делать CRUD подарков и не может снять резерв.
- `user` может резервировать подарок только через `public.reserve_gift`.
- `reserve_gift` меняет только `is_reserved` и `updated_at`, с атомарным `UPDATE ... WHERE is_reserved = false`.

## Переменные окружения

См. `.env.example`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_STORAGE_BUCKET=gifts-images
```

## ЮKassa в тестовом режиме

1. Возьмите в кабинете ЮKassa тестовые `shopId` и `secret key`.
2. Добавьте секреты для Supabase Edge Functions:

```bash
supabase secrets set YOOKASSA_SHOP_ID=your_test_shop_id
supabase secrets set YOOKASSA_SECRET_KEY=your_test_secret_key
```

3. Задеплойте новые Edge Functions:

```bash
supabase functions deploy create-yookassa-donation
supabase functions deploy sync-yookassa-donations
```

4. В приложении администратор создаёт один активный сбор, а пользователи оплачивают его через тестовую страницу ЮKassa. После возврата в приложение прогресс обновляется по подтверждённым платежам.
