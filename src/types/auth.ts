export type Role = 'administrator';

export interface Profile {
  id: string;
  email: string | null;
  role: Role;
  share_id: string;
  created_at: string;
  updated_at: string;
}
