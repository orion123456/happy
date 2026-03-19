import { supabase } from './supabaseClient';
import type { Gift, GiftFormValues } from '../types/gift';

interface GiftRow {
  id: string;
  title: string;
  product_url: string;
  image_url: string;
  is_reserved: boolean;
  reserved_by: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  price?: number | null;
  currency?: string | null;
}

function mapGift(row: GiftRow): Gift {
  return {
    id: row.id,
    title: row.title,
    product_url: row.product_url,
    image_url: row.image_url,
    price: typeof row.price === 'number' ? row.price : null,
    currency: row.currency ?? 'RUB',
    is_reserved: row.is_reserved,
    reserved_by: row.reserved_by ?? null,
    owner_id: row.owner_id,
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

export async function createGift(values: GiftFormValues, ownerId: string): Promise<Gift> {
  const { data, error } = await supabase
    .from('gifts')
    .insert({
      title: values.title.trim(),
      product_url: values.productUrl.trim(),
      image_url: values.imageUrl.trim(),
      owner_id: ownerId,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Не удалось добавить подарок.');
  }

  return mapGift(data as GiftRow);
}

export async function updateGift(giftId: string, values: GiftFormValues): Promise<Gift> {
  const { data, error } = await supabase
    .from('gifts')
    .update({
      title: values.title.trim(),
      product_url: values.productUrl.trim(),
      image_url: values.imageUrl.trim(),
    })
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

export async function unreserveGift(giftId: string): Promise<Gift> {
  const { data, error } = await supabase
    .from('gifts')
    .update({ is_reserved: false, reserved_by: null })
    .eq('id', giftId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Не удалось снять резерв.');
  }

  return mapGift(data as GiftRow);
}

export async function fetchPublicWishlist(shareId: string): Promise<Gift[]> {
  const { data, error } = await supabase.rpc('get_public_wishlist', {
    p_share_id: shareId,
  });

  if (error) {
    throw new Error('Не удалось загрузить список подарков.');
  }

  return ((data ?? []) as GiftRow[]).map(mapGift);
}

export async function fetchWishlistOwner(shareId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_wishlist_owner', {
    p_share_id: shareId,
  });

  if (error || !data || data.length === 0) {
    return null;
  }

  return (data as Array<{ email: string }>)[0].email;
}

export async function reserveGiftPublic(giftId: string, guestName: string): Promise<Gift> {
  const { data, error } = await supabase.rpc('reserve_gift_public', {
    p_gift_id: giftId,
    p_guest_name: guestName.trim(),
  });

  if (error || !data) {
    if (error?.message?.includes('already_reserved')) {
      throw new Error('Этот подарок уже зарезервирован.');
    }

    if (error?.message?.includes('guest_name_required')) {
      throw new Error('Укажите ваше имя.');
    }

    throw new Error('Не удалось зарезервировать подарок.');
  }

  return mapGift(data as GiftRow);
}
