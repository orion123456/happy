export interface Gift {
  id: string;
  title: string;
  product_url: string;
  image_url: string;
  price: number | null;
  currency: string | null;
  is_reserved: boolean;
  reserved_by: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface GiftFormValues {
  title: string;
  productUrl: string;
  imageUrl: string;
  price: string;
}
