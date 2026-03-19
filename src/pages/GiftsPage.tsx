import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { GiftGrid } from '../components/GiftGrid';
import { GiftModal } from '../components/GiftModal';
import { Header } from '../components/Header';
import { Notification } from '../components/Notification';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  createGift,
  deleteGift,
  fetchGifts,
  unreserveGift,
  updateGift,
} from '../services/giftsApi';
import type { Gift, GiftFormValues } from '../types/gift';
import { canCreateGift } from '../utils/permissions';

export function GiftsPage() {
  const { role, user, profile, signOut } = useAuth();
  const { toasts, showToast, removeToast } = useToast();

  const [gifts, setGifts] = useState<Gift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<Gift | null>(null);
  const [giftToDelete, setGiftToDelete] = useState<Gift | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const canAddGift = canCreateGift(role);

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

  const loadGifts = useCallback(async () => {
    setIsLoading(true);

    try {
      const nextGifts = await fetchGifts();
      setGifts(nextGifts);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось загрузить подарки.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadGifts();
  }, [loadGifts]);

  const handleCloseModal = () => {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingGift(null);
  };

  const handleAddClick = () => {
    setEditingGift(null);
    setIsModalOpen(true);
  };

  const handleEdit = (gift: Gift) => {
    setEditingGift(gift);
    setIsModalOpen(true);
  };

  const handleSaveGift = async (values: GiftFormValues) => {
    if (!user) {
      return;
    }

    setIsSaving(true);

    try {
      const savedGift = editingGift
        ? await updateGift(editingGift.id, values)
        : await createGift(values, user.id);

      setGifts((prev) => {
        if (editingGift) {
          return prev.map((gift) => (gift.id === savedGift.id ? savedGift : gift));
        }

        return [savedGift, ...prev];
      });

      showToast(editingGift ? 'Подарок обновлён.' : 'Подарок добавлен.', 'success');
      setIsModalOpen(false);
      setEditingGift(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось сохранить подарок.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnreserve = async (gift: Gift) => {
    setGiftActionLoading(gift.id, true);

    try {
      const updatedGift = await unreserveGift(gift.id);
      setGifts((prev) => prev.map((item) => (item.id === updatedGift.id ? updatedGift : item)));
      showToast('Резерв снят.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось снять резерв.', 'error');
    } finally {
      setGiftActionLoading(gift.id, false);
    }
  };

  const handleDelete = (gift: Gift) => {
    setGiftToDelete(gift);
  };

  const handleConfirmDelete = async () => {
    if (!giftToDelete) {
      return;
    }

    setGiftActionLoading(giftToDelete.id, true);

    try {
      await deleteGift(giftToDelete.id);
      setGifts((prev) => prev.filter((gift) => gift.id !== giftToDelete.id));
      showToast('Подарок удалён.', 'success');
      setGiftToDelete(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось удалить подарок.', 'error');
    } finally {
      setGiftActionLoading(giftToDelete.id, false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await signOut();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось выйти из аккаунта.', 'error');
    } finally {
      setIsSigningOut(false);
    }
  };

  if (!role || !profile) {
    return null;
  }

  const noop = () => {};

  return (
    <>
      <main className="page">
        <div className="container">
          <Header
            role={role}
            userEmail={user?.email ?? 'Без email'}
            shareId={profile.share_id}
            canAddGift={canAddGift}
            isSigningOut={isSigningOut}
            onAddClick={handleAddClick}
            onSignOut={() => void handleSignOut()}
          />

          <div className="page-stack">
            {isLoading ? (
              <div className="loader">Загружаем список подарков...</div>
            ) : gifts.length > 0 ? (
              <GiftGrid
                gifts={gifts}
                role={role}
                actionLoading={actionLoading}
                onReserve={noop}
                onUnreserve={(gift) => void handleUnreserve(gift)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ) : (
              <EmptyState canAddGift={canAddGift} onAddClick={canAddGift ? handleAddClick : null} />
            )}
          </div>
        </div>
      </main>

      <GiftModal
        isOpen={isModalOpen}
        initialGift={editingGift}
        isSaving={isSaving}
        onClose={handleCloseModal}
        onSubmit={handleSaveGift}
      />

      <ConfirmDialog
        isOpen={Boolean(giftToDelete)}
        title="Удалить подарок?"
        description={`Подарок "${giftToDelete?.title ?? ''}" будет удалён без возможности восстановления.`}
        confirmText="Удалить"
        cancelText="Отмена"
        isLoading={giftToDelete ? Boolean(actionLoading[giftToDelete.id]) : false}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setGiftToDelete(null)}
      />

      <Notification toasts={toasts} onClose={removeToast} />
    </>
  );
}
