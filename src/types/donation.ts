export interface DonationCampaign {
  id: string;
  title: string;
  description: string | null;
  product_url: string | null;
  image_url: string | null;
  target_amount: number;
  collected_amount: number;
  currency: string;
  donation_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DonationCampaignFormValues {
  title: string;
  description: string;
  productUrl: string;
  imageUrl: string;
  targetAmount: string;
}

export interface CreateDonationPaymentInput {
  campaignId: string;
  amount: string;
  returnUrl: string;
}
