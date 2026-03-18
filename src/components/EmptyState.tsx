interface EmptyStateProps {
  canAddGift: boolean;
  onAddClick: (() => void) | null;
}

export function EmptyState({ canAddGift, onAddClick }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">Подарки</div>
      <p className="empty-title">Пока подарков нет</p>
      <p className="empty-subtitle">
        {canAddGift ? 'Добавьте первый подарок в список' : 'Только администратор может добавить подарок'}
      </p>
      {canAddGift && onAddClick ? (
        <button type="button" className="btn btn-primary" onClick={onAddClick}>
          Добавить подарок
        </button>
      ) : null}
    </div>
  );
}
