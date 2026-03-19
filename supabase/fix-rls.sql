-- Удаляем ВСЕ старые политики на gifts
drop policy if exists "Подарки: чтение для авторизованных" on public.gifts;
drop policy if exists "Подарки: добавление только админ" on public.gifts;
drop policy if exists "Подарки: обновление только админ" on public.gifts;
drop policy if exists "Подарки: удаление только админ" on public.gifts;

-- Удаляем новые на случай дублей
drop policy if exists "Подарки: чтение своих" on public.gifts;
drop policy if exists "Подарки: добавление своих" on public.gifts;
drop policy if exists "Подарки: обновление своих" on public.gifts;
drop policy if exists "Подарки: удаление своих" on public.gifts;

-- Создаём правильные политики: каждый видит только СВОИ подарки
create policy "Подарки: чтение своих"
on public.gifts for select to authenticated
using (owner_id = auth.uid());

create policy "Подарки: добавление своих"
on public.gifts for insert to authenticated
with check (owner_id = auth.uid());

create policy "Подарки: обновление своих"
on public.gifts for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Подарки: удаление своих"
on public.gifts for delete to authenticated
using (owner_id = auth.uid());
