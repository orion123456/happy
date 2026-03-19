import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GiftGrid } from '../components/GiftGrid';
import { Notification } from '../components/Notification';
import { ReserveDialog } from '../components/ReserveDialog';
import { useToast } from '../hooks/useToast';
import { fetchPublicWishlist, fetchWishlistOwner, reserveGiftPublic } from '../services/giftsApi';
import type { Gift } from '../types/gift';

export function PublicWishlistPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const { toasts, showToast, removeToast } = useToast();

  const [gifts, setGifts] = useState<Gift[]>([]);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [giftToReserve, setGiftToReserve] = useState<Gift | null>(null);

  const setGiftActionLoading = useCallback((giftId: string, isActive: boolean) => {
    setActionLoading((prev) => {
      if (!isActive) {
        const next = { ...prev };
        delete next[giftId];
        return next;
      }

      return { ...prev, [giftId]: true };
    });
  }, []);

  const loadWishlist = useCallback(async () => {
    if (!shareId) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [fetchedGifts, email] = await Promise.all([
        fetchPublicWishlist(shareId),
        fetchWishlistOwner(shareId),
      ]);

      if (!email) {
        setNotFound(true);
        return;
      }

      setGifts(fetchedGifts);
      setOwnerEmail(email);
    } catch {
      showToast('Не удалось загрузить список подарков.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [shareId, showToast]);

  useEffect(() => {
    void loadWishlist();
  }, [loadWishlist]);

  const handleReserveClick = (gift: Gift) => {
    setGiftToReserve(gift);
  };

  const handleReserveConfirm = async (guestName: string) => {
    if (!giftToReserve) {
      return;
    }

    setGiftActionLoading(giftToReserve.id, true);

    try {
      const updatedGift = await reserveGiftPublic(giftToReserve.id, guestName);
      setGifts((prev) => prev.map((item) => (item.id === updatedGift.id ? updatedGift : item)));
      showToast('Подарок успешно забронирован!', 'success');
      setGiftToReserve(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось зарезервировать подарок.', 'error');
    } finally {
      setGiftActionLoading(giftToReserve.id, false);
    }
  };

  if (isLoading) {
    return (
      <main className="auth-page">
        <div className="loader">Загружаем список подарков...</div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <p className="title-kicker">Ошибка</p>
          <h1 className="page-title" style={{ fontSize: '28px' }}>Список не найден</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            Проверьте правильность ссылки или обратитесь к имениннику.
          </p>
        </div>
      </main>
    );
  }

  const noop = () => {};

  return (
    <>
      <main className="page">
        <div className="container">
          <header className="header">
            <div className="title-wrap">
              <p className="title-kicker">Праздничный список</p>
              <h1 className="page-title">Список подарков на день рождения</h1>
              {ownerEmail ? (
                <p className="user-meta">Пожелания от {ownerEmail}</p>
              ) : null}
            </div>
          </header>

          <div className="page-stack">
            {gifts.length > 0 ? (
              <GiftGrid
                gifts={gifts}
                role={null}
                actionLoading={actionLoading}
                onReserve={handleReserveClick}
                onUnreserve={noop}
                onEdit={noop}
                onDelete={noop}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-icon">Подарки</div>
                <p className="empty-title">Список пока пуст</p>
                <p className="empty-subtitle">Именинник ещё не добавил подарки. Загляните позже!</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <ReserveDialog
        isOpen={Boolean(giftToReserve)}
        giftTitle={giftToReserve?.title ?? ''}
        isLoading={giftToReserve ? Boolean(actionLoading[giftToReserve.id]) : false}
        onConfirm={(name) => void handleReserveConfirm(name)}
        onCancel={() => setGiftToReserve(null)}
      />

      <Notification toasts={toasts} onClose={removeToast} />
    </>
  );
}
