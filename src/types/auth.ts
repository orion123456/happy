export type Role = 'administrator' | 'user';

export interface Profile {
  id: string;
  email: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
}
