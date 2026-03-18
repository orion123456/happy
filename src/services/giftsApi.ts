import { supabase } from './supabaseClient';
import type { Gift, GiftFormValues, ResolvedGiftProduct } from '../types/gift';
import { extractWildberriesProductId, normalizeWildberriesUrl } from '../utils/wildberries';

interface GiftRow {
  id: string;
  title: string;
  product_url: string;
  image_url: string;
  is_reserved: boolean;
  created_at: string;
  updated_at: string;
  marketplace?: string | null;
  product_id?: string | null;
  price?: number | null;
  currency?: string | null;
  metadata_updated_at?: string | null;
  details_source?: 'wildberries' | 'manual' | null;
}

function mapGift(row: GiftRow): Gift {
  return {
    id: row.id,
    title: row.title,
    product_url: row.product_url,
    image_url: row.image_url,
    marketplace: 'wildberries',
    product_id: row.product_id ?? extractWildberriesProductId(row.product_url),
    price: typeof row.price === 'number' ? row.price : null,
    currency: row.currency ?? 'RUB',
    metadata_updated_at: row.metadata_updated_at ?? row.updated_at ?? null,
    details_source: row.details_source ?? 'manual',
    is_reserved: row.is_reserved,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchGifts(): Promise<Gift[]> {
  const { data, error } = await supabase
    .from('gifts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Не удалось загрузить список подарков.');
  }

  return (data as GiftRow[]).map(mapGift);
}

export async function createGift(values: GiftFormValues): Promise<Gift> {
  const payload = {
    title: values.title.trim(),
    product_url: normalizeWildberriesUrl(values.productUrl),
    image_url: values.imageUrl.trim(),
  };

  const { data, error } = await supabase
    .from('gifts')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Не удалось добавить подарок.');
  }

  return mapGift(data as GiftRow);
}

export async function updateGift(giftId: string, values: GiftFormValues): Promise<Gift> {
  const payload = {
    title: values.title.trim(),
    product_url: normalizeWildberriesUrl(values.productUrl),
    image_url: values.imageUrl.trim(),
  };

  const { data, error } = await supabase
    .from('gifts')
    .update(payload)
    .eq('id', giftId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Не удалось обновить подарок.');
  }

  return mapGift(data as GiftRow);
}

export async function deleteGift(giftId: string): Promise<void> {
  const { error } = await supabase.from('gifts').delete().eq('id', giftId);

  if (error) {
    throw new Error('Не удалось удалить подарок.');
  }
}

export async function reserveGift(giftId: string): Promise<Gift> {
  const { data, error } = await supabase.rpc('reserve_gift', { gift_id: giftId });

  if (error || !data) {
    if (error?.message?.includes('already_reserved')) {
      throw new Error('Этот подарок уже зарезервирован.');
    }

    throw new Error('Не удалось зарезервировать подарок.');
  }

  return mapGift(data as GiftRow);
}

export async function unreserveGift(giftId: string): Promise<Gift> {
  const { data, error } = await supabase
    .from('gifts')
    .update({ is_reserved: false })
    .eq('id', giftId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Не удалось снять резерв.');
  }

  return mapGift(data as GiftRow);
}

export async function resolveGiftProduct(productUrl: string): Promise<ResolvedGiftProduct> {
  const normalizedUrl = normalizeWildberriesUrl(productUrl);
  const productId = extractWildberriesProductId(normalizedUrl);

  if (!productId) {
    throw new Error('Не удалось определить ID товара из ссылки Wildberries.');
  }

  const { data, error } = await supabase.functions.invoke('resolve-wildberries-product', {
    body: {
      productUrl: normalizedUrl,
    },
  });

  if (error) {
    throw new Error(`Не удалось подтянуть данные из Wildberries: ${error.message}`);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Edge Function вернула некорректный ответ.');
  }

  const response = data as {
    title?: string;
    imageUrl?: string;
    price?: number | null;
    currency?: string;
    error?: string;
  };

  if (response.error) {
    throw new Error(response.error);
  }

  return {
    title: response.title?.trim() ?? '',
    imageUrl: response.imageUrl?.trim() ?? '',
    price: typeof response.price === 'number' && Number.isFinite(response.price) ? response.price : null,
    currency: response.currency?.trim() || 'RUB',
    productId,
    marketplace: 'wildberries',
    resolvedAt: new Date().toISOString(),
  };
}
