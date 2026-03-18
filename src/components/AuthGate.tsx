import { useAuth } from '../hooks/useAuth';
import { LoginPage } from '../pages/LoginPage';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, role, isAuthLoading, authError, refreshProfile, signOut } = useAuth();

  if (isAuthLoading) {
    return (
      <main className="auth-page">
        <div className="loader">Проверяем сессию...</div>
      </main>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  if (!role) {
    return (
      <main className="auth-page">
        <div className="auth-card auth-error-card">
          <h2>Доступ ограничен</h2>
          <p>{authError ?? 'Профиль пользователя не найден.'}</p>
          <div className="auth-error-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void refreshProfile()}>
              Повторить
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void signOut()}>
              Выйти
            </button>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
