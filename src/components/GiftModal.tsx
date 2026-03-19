import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Gift, GiftFormValues } from '../types/gift';
import { uploadGiftImage, validateImageFile } from '../services/storageApi';

type ImageSource = 'url' | 'file';

interface GiftModalProps {
  isOpen: boolean;
  initialGift?: Gift | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: GiftFormValues) => Promise<void>;
}

const defaultFormValues: GiftFormValues = {
  title: '',
  productUrl: '',
  imageUrl: '',
  price: '',
};

export function GiftModal({ isOpen, initialGift, isSaving, onClose, onSubmit }: GiftModalProps) {
  const [values, setValues] = useState<GiftFormValues>(defaultFormValues);
  const [errors, setErrors] = useState<Partial<Record<keyof GiftFormValues, string>>>({});
  const [imageSource, setImageSource] = useState<ImageSource>('file');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modalTitle = useMemo(() => (initialGift ? 'Редактировать подарок' : 'Добавить подарок'), [initialGift]);
  const isBusy = isSaving || isUploading;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialGift) {
      setValues({
        title: initialGift.title,
        productUrl: initialGift.product_url,
        imageUrl: initialGift.image_url,
        price: initialGift.price?.toString() ?? '',
      });
      setImageSource('url');
    } else {
      setValues(defaultFormValues);
      setImageSource('file');
    }

    setErrors({});
    setUploadError(null);
    setFileName(null);
    setIsUploading(false);
  }, [initialGift, isOpen]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const validationError = validateImageFile(file);

    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setFileName(file.name);

    try {
      const publicUrl = await uploadGiftImage(file);
      setValues((prev) => ({ ...prev, imageUrl: publicUrl }));
      setErrors((prev) => ({ ...prev, imageUrl: undefined }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Не удалось загрузить изображение.');
      setFileName(null);
    } finally {
      setIsUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, []);

  if (!isOpen) {
    return null;
  }

  const validate = () => {
    const nextErrors: Partial<Record<keyof GiftFormValues, string>> = {};

    if (!values.title.trim()) {
      nextErrors.title = 'Введите название подарка.';
    }

    if (values.productUrl.trim()) {
      try {
        new URL(values.productUrl.trim());
      } catch {
        nextErrors.productUrl = 'Укажите корректную ссылку на товар.';
      }
    }

    if (!values.imageUrl.trim()) {
      nextErrors.imageUrl = imageSource === 'file'
        ? 'Загрузите изображение подарка.'
        : 'Укажите URL изображения товара.';
    } else if (imageSource === 'url') {
      try {
        new URL(values.imageUrl.trim());
      } catch {
        nextErrors.imageUrl = 'Укажите корректный URL изображения.';
      }
    }

    if (values.price.trim()) {
      const parsedPrice = Number(values.price.replace(',', '.'));

      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        nextErrors.price = 'Цена должна быть больше нуля.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    await onSubmit({
      ...values,
      productUrl: values.productUrl.trim(),
      price: values.price.trim() ? values.price.replace(',', '.') : '',
    });
  };

  const handleImageSourceChange = (source: ImageSource) => {
    setImageSource(source);
    setValues((prev) => ({ ...prev, imageUrl: '' }));
    setErrors((prev) => ({ ...prev, imageUrl: undefined }));
    setUploadError(null);
    setFileName(null);
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h2>{modalTitle}</h2>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="form-field">
            <span>Название подарка</span>
            <input
              type="text"
              value={values.title}
              onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Например, кофемашина для именинника"
              disabled={isBusy}
            />
            {errors.title ? <small>{errors.title}</small> : null}
          </label>

          <label className="form-field">
            <span>Ссылка на товар</span>
            <input
              type="url"
              value={values.productUrl}
              onChange={(event) => setValues((prev) => ({ ...prev, productUrl: event.target.value }))}
              placeholder="https://..."
              disabled={isBusy}
            />
            {errors.productUrl ? <small>{errors.productUrl}</small> : null}
          </label>

          <div className="form-field">
            <span>Изображение</span>
            <div className="image-source-toggle">
              <button
                type="button"
                className={`image-source-btn ${imageSource === 'file' ? 'active' : ''}`}
                onClick={() => handleImageSourceChange('file')}
                disabled={isBusy}
              >
                Загрузить файл
              </button>
              <button
                type="button"
                className={`image-source-btn ${imageSource === 'url' ? 'active' : ''}`}
                onClick={() => handleImageSourceChange('url')}
                disabled={isBusy}
              >
                Вставить ссылку
              </button>
            </div>

            {imageSource === 'file' ? (
              <div className="image-upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => void handleFileChange(event)}
                  disabled={isBusy}
                  className="image-file-input"
                  id="gift-image-upload"
                />
                <label htmlFor="gift-image-upload" className="image-upload-label">
                  {isUploading
                    ? 'Загружаем...'
                    : fileName
                      ? fileName
                      : values.imageUrl
                        ? 'Изображение загружено'
                        : 'JPG, PNG, WEBP или GIF до 5 МБ'}
                </label>
              </div>
            ) : (
              <input
                type="url"
                value={values.imageUrl}
                onChange={(event) => setValues((prev) => ({ ...prev, imageUrl: event.target.value }))}
                placeholder="https://..."
                disabled={isBusy}
              />
            )}

            {uploadError ? <small>{uploadError}</small> : null}
            {errors.imageUrl ? <small>{errors.imageUrl}</small> : null}
          </div>

          <label className="form-field">
            <span>Цена, ₽ <span className="form-optional">необязательно</span></span>
            <input
              type="number"
              min="1"
              step="0.01"
              value={values.price}
              onChange={(event) => setValues((prev) => ({ ...prev, price: event.target.value }))}
              placeholder="Например, 4990"
              disabled={isBusy}
            />
            {errors.price ? <small>{errors.price}</small> : null}
          </label>

          {values.imageUrl ? (
            <div className="gift-preview">
              <img src={values.imageUrl} alt={values.title || 'Предпросмотр товара'} />
              <div className="gift-preview-meta">
                <strong>{values.title || 'Название появится здесь'}</strong>
                {values.price ? <span>{values.price} ₽</span> : null}
              </div>
            </div>
          ) : null}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isBusy}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={isBusy}>
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
