import { useState } from 'react';

interface ReserveDialogProps {
  isOpen: boolean;
  giftTitle: string;
  isLoading: boolean;
  onConfirm: (guestName: string) => void;
  onCancel: () => void;
}

export function ReserveDialog({ isOpen, giftTitle, isLoading, onConfirm, onCancel }: ReserveDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      setError('Укажите ваше имя.');
      return;
    }

    setError(null);
    onConfirm(name.trim());
  };

  const handleCancel = () => {
    setName('');
    setError(null);
    onCancel();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={handleCancel}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3>Забронировать подарок</h3>
        <p className="reserve-dialog-subtitle">
          Вы хотите подарить <strong>{giftTitle}</strong>. Укажите ваше имя, чтобы именинник знал, кто забронировал подарок.
        </p>

        <form onSubmit={handleSubmit} className="reserve-dialog-form">
          <label className="form-field">
            <span>Ваше имя</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, Анна"
              autoFocus
              disabled={isLoading}
            />
            {error ? <small>{error}</small> : null}
          </label>

          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={isLoading}>
              Отмена
            </button>
            <button type="submit" className="btn btn-reserve" disabled={isLoading}>
              {isLoading ? 'Бронирование...' : 'Забронировать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
