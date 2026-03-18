import { useEffect, useMemo, useState } from 'react';
import type { DonationCampaign, DonationCampaignFormValues } from '../types/donation';

interface DonationModalProps {
  isOpen: boolean;
  initialCampaign: DonationCampaign | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: DonationCampaignFormValues) => Promise<void>;
}

const defaultFormValues: DonationCampaignFormValues = {
  title: '',
  description: '',
  productUrl: '',
  imageUrl: '',
  targetAmount: '',
};

export function DonationModal({ isOpen, initialCampaign, isSaving, onClose, onSubmit }: DonationModalProps) {
  const [values, setValues] = useState<DonationCampaignFormValues>(defaultFormValues);
  const [errors, setErrors] = useState<Partial<Record<keyof DonationCampaignFormValues, string>>>({});
  const modalTitle = useMemo(
    () => (initialCampaign ? 'Настроить общий сбор' : 'Создать общий сбор'),
    [initialCampaign]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialCampaign) {
      setValues({
        title: initialCampaign.title,
        description: initialCampaign.description ?? '',
        productUrl: initialCampaign.product_url ?? '',
        imageUrl: initialCampaign.image_url ?? '',
        targetAmount: initialCampaign.target_amount.toString(),
      });
    } else {
      setValues(defaultFormValues);
    }

    setErrors({});
  }, [initialCampaign, isOpen]);

  if (!isOpen) {
    return null;
  }

  const validate = () => {
    const nextErrors: Partial<Record<keyof DonationCampaignFormValues, string>> = {};
    const parsedAmount = Number(values.targetAmount.replace(',', '.'));

    if (!values.title.trim()) {
      nextErrors.title = 'Введите название общего подарка.';
    }

    if (values.productUrl.trim()) {
      try {
        new URL(values.productUrl.trim());
      } catch {
        nextErrors.productUrl = 'Укажите корректную ссылку на товар.';
      }
    }

    if (values.imageUrl.trim()) {
      try {
        new URL(values.imageUrl.trim());
      } catch {
        nextErrors.imageUrl = 'Укажите корректную ссылку на изображение.';
      }
    }

    if (!values.targetAmount.trim()) {
      nextErrors.targetAmount = 'Укажите целевую сумму.';
    } else if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      nextErrors.targetAmount = 'Целевая сумма должна быть больше нуля.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    await onSubmit(values);
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h2>{modalTitle}</h2>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="form-field">
            <span>Название товара</span>
            <input
              type="text"
              value={values.title}
              onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Например, кофемашина для именинника"
              disabled={isSaving}
            />
            {errors.title ? <small>{errors.title}</small> : null}
          </label>

          <label className="form-field">
            <span>Описание</span>
            <textarea
              value={values.description}
              onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Пару слов, зачем нужен этот подарок"
              rows={4}
              disabled={isSaving}
            />
          </label>

          <div className="modal-grid">
            <label className="form-field">
              <span>Ссылка на товар</span>
              <input
                type="url"
                value={values.productUrl}
                onChange={(event) => setValues((prev) => ({ ...prev, productUrl: event.target.value }))}
                placeholder="https://..."
                disabled={isSaving}
              />
              {errors.productUrl ? <small>{errors.productUrl}</small> : null}
            </label>

            <label className="form-field">
              <span>Ссылка на изображение</span>
              <input
                type="url"
                value={values.imageUrl}
                onChange={(event) => setValues((prev) => ({ ...prev, imageUrl: event.target.value }))}
                placeholder="https://..."
                disabled={isSaving}
              />
              {errors.imageUrl ? <small>{errors.imageUrl}</small> : null}
            </label>
          </div>

          <label className="form-field">
            <span>Целевая сумма, ₽</span>
            <input
              type="number"
              min="1"
              step="1"
              value={values.targetAmount}
              onChange={(event) => setValues((prev) => ({ ...prev, targetAmount: event.target.value }))}
              placeholder="Например, 20000"
              disabled={isSaving}
            />
            {errors.targetAmount ? <small>{errors.targetAmount}</small> : null}
          </label>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
