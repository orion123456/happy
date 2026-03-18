import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { AuthContext } from './auth-context';
import { fetchCurrentProfile, signInWithPassword, signOutCurrentUser, signUpWithPassword } from '../services/authApi';
import { supabase } from '../services/supabaseClient';
import type { AuthContextValue } from './auth-context';
import type { Profile, Role } from '../types/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const currentRoleRef = useRef<Role | null>(null);

  useEffect(() => {
    currentUserIdRef.current = user?.id ?? null;
    currentRoleRef.current = role;
  }, [role, user]);

  const loadProfile = useCallback(async (userId: string) => {
    const currentProfile = await fetchCurrentProfile(userId);

    if (!currentProfile) {
      setProfile(null);
      setRole(null);
      setAuthError('Профиль пользователя не найден. Обратитесь к администратору.');
      return;
    }

    setProfile(currentProfile);
    setRole(currentProfile.role);
    setAuthError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setRole(null);
      return;
    }

    await loadProfile(user.id);
  }, [loadProfile, user]);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      setIsAuthLoading(true);

      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthError('Сессия истекла, войдите снова.');
        setSession(null);
        setUser(null);
        setProfile(null);
        setRole(null);
        setIsAuthLoading(false);
        return;
      }

      const currentSession = data.session;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        try {
          await loadProfile(currentSession.user.id);
        } catch {
          if (isMounted) {
            setAuthError('Не удалось загрузить профиль пользователя.');
            setProfile(null);
            setRole(null);
          }
        }
      } else {
        setProfile(null);
        setRole(null);
        setAuthError(null);
      }

      if (isMounted) {
        setIsAuthLoading(false);
      }
    };

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        setRole(null);
        setAuthError(null);
        setIsAuthLoading(false);
        return;
      }

      const isSameUserSession = currentUserIdRef.current === nextSession.user.id;
      const hasResolvedRole = Boolean(currentRoleRef.current);

      // Supabase may emit SIGNED_IN or TOKEN_REFRESHED again when the tab becomes active.
      // For an already initialized session we keep the current UI intact.
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && isSameUserSession && hasResolvedRole) {
        setIsAuthLoading(false);
        return;
      }

      setIsAuthLoading(true);
      void loadProfile(nextSession.user.id)
        .catch(() => {
          setAuthError('Не удалось загрузить профиль пользователя.');
          setProfile(null);
          setRole(null);
        })
        .finally(() => {
          setIsAuthLoading(false);
        });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithPassword(email, password);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, role: Role, adminInviteCode?: string) =>
      signUpWithPassword(email, password, role, adminInviteCode),
    []
  );

  const signOut = useCallback(async () => {
    await signOutCurrentUser();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      role,
      isAuthLoading,
      authError,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, user, profile, role, isAuthLoading, authError, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
