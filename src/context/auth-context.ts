import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile, Role } from '../types/auth';

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: Role | null;
  isAuthLoading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
