import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DonationCard } from '../components/DonationCard';
import { DonationModal } from '../components/DonationModal';
import { EmptyState } from '../components/EmptyState';
import { GiftGrid } from '../components/GiftGrid';
import { GiftModal } from '../components/GiftModal';
import { Header } from '../components/Header';
import { Notification } from '../components/Notification';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  createDonationCampaign,
  createDonationPayment,
  fetchActiveDonationCampaign,
  syncDonationStatuses,
  updateDonationCampaign,
} from '../services/donationApi';
import {
  createGift,
  deleteGift,
  fetchGifts,
  reserveGift,
  resolveGiftProduct,
  unreserveGift,
  updateGift,
} from '../services/giftsApi';
import type { DonationCampaign, DonationCampaignFormValues } from '../types/donation';
import type { Gift, GiftFormValues } from '../types/gift';
import { canCreateGift, isAdmin } from '../utils/permissions';

export function GiftsPage() {
  const { role, user, signOut } = useAuth();
  const { toasts, showToast, removeToast } = useToast();

  const [gifts, setGifts] = useState<Gift[]>([]);
  const [donationCampaign, setDonationCampaign] = useState<DonationCampaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDonationLoading, setIsDonationLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<Gift | null>(null);
  const [giftToDelete, setGiftToDelete] = useState<Gift | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDonationSaving, setIsDonationSaving] = useState(false);
  const [isDonationPaying, setIsDonationPaying] = useState(false);
  const [isDonationRefreshing, setIsDonationRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const canAddGift = canCreateGift(role);
  const canManageDonation = isAdmin(role);

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

  const loadDonationCampaign = useCallback(
    async (options?: { syncStatuses?: boolean; silent?: boolean }) => {
      if (!options?.silent) {
        setIsDonationLoading(true);
      }

      try {
        if (options?.syncStatuses) {
          await syncDonationStatuses();
        }

        const nextCampaign = await fetchActiveDonationCampaign();
        setDonationCampaign(nextCampaign);
        return true;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Не удалось загрузить сбор.', 'error');
        return false;
      } finally {
        if (!options?.silent) {
          setIsDonationLoading(false);
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    void loadGifts();
    void loadDonationCampaign({ syncStatuses: true });
  }, [loadDonationCampaign, loadGifts]);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);

    if (currentUrl.searchParams.get('donation') !== 'return') {
      return;
    }

    currentUrl.searchParams.delete('donation');
    window.history.replaceState({}, '', currentUrl.toString());
    showToast('Проверяем статус платежа в ЮKassa...', 'success');
    void loadDonationCampaign({ syncStatuses: true, silent: true });
  }, [loadDonationCampaign, showToast]);

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
    setIsSaving(true);

    try {
      const savedGift = editingGift
        ? await updateGift(editingGift.id, values)
        : await createGift(values);

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

  const handleSaveDonationCampaign = async (values: DonationCampaignFormValues) => {
    setIsDonationSaving(true);

    try {
      const savedCampaign = donationCampaign
        ? await updateDonationCampaign(donationCampaign.id, values)
        : await createDonationCampaign(values);

      setDonationCampaign(savedCampaign);
      setIsDonationModalOpen(false);
      showToast(donationCampaign ? 'Сбор обновлён.' : 'Сбор настроен.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось сохранить сбор.', 'error');
    } finally {
      setIsDonationSaving(false);
    }
  };

  const handleReserve = async (gift: Gift) => {
    setGiftActionLoading(gift.id, true);

    try {
      const updatedGift = await reserveGift(gift.id);
      setGifts((prev) => prev.map((item) => (item.id === updatedGift.id ? updatedGift : item)));
      showToast('Подарок успешно зарезервирован.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не удалось зарезервировать подарок.', 'error');
      await loadGifts();
    } finally {
      setGiftActionLoading(gift.id, false);
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

  const handleDonate = async (amount: string) => {
    if (!donationCampaign) {
      return;
    }

    setIsDonationPaying(true);

    try {
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.set('donation', 'return');

      const { confirmationUrl } = await createDonationPayment({
        campaignId: donationCampaign.id,
        amount,
        returnUrl: returnUrl.toString(),
      });

      window.location.assign(confirmationUrl);
    } catch (error) {
      setIsDonationPaying(false);
      showToast(error instanceof Error ? error.message : 'Не удалось создать платёж.', 'error');
    }
  };

  const handleRefreshDonation = async () => {
    setIsDonationRefreshing(true);

    try {
      const isUpdated = await loadDonationCampaign({ syncStatuses: true, silent: true });

      if (isUpdated) {
        showToast('Прогресс сбора обновлён.', 'success');
      }
    } finally {
      setIsDonationRefreshing(false);
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

  if (!role) {
    return null;
  }

  return (
    <>
      <main className="page">
        <div className="container">
          <Header
            role={role}
            userEmail={user?.email ?? 'Без email'}
            canAddGift={canAddGift}
            isSigningOut={isSigningOut}
            onAddClick={handleAddClick}
            onSignOut={() => void handleSignOut()}
          />

          <div className="page-stack">
            {!isDonationLoading || canManageDonation ? (
              <DonationCard
                campaign={donationCampaign}
                canManage={canManageDonation}
                isCreatingPayment={isDonationPaying}
                isRefreshing={isDonationRefreshing}
                onDonate={(amount) => void handleDonate(amount)}
                onManage={canManageDonation ? () => setIsDonationModalOpen(true) : undefined}
                onRefresh={() => void handleRefreshDonation()}
              />
            ) : null}

            {isLoading ? (
              <div className="loader">Загружаем список подарков...</div>
            ) : gifts.length > 0 ? (
              <GiftGrid
                gifts={gifts}
                role={role}
                actionLoading={actionLoading}
                onReserve={(gift) => void handleReserve(gift)}
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
        onResolveProduct={resolveGiftProduct}
      />

      <DonationModal
        isOpen={isDonationModalOpen}
        initialCampaign={donationCampaign}
        isSaving={isDonationSaving}
        onClose={() => {
          if (!isDonationSaving) {
            setIsDonationModalOpen(false);
          }
        }}
        onSubmit={handleSaveDonationCampaign}
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
