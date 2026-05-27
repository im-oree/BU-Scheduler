import { create } from 'zustand';
import {
  clearStoredSession,
  exchangeOAuthCallback,
  loadStoredSession,
  logoutStudentHubSession,
  saveStoredSession,
  verifyStoredSession,
  type AuthSession,
} from '../lib/auth';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

type AuthState = {
  status: AuthStatus;
  session: AuthSession | null;
  error: string | null;
  bootstrap: () => Promise<void>;
  completeStudentHubCallback: (code: string, state: string) => Promise<AuthSession>;
  signOut: () => Promise<void>;
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
        authorizedApps: verified.authorizedApps ?? cachedSession.authorizedApps,
      } satisfies AuthSession;
      saveStoredSession(session);
      set({ status: 'authenticated', session, error: null });
    } catch {
      clearStoredSession();
      set({ status: 'anonymous', session: null, error: null });
    }
  },
  async completeStudentHubCallback(code: string, state: string) {
    set({ status: 'loading', error: null });

    try {
      const session = await exchangeOAuthCallback(code, state);
      set({ status: 'authenticated', session, error: null });
      return session;
    } catch (error) {
      const message = extractError(error);
      set({ status: 'anonymous', session: null, error: message });
      throw error;
    }
  },
  async signOut() {
    const cachedSession = loadStoredSession();
    if (cachedSession?.token) {
      await logoutStudentHubSession(cachedSession.token);
    }

    clearStoredSession();
    set({ status: 'anonymous', session: null, error: null });
  },
}));
