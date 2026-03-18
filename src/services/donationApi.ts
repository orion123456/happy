import { supabase } from './supabaseClient';
import type { CreateDonationPaymentInput, DonationCampaign, DonationCampaignFormValues } from '../types/donation';

interface DonationCampaignRow {
  id: string;
  title: string;
  description: string | null;
  product_url: string | null;
  image_url: string | null;
  target_amount: string | number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  donation_payments?: DonationPaymentRow[] | null;
}

interface DonationPaymentRow {
  amount: string | number;
  status: string;
}

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function mapCampaign(row: DonationCampaignRow): DonationCampaign {
  const payments = row.donation_payments ?? [];
  const succeededPayments = payments.filter((payment) => payment.status === 'succeeded');
  const collectedAmount = succeededPayments.reduce((sum, payment) => sum + parseMoney(payment.amount), 0);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    product_url: row.product_url,
    image_url: row.image_url,
    target_amount: parseMoney(row.target_amount),
    collected_amount: collectedAmount,
    currency: row.currency || 'RUB',
    donation_count: succeededPayments.length,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchActiveDonationCampaign(): Promise<DonationCampaign | null> {
  const { data, error } = await supabase
    .from('donation_campaigns')
    .select('*, donation_payments(amount, status)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('Не удалось загрузить сбор на подарок.');
  }

  if (!data) {
    return null;
  }

  return mapCampaign(data as DonationCampaignRow);
}

export async function createDonationCampaign(values: DonationCampaignFormValues): Promise<DonationCampaign> {
  await supabase.from('donation_campaigns').update({ is_active: false }).eq('is_active', true);

  const { data, error } = await supabase
    .from('donation_campaigns')
    .insert({
      title: values.title.trim(),
      description: values.description.trim() || null,
      product_url: values.productUrl.trim() || null,
      image_url: values.imageUrl.trim() || null,
      target_amount: Number(values.targetAmount.replace(',', '.')),
      currency: 'RUB',
      is_active: true,
    })
    .select('*, donation_payments(amount, status)')
    .single();

  if (error || !data) {
    throw new Error('Не удалось создать сбор на подарок.');
  }

  return mapCampaign(data as DonationCampaignRow);
}

export async function updateDonationCampaign(
  campaignId: string,
  values: DonationCampaignFormValues
): Promise<DonationCampaign> {
  const { data, error } = await supabase
    .from('donation_campaigns')
    .update({
      title: values.title.trim(),
      description: values.description.trim() || null,
      product_url: values.productUrl.trim() || null,
      image_url: values.imageUrl.trim() || null,
      target_amount: Number(values.targetAmount.replace(',', '.')),
      currency: 'RUB',
      is_active: true,
    })
    .eq('id', campaignId)
    .select('*, donation_payments(amount, status)')
    .single();

  if (error || !data) {
    throw new Error('Не удалось обновить сбор на подарок.');
  }

  return mapCampaign(data as DonationCampaignRow);
}

export async function createDonationPayment(input: CreateDonationPaymentInput): Promise<{ confirmationUrl: string }> {
  const { data, error } = await supabase.functions.invoke('create-yookassa-donation', {
    body: input,
  });

  if (error) {
    throw new Error(`Не удалось создать платёж ЮKassa: ${error.message}`);
  }

  if (!data || typeof data !== 'object' || typeof data.confirmationUrl !== 'string') {
    throw new Error('Edge Function создания платежа вернула некорректный ответ.');
  }

  return {
    confirmationUrl: data.confirmationUrl,
  };
}

export async function syncDonationStatuses(): Promise<void> {
  const { error } = await supabase.functions.invoke('sync-yookassa-donations', {
    body: {},
  });

  if (error) {
    throw new Error(`Не удалось обновить статусы платежей ЮKassa: ${error.message}`);
  }
}
