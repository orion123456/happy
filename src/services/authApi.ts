import type { Profile, Role } from '../types/auth';
import { supabase } from './supabaseClient';

const ROLES: Role[] = ['administrator', 'user'];

function isRole(value: string): value is Role {
  return ROLES.includes(value as Role);
}

function mapAuthErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Неверный email или пароль.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Email не подтвержден. Подтвердите почту и попробуйте снова.';
  }

  if (normalized.includes('user already registered')) {
    return 'Пользователь с таким email уже зарегистрирован.';
  }

  if (normalized.includes('password should be at least')) {
    return 'Пароль слишком короткий. Используйте не менее 6 символов.';
  }

  if (normalized.includes('user not found')) {
    return 'Пользователь не найден.';
  }

  return 'Не удалось выполнить операцию авторизации. Попробуйте еще раз.';
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(mapAuthErrorMessage(error.message));
  }
}

export async function signUpWithPassword(
  email: string,
  password: string,
  role: Role,
  adminInviteCode?: string
): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        requested_role: role,
        admin_invite_code: role === 'administrator' ? adminInviteCode?.trim() ?? '' : '',
      },
    },
  });

  if (error) {
    throw new Error(mapAuthErrorMessage(error.message));
  }

  if (!data.session) {
    throw new Error('В проекте включено подтверждение email. Отключите Confirm email в Supabase Auth.');
  }
}

export async function signOutCurrentUser(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error('Не удалось выйти из аккаунта.');
  }
}

export async function fetchCurrentProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('Не удалось загрузить профиль пользователя.');
  }

  if (!data) {
    return null;
  }

  if (!isRole(data.role)) {
    throw new Error('Некорректная роль пользователя в профиле.');
  }

  return {
    ...(data as Omit<Profile, 'role'>),
    role: data.role,
  };
}
