import { useMemo, useState } from 'react';
import { ADMIN_SIGNUP_CODE } from '../constants/auth';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types/auth';

type AuthMode = 'login' | 'register';

export function LoginPage() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('user');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegisterMode = mode === 'register';

  const submitLabel = useMemo(() => {
    if (isSubmitting && mode === 'login') {
      return 'Вход...';
    }

    if (isSubmitting && mode === 'register') {
      return 'Регистрация...';
    }

    return mode === 'login' ? 'Войти' : 'Зарегистрироваться';
  }, [isSubmitting, mode]);

  const resetMessages = () => {
    setError(null);
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    resetMessages();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!email.trim() || !password) {
      setError('Введите email и пароль.');
      return;
    }

    if (isRegisterMode) {
      if (password.length < 6) {
        setError('Пароль должен содержать не менее 6 символов.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Пароли не совпадают.');
        return;
      }

    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await signUp(
          email.trim(),
          password,
          selectedRole,
          selectedRole === 'administrator' ? ADMIN_SIGNUP_CODE : undefined
        );
      }
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : mode === 'login'
            ? 'Не удалось войти. Попробуйте еще раз.'
            : 'Не удалось зарегистрироваться. Попробуйте еще раз.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="title-kicker">Праздничный список</p>
        <h1 className="page-title">Список подарков на день рождения</h1>

        <div className="auth-mode-switch" role="tablist" aria-label="Переключение авторизации и регистрации">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => switchMode('login')}
            disabled={isSubmitting}
          >
            Авторизация
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`btn ${mode === 'register' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => switchMode('register')}
            disabled={isSubmitting}
          >
            Регистрация
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isSubmitting}
            />
          </label>

          <label className="form-field">
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Введите пароль"
              autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              disabled={isSubmitting}
            />
          </label>

          {isRegisterMode ? (
            <>
              <label className="form-field">
                <span>Подтверждение пароля</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Повторите пароль"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
              </label>

              <label className="form-field">
                <span>Роль</span>
                <select
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value as Role)}
                  disabled={isSubmitting}
                >
                  <option value="user">Пользователь</option>
                  <option value="administrator">Администратор</option>
                </select>
              </label>
            </>
          ) : null}

          {error ? <p className="auth-error">{error}</p> : null}

          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {submitLabel}
          </button>
        </form>
      </div>
    </main>
  );
}
