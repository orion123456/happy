export type Marketplace = 'wildberries';

export type GiftDetailsSource = 'wildberries' | 'manual';

export interface Gift {
  id: string;
  title: string;
  product_url: string;
  image_url: string;
  marketplace: Marketplace;
  product_id: string | null;
  price: number | null;
  currency: string | null;
  metadata_updated_at: string | null;
  details_source: GiftDetailsSource;
  is_reserved: boolean;
  created_at: string;
  updated_at: string;
}

export interface GiftPayload {
  title: string;
  product_url: string;
  image_url: string;
  marketplace: Marketplace;
  product_id: string;
  price: number | null;
  currency: string;
  metadata_updated_at: string;
  details_source: GiftDetailsSource;
}

export interface GiftSnapshotPatch {
  price?: number | null;
  currency?: string | null;
  metadata_updated_at?: string;
}

export interface GiftFormValues {
  productUrl: string;
  title: string;
  imageUrl: string;
  price: string;
  productId: string;
  marketplace: Marketplace;
  detailsSource: GiftDetailsSource;
}

export interface ResolvedGiftProduct {
  title: string;
  imageUrl: string;
  price: number | null;
  currency: string;
  productId: string;
  marketplace: Marketplace;
  resolvedAt: string;
}
