import { STORAGE_BUCKET, supabase } from './supabaseClient';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Разрешены только форматы JPG, PNG, WEBP или GIF.';
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Размер изображения не должен превышать 5 МБ.';
  }

  return null;
}

export async function uploadGiftImage(file: File): Promise<string> {
  const extension = file.name.split('.').pop() || 'jpg';
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const filePath = `gift-images/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { upsert: false });

  if (uploadError) {
    throw new Error('Не удалось загрузить изображение. Попробуйте еще раз.');
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

  if (!data.publicUrl) {
    throw new Error('Не удалось получить ссылку на изображение.');
  }

  return data.publicUrl;
}
