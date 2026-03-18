import { useMemo, useState } from 'react';
import type { DonationCampaign } from '../types/donation';
import { formatGiftPrice } from '../utils/wildberries';

interface DonationCardProps {
  campaign: DonationCampaign | null;
  canManage: boolean;
  isCreatingPayment: boolean;
  isRefreshing: boolean;
  onDonate: (amount: string) => void;
  onManage?: () => void;
  onRefresh: () => void;
}

function getProgressPercent(campaign: DonationCampaign): number {
  if (campaign.target_amount <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((campaign.collected_amount / campaign.target_amount) * 100));
}

export function DonationCard({
  campaign,
  canManage,
  isCreatingPayment,
  isRefreshing,
  onDonate,
  onManage,
  onRefresh,
}: DonationCardProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const progressPercent = useMemo(() => (campaign ? getProgressPercent(campaign) : 0), [campaign]);

  if (!campaign) {
    if (!canManage) {
      return null;
    }

    return (
      <section className="donation-card">
        <div className="donation-empty">
          <p className="donation-card-kicker">Общий сбор</p>
          <h2 className="donation-card-title">Добавьте цель для общего подарка</h2>
          <p className="donation-card-description">
            Администратор может задать товар, целевую сумму и открыть тестовый сбор через ЮKassa.
          </p>
          {onManage ? (
            <div className="donation-actions">
              <button type="button" className="btn btn-primary" onClick={onManage}>
                Настроить сбор
              </button>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const formattedRaised = formatGiftPrice(campaign.collected_amount, campaign.currency) ?? '0 ₽';
  const formattedTarget = formatGiftPrice(campaign.target_amount, campaign.currency) ?? '0 ₽';
  const remainingAmount = Math.max(campaign.target_amount - campaign.collected_amount, 0);
  const formattedRemaining = formatGiftPrice(remainingAmount, campaign.currency) ?? '0 ₽';

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedAmount = Number(amount.replace(',', '.'));

    if (!amount.trim()) {
      setError('Укажите сумму, которую хотите перевести.');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Сумма должна быть больше нуля.');
      return;
    }

    setError(null);
    onDonate(parsedAmount.toFixed(2));
  };

  return (
    <section className="donation-card">
      <div className="donation-card-header">
        <div className="donation-card-copy">
          <p className="donation-card-kicker">Общий подарок</p>
          <h2 className="donation-card-title">{campaign.title}</h2>
          {campaign.description ? <p className="donation-card-description">{campaign.description}</p> : null}
        </div>

        <div className="donation-actions">
          <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? 'Обновляем...' : 'Обновить прогресс'}
          </button>
          {canManage && onManage ? (
            <button type="button" className="btn btn-primary" onClick={onManage}>
              Настроить сбор
            </button>
          ) : null}
        </div>
      </div>

      <div className="donation-layout">
        <div className="donation-product">
          <div className="donation-product-media">
            {campaign.image_url ? (
              <img src={campaign.image_url} alt={campaign.title} />
            ) : (
              <div className="donation-product-fallback">Фото товара не добавлено</div>
            )}
          </div>

          <div>
            <div className="donation-stats">
              <div className="donation-stat-row">
                <span className="donation-raised">{formattedRaised}</span>
                <span className="donation-target">из {formattedTarget}</span>
              </div>
              <div className="donation-progress-track" aria-hidden="true">
                <div className="donation-progress-value" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="donation-progress-meta">
                <span>Собрано {progressPercent}%</span>
                <span>Осталось {formattedRemaining}</span>
                <span>Платежей: {campaign.donation_count}</span>
              </div>
            </div>

            {campaign.product_url ? (
              <a href={campaign.product_url} target="_blank" rel="noreferrer noopener" className="product-link">
                Открыть товар
              </a>
            ) : null}
          </div>
        </div>

        <div>
          <form className="donation-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Сумма перевода, ₽</span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Например, 500"
                disabled={isCreatingPayment}
              />
              {error ? <small>{error}</small> : null}
            </label>

            <button type="submit" className="btn btn-primary" disabled={isCreatingPayment}>
              {isCreatingPayment ? 'Переход к оплате...' : 'Скинуться через ЮKassa'}
            </button>
          </form>

          <p className="donation-note">
            Используется тестовый режим ЮKassa. После оплаты вернитесь в приложение, и прогресс обновится.
          </p>
        </div>
      </div>
    </section>
  );
}
