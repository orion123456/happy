import { useCallback, useState } from 'react';
import type { Role } from '../types/auth';

interface HeaderProps {
  role: Role;
  userEmail: string;
  shareId: string;
  canAddGift: boolean;
  isSigningOut: boolean;
  onAddClick: () => void;
  onSignOut: () => void;
}

export function Header({ userEmail, shareId, canAddGift, isSigningOut, onAddClick, onSignOut }: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/wishlist/${shareId}`;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  return (
    <header className="header">
      <div className="title-wrap">
        <p className="title-kicker">Праздничный список</p>
        <h1 className="page-title">Список подарков на день рождения</h1>
        <p className="user-meta">{userEmail}</p>
      </div>

      <div className="header-actions">
        <button type="button" className="btn btn-share" onClick={() => void handleCopyLink()}>
          {copied ? 'Ссылка скопирована!' : 'Поделиться ссылкой'}
        </button>

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
