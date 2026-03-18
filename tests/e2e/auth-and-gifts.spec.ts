import { expect, test, type Locator, type Page } from '@playwright/test';
import { createUniqueAccount, deleteGiftByTitle, registerAccount, signInAccount } from './helpers/supabase';

const wildberriesUrl = 'https://www.wildberries.ru/catalog/12345678/detail.aspx';
const imageUrl = 'https://images.wbstatic.net/big/new/12340000/12345678-1.jpg';
const sharedAdminAccount = createUniqueAccount('giftadmin');
const sharedUserAccount = createUniqueAccount('signupuser');

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  await registerAccount(sharedAdminAccount, 'administrator');
});

async function openRegistration(page: Page) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Регистрация' }).click();
}

async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

async function logoutViaUi(page: Page) {
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page.getByRole('heading', { name: 'Список подарков на день рождения' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Авторизация' })).toBeVisible();
}

function giftCard(page: Page, title: string): Locator {
  return page.locator('.gift-card').filter({
    has: page.getByRole('heading', { name: title }),
  });
}

test('Регистрация создаёт обычного пользователя и сразу пускает в приложение', async ({ page }) => {
  await openRegistration(page);
  await page.getByLabel('Email').fill(sharedUserAccount.email);
  await page.getByLabel('Пароль').fill(sharedUserAccount.password);
  await page.getByLabel('Подтверждение пароля').fill(sharedUserAccount.password);
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

  await expect(page.getByText(sharedUserAccount.email)).toBeVisible();
  await expect(page.getByText('Пользователь')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
  await logoutViaUi(page);
});

test('Вход по email и паролю работает для существующего пользователя', async ({ page }) => {
  await loginViaUi(page, sharedUserAccount.email, sharedUserAccount.password);

  await expect(page.getByText(sharedUserAccount.email)).toBeVisible();
  await expect(page.getByText('Пользователь')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
});

test('Администратор может добавить подарок через UI', async ({ page }) => {
  const giftTitle = `Playwright Gift ${Date.now()}`;

  try {
    await loginViaUi(page, sharedAdminAccount.email, sharedAdminAccount.password);
    await page.getByRole('button', { name: 'Добавить подарок' }).click();
    await page.getByLabel('Ссылка на товар Wildberries').fill(wildberriesUrl);
    await page.getByRole('button', { name: 'Подтянуть данные' }).click();
    await expect(page.getByLabel('Название подарка')).toBeVisible();
    await page.getByLabel('Название подарка').fill(giftTitle);
    await page.getByLabel('URL изображения').fill(imageUrl);
    await page.getByLabel('Цена, ₽').fill('4990');
    await page.getByRole('button', { name: 'Сохранить' }).click();

    await expect(giftCard(page, giftTitle)).toBeVisible();
    await expect(giftCard(page, giftTitle).getByText('Свободен')).toBeVisible();
  } finally {
    const adminSession = await signInAccount(sharedAdminAccount);
    await deleteGiftByTitle(giftTitle, adminSession.access_token);
  }
});

test('Пользователь может зарезервировать подарок, а администратор снять резерв', async ({ page }) => {
  const giftTitle = `Reservation Gift ${Date.now()}`;

  try {
    await loginViaUi(page, sharedAdminAccount.email, sharedAdminAccount.password);
    await page.getByRole('button', { name: 'Добавить подарок' }).click();
    await page.getByLabel('Ссылка на товар Wildberries').fill(wildberriesUrl);
    await page.getByRole('button', { name: 'Подтянуть данные' }).click();
    await expect(page.getByLabel('Название подарка')).toBeVisible();
    await page.getByLabel('Название подарка').fill(giftTitle);
    await page.getByLabel('URL изображения').fill(imageUrl);
    await page.getByLabel('Цена, ₽').fill('7990');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(giftCard(page, giftTitle)).toBeVisible();

    await logoutViaUi(page);
    await loginViaUi(page, sharedUserAccount.email, sharedUserAccount.password);
    await giftCard(page, giftTitle).getByRole('button', { name: 'Я подарю' }).click();
    await expect(giftCard(page, giftTitle).getByText('Зарезервировано')).toBeVisible();

    await logoutViaUi(page);
    await loginViaUi(page, sharedAdminAccount.email, sharedAdminAccount.password);
    await giftCard(page, giftTitle).getByRole('button', { name: 'Снять резерв' }).click();
    await expect(giftCard(page, giftTitle).getByText('Свободен')).toBeVisible();
  } finally {
    const adminSession = await signInAccount(sharedAdminAccount);
    await deleteGiftByTitle(giftTitle, adminSession.access_token);
  }
});
