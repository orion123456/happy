import { readFileSync } from 'node:fs';
import path from 'node:path';

function readEnvFile(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env');

  try {
    const content = readFileSync(envPath, 'utf8');

    return content.split('\n').reduce<Record<string, string>>((acc, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return acc;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex === -1) {
        return acc;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (key) {
        acc[key] = value;
      }

      return acc;
    }, {});
  } catch {
    return {};
  }
}

const envFromFile = readEnvFile();
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? envFromFile.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? envFromFile.VITE_SUPABASE_ANON_KEY;
const adminSignupCode = 'gift-master-2026';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Для e2e тестов нужны VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в окружении.');
}

type UserRole = 'administrator' | 'user';

interface AuthAccount {
  email: string;
  password: string;
}

interface AuthSession {
  access_token: string;
}

function sleep(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}

function headers(accessToken?: string): HeadersInit {
  return {
    apikey: supabaseAnonKey,
    Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
  };
}

async function parseJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  return JSON.parse(text) as unknown;
}

async function assertOk(response: Response, fallbackMessage: string) {
  if (response.ok) {
    return;
  }

  const payload = (await parseJson(response)) as { msg?: string; error_description?: string; message?: string } | null;
  const details = payload?.msg ?? payload?.error_description ?? payload?.message ?? fallbackMessage;

  throw new Error(details);
}

export function createUniqueAccount(prefix: string): AuthAccount {
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, '');
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

  return {
    email: `${cleanPrefix}${suffix}@gmail.com`,
    password: `Pw!${suffix}12345`,
  };
}

export async function registerAccount(account: AuthAccount, role: UserRole): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        data: {
          requested_role: role,
          admin_invite_code: role === 'administrator' ? adminSignupCode : '',
        },
      }),
    });

    if (response.ok) {
      const payload = (await parseJson(response)) as { session?: AuthSession | null } | null;

      if (!payload?.session) {
        throw new Error('Регистрация вернула пустую сессию. Для e2e нужен отключенный Confirm email в Supabase Auth.');
      }

      return;
    }

    const payload = (await parseJson(response)) as { msg?: string; error_description?: string; message?: string } | null;
    const details = payload?.msg ?? payload?.error_description ?? payload?.message ?? 'Не удалось создать тестового пользователя.';

    if (details.toLowerCase().includes('rate limit') && attempt < 3) {
      await sleep(65_000);
      continue;
    }

    throw new Error(details);
  }
}

export async function signInAccount(account: AuthAccount): Promise<AuthSession> {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      email: account.email,
      password: account.password,
    }),
  });

  await assertOk(response, 'Не удалось выполнить API-логин тестового пользователя.');
  const payload = (await parseJson(response)) as AuthSession | null;

  if (!payload?.access_token) {
    throw new Error('Supabase не вернул access_token для тестового пользователя.');
  }

  return payload;
}

export async function deleteGiftByTitle(title: string, accessToken: string): Promise<void> {
  const query = new URLSearchParams({ title: `eq.${title}` });
  const response = await fetch(`${supabaseUrl}/rest/v1/gifts?${query.toString()}`, {
    method: 'DELETE',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  await assertOk(response, `Не удалось удалить тестовый подарок "${title}".`);
}
