import { useState } from 'react';
import type { Role } from '../types/auth';
import type { Gift } from '../types/gift';
import { formatGiftPrice } from '../utils/format';
import { canDeleteGift, canEditGift, canReserveGift, canUnreserveGift } from '../utils/permissions';

interface GiftCardProps {
  gift: Gift;
  role: Role | null;
  isLoading: boolean;
  onReserve: (gift: Gift) => void;
  onUnreserve: (gift: Gift) => void;
  onEdit: (gift: Gift) => void;
  onDelete: (gift: Gift) => void;
}

export function GiftCard({
  gift,
  role,
  isLoading,
  onReserve,
  onUnreserve,
  onEdit,
  onDelete,
}: GiftCardProps) {
  const [isImageBroken, setIsImageBroken] = useState(false);
  const canReserve = canReserveGift(role, gift);
  const canUnreserve = gift.is_reserved && canUnreserveGift(role);
  const canEdit = canEditGift(role);
  const canDelete = canDeleteGift(role);
  const formattedPrice = formatGiftPrice(gift.price, gift.currency);
  const isAdminView = role === 'administrator';

  const overlayText = gift.is_reserved
    ? isAdminView && gift.reserved_by
      ? `Забронировал(а): ${gift.reserved_by}`
      : 'Уже зарезервировано'
    : null;

  return (
    <article className="gift-card">
      <div className="gift-image-wrapper">
        {!isImageBroken ? (
          <img
            src={gift.image_url}
            alt={gift.title}
            className="gift-image"
            onError={() => setIsImageBroken(true)}
          />
        ) : (
          <div className="gift-image-fallback">Изображение недоступно</div>
        )}
        {overlayText ? <div className="gift-overlay">{overlayText}</div> : null}
      </div>

      <div className="gift-content">
        <h3>{gift.title}</h3>

        <div className="gift-meta-row">
          {formattedPrice ? <strong className="gift-price">{formattedPrice}</strong> : null}
        </div>

        {gift.product_url ? (
          <a href={gift.product_url} target="_blank" rel="noreferrer noopener" className="product-link">
            Открыть товар
          </a>
        ) : null}

        <p className={`gift-status ${gift.is_reserved ? 'reserved' : 'free'}`}>
          {gift.is_reserved
            ? isAdminView && gift.reserved_by
              ? `Зарезервировано · ${gift.reserved_by}`
              : 'Зарезервировано'
            : 'Свободен'}
        </p>

        <div className="gift-actions">
          {canUnreserve ? (
            <button
              type="button"
              className="btn btn-unreserve"
              onClick={() => onUnreserve(gift)}
              disabled={isLoading}
            >
              {isLoading ? 'Обновление...' : 'Снять резерв'}
            </button>
          ) : null}

          {!gift.is_reserved && canReserve ? (
            <button
              type="button"
              className="btn btn-reserve"
              onClick={() => onReserve(gift)}
              disabled={isLoading}
            >
              {isLoading ? 'Резерв...' : 'Я подарю'}
            </button>
          ) : null}

          {canEdit ? (
            <button type="button" className="btn btn-secondary" onClick={() => onEdit(gift)} disabled={isLoading}>
              Редактировать
            </button>
          ) : null}

          {canDelete ? (
            <button type="button" className="btn btn-danger" onClick={() => onDelete(gift)} disabled={isLoading}>
              Удалить
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
