import { create } from 'zustand';
import {
  clearStoredSession,
  exchangeStudentHubAuthCode,
  loadStoredSession,
  saveStoredSession,
  signInWithPassword,
  verifyStoredSession,
  type AuthSession,
} from '../lib/auth';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

type AuthState = {
  status: AuthStatus;
  session: AuthSession | null;
  error: string | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthSession>;
  completeStudentHubCallback: (code: string, state: string) => Promise<AuthSession>;
  signOut: () => void;
};

function extractError(error: unknown) {
  return error instanceof Error ? error.message : 'Authentication failed';
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  session: null,
  error: null,
  async bootstrap() {
    const cachedSession = loadStoredSession();
    if (!cachedSession?.token) {
      set({ status: 'anonymous', session: null, error: null });
      return;
    }

    try {
      const verified = await verifyStoredSession(cachedSession.token);
      const session = {
        ...cachedSession,
        user: verified.user,
      } satisfies AuthSession;
      saveStoredSession(session);
      set({ status: 'authenticated', session, error: null });
    } catch {
      clearStoredSession();
      set({ status: 'anonymous', session: null, error: null });
    }
  },
  async signIn(email: string, password: string) {
    set({ status: 'loading', error: null });

    try {
      const session = await signInWithPassword(email, password);
      set({ status: 'authenticated', session, error: null });
      return session;
    } catch (error) {
      const message = extractError(error);
      set({ status: 'anonymous', session: null, error: message });
      throw error;
    }
  },
  async completeStudentHubCallback(code: string, state: string) {
    set({ status: 'loading', error: null });

    try {
      const session = await exchangeStudentHubAuthCode(code, state);
      set({ status: 'authenticated', session, error: null });
      return session;
    } catch (error) {
      const message = extractError(error);
      set({ status: 'anonymous', session: null, error: message });
      throw error;
    }
  },
  signOut() {
    clearStoredSession();
    set({ status: 'anonymous', session: null, error: null });
  },
}));
