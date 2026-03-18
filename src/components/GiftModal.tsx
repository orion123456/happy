import { useEffect, useMemo, useState } from 'react';
import type { Gift, GiftFormValues, ResolvedGiftProduct } from '../types/gift';
import { extractWildberriesProductId, isWildberriesUrl, normalizeWildberriesUrl } from '../utils/wildberries';

interface GiftModalProps {
  isOpen: boolean;
  initialGift?: Gift | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: GiftFormValues) => Promise<void>;
  onResolveProduct: (productUrl: string) => Promise<ResolvedGiftProduct>;
}

const defaultFormValues: GiftFormValues = {
  productUrl: '',
  title: '',
  imageUrl: '',
  price: '',
  productId: '',
  marketplace: 'wildberries',
  detailsSource: 'manual',
};

export function GiftModal({
  isOpen,
  initialGift,
  isSaving,
  onClose,
  onSubmit,
  onResolveProduct,
}: GiftModalProps) {
  const [values, setValues] = useState<GiftFormValues>(defaultFormValues);
  const [errors, setErrors] = useState<Partial<Record<'productUrl' | 'title' | 'imageUrl' | 'price', string>>>({});
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [hasTriedResolve, setHasTriedResolve] = useState(false);

  const modalTitle = useMemo(() => (initialGift ? 'Редактировать подарок' : 'Добавить подарок'), [initialGift]);
  const showDetailsFields = Boolean(initialGift) || hasTriedResolve;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialGift) {
      setValues({
        productUrl: initialGift.product_url,
        title: initialGift.title,
        imageUrl: initialGift.image_url,
        price: initialGift.price?.toString() ?? '',
        productId: initialGift.product_id ?? extractWildberriesProductId(initialGift.product_url) ?? '',
        marketplace: initialGift.marketplace,
        detailsSource: initialGift.details_source,
      });
      setHasTriedResolve(true);
    } else {
      setValues(defaultFormValues);
      setHasTriedResolve(false);
    }

    setErrors({});
    setResolveError(null);
    setIsResolving(false);
  }, [initialGift, isOpen]);

  if (!isOpen) {
    return null;
  }

  const validate = () => {
    const nextErrors: Partial<Record<'productUrl' | 'title' | 'imageUrl' | 'price', string>> = {};
    const normalizedUrl = normalizeWildberriesUrl(values.productUrl);
    const productId = values.productId.trim() || extractWildberriesProductId(normalizedUrl);
    const parsedPrice = Number(values.price.replace(',', '.'));

    if (!normalizedUrl) {
      nextErrors.productUrl = 'Вставьте ссылку на товар Wildberries.';
    } else if (!isWildberriesUrl(normalizedUrl)) {
      nextErrors.productUrl = 'Поддерживаются только ссылки на Wildberries.';
    } else {
      try {
        new URL(normalizedUrl);
      } catch {
        nextErrors.productUrl = 'Укажите корректную ссылку на товар.';
      }
    }

    if (!showDetailsFields) {
      nextErrors.productUrl = nextErrors.productUrl ?? 'Сначала попробуйте подтянуть данные по ссылке.';
    }

    if (!values.title.trim()) {
      nextErrors.title = 'Введите название подарка.';
    }

    if (!values.imageUrl.trim()) {
      nextErrors.imageUrl = 'Укажите URL изображения товара.';
    } else {
      try {
        new URL(values.imageUrl.trim());
      } catch {
        nextErrors.imageUrl = 'Укажите корректный URL изображения.';
      }
    }

    if (!values.price.trim()) {
      nextErrors.price = 'Укажите цену товара.';
    } else if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      nextErrors.price = 'Цена должна быть больше нуля.';
    }

    if (!productId) {
      nextErrors.productUrl = nextErrors.productUrl ?? 'Не удалось определить ID товара из ссылки.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleResolve = async () => {
    const normalizedUrl = normalizeWildberriesUrl(values.productUrl);
    setHasTriedResolve(true);

    if (!normalizedUrl || !isWildberriesUrl(normalizedUrl)) {
      setErrors((prev) => ({
        ...prev,
        productUrl: 'Поддерживаются только ссылки на Wildberries.',
      }));
      return;
    }

    setIsResolving(true);
    setResolveError(null);
    setErrors((prev) => ({ ...prev, productUrl: undefined }));

    try {
      const result = await onResolveProduct(normalizedUrl);

      setValues((prev) => ({
        ...prev,
        productUrl: normalizedUrl,
        title: result.title || prev.title,
        imageUrl: result.imageUrl || prev.imageUrl,
        price: result.price !== null ? String(result.price) : prev.price,
        productId: result.productId || prev.productId,
        marketplace: 'wildberries',
        detailsSource:
          result.title && result.imageUrl && result.price !== null
            ? 'wildberries'
            : 'manual',
      }));

      if (!result.title || !result.imageUrl || result.price === null) {
        setResolveError('Часть данных не удалось подтянуть. Дополните поля вручную.');
      }
    } catch (error) {
      setResolveError(error instanceof Error ? error.message : 'Не удалось подтянуть данные по ссылке.');
      setValues((prev) => ({
        ...prev,
        productUrl: normalizedUrl,
        productId: prev.productId || extractWildberriesProductId(normalizedUrl) || '',
        marketplace: 'wildberries',
        detailsSource: 'manual',
      }));
    } finally {
      setIsResolving(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    await onSubmit({
      ...values,
      productUrl: normalizeWildberriesUrl(values.productUrl),
      productId: values.productId.trim() || extractWildberriesProductId(values.productUrl) || '',
      price: values.price.replace(',', '.'),
    });
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h2>{modalTitle}</h2>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="form-field">
            <span>Ссылка на товар Wildberries</span>
            <input
              type="url"
              value={values.productUrl}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  productUrl: event.target.value,
                }))
              }
              placeholder="https://www.wildberries.ru/catalog/..."
              disabled={isSaving || isResolving}
            />
            {errors.productUrl ? <small>{errors.productUrl}</small> : null}
          </label>

          <div className="modal-inline-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void handleResolve()}
              disabled={isSaving || isResolving}
            >
              {isResolving ? 'Подтягиваем...' : 'Подтянуть данные'}
            </button>
            <p className="form-hint">Поддерживаются только ссылки на карточки Wildberries.</p>
          </div>

          {resolveError ? <div className="form-banner form-banner-warning">{resolveError}</div> : null}

          {showDetailsFields ? (
            <>
              <label className="form-field">
                <span>Название подарка</span>
                <input
                  type="text"
                  value={values.title}
                  onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Название подтянется автоматически или введите вручную"
                  disabled={isSaving}
                />
                {errors.title ? <small>{errors.title}</small> : null}
              </label>

              <label className="form-field">
                <span>URL изображения</span>
                <input
                  type="url"
                  value={values.imageUrl}
                  onChange={(event) => setValues((prev) => ({ ...prev, imageUrl: event.target.value }))}
                  placeholder="Ссылка на изображение товара"
                  disabled={isSaving}
                />
                {errors.imageUrl ? <small>{errors.imageUrl}</small> : null}
              </label>

              <div className="modal-grid">
                <label className="form-field">
                  <span>Цена, ₽</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={values.price}
                    onChange={(event) => setValues((prev) => ({ ...prev, price: event.target.value }))}
                    placeholder="Например, 4990"
                    disabled={isSaving}
                  />
                  {errors.price ? <small>{errors.price}</small> : null}
                </label>

                <label className="form-field">
                  <span>ID товара</span>
                  <input type="text" value={values.productId} readOnly disabled />
                </label>
              </div>

              {values.imageUrl ? (
                <div className="gift-preview">
                  <img src={values.imageUrl} alt={values.title || 'Предпросмотр товара'} />
                  <div className="gift-preview-meta">
                    <strong>{values.title || 'Название появится здесь'}</strong>
                    <span>Wildberries</span>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving || isResolving}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving || isResolving}>
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
