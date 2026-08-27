import { createStore } from 'solid-js/store';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const [authState, setAuthState] = createStore<AuthState>({
  session: null,
  user: null,
  loading: true,
  isAdmin: false,
});

export const useAuthStore = () => authState;

const checkAdminStatus = async (userId: string | undefined) => {
  if (!userId) return false;
  try {
    const { data, error } = await supabase.from('admin_users').select('id').eq('id', userId).single();
    if (error) return false;
    return !!data;
  } catch (e) {
    return false;
  }
};

// Initialize auth
supabase.auth.getSession().then(async ({ data: { session } }) => {
  setAuthState('session', session);
  setAuthState('user', session?.user ?? null);
  setAuthState('isAdmin', await checkAdminStatus(session?.user?.id));
  setAuthState('loading', false);
});

supabase.auth.onAuthStateChange(async (_event, session) => {
  setAuthState('session', session);
  setAuthState('user', session?.user ?? null);
  setAuthState('isAdmin', await checkAdminStatus(session?.user?.id));
  setAuthState('loading', false);
});

export const setCustomSession = async (accessToken: string, refreshToken: string) => {
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  await supabase.auth.signOut();
};
