import type { Role } from '../types/auth';

interface HeaderProps {
  role: Role;
  userEmail: string;
  canAddGift: boolean;
  isSigningOut: boolean;
  onAddClick: () => void;
  onSignOut: () => void;
}

function roleLabel(role: Role): string {
  return role === 'administrator' ? 'Администратор' : 'Пользователь';
}

export function Header({ role, userEmail, canAddGift, isSigningOut, onAddClick, onSignOut }: HeaderProps) {
  return (
    <header className="header">
      <div className="title-wrap">
        <p className="title-kicker">Праздничный список</p>
        <h1 className="page-title">Список подарков на день рождения</h1>
        <p className="user-meta">
          {userEmail} · {roleLabel(role)}
        </p>
      </div>

      <div className="header-actions">
        {canAddGift ? (
          <button type="button" className="btn btn-primary" onClick={onAddClick}>
            Добавить подарок
          </button>
        ) : null}

        <button type="button" className="btn btn-secondary" onClick={onSignOut} disabled={isSigningOut}>
          {isSigningOut ? 'Выход...' : 'Выйти'}
        </button>
      </div>
    </header>
  );
}
