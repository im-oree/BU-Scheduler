import { create } from 'zustand';
import {
  clearStoredSession,
  type AuthSession,
} from '../lib/auth';
import {
  getFirebaseAuth,
  onFirebaseAuthStateChanged,
  signOutFirebase,
} from '../lib/firebase';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

type AuthState = {
  status: AuthStatus;
  session: AuthSession | null;
  error: string | null;
  bootstrap: () => Promise<void>;
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
    let auth;
    try {
      auth = getFirebaseAuth();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // If Firebase failed to initialize (missing env/config), fall back to
      // anonymous state so the app doesn't stay stuck in `loading`.
      // eslint-disable-next-line no-console
      console.error('[useAuthStore] bootstrap - firebase init failed:', message);
      set({ status: 'anonymous', session: null, error: message });
      return;
    }

    onFirebaseAuthStateChanged(auth, async (user) => {
      if (!user) {
        clearStoredSession();
        set({ status: 'anonymous', session: null, error: null });
        return;
      }

      try {
        const idToken = await user.getIdToken();
        const session: AuthSession = {
          token: idToken,
          idToken,
          user: {
            uid: user.uid,
            email: user.email ?? '',
            displayName: user.displayName ?? user.email ?? 'StudentHub user',
            photoURL: user.photoURL ?? undefined,
          },
          provider: 'studenthub',
          returnTo: '/home',
          scopes: ['openid', 'profile', 'email'],
        };

        window.localStorage.setItem('bu-scheduler.session', JSON.stringify(session));
        set({ status: 'authenticated', session, error: null });
      } catch (error) {
        const message = extractError(error);
        clearStoredSession();
        set({ status: 'anonymous', session: null, error: message });
      }
    });
  },
  async signOut() {
    await signOutFirebase();
    clearStoredSession();
    set({ status: 'anonymous', session: null, error: null });
  },
}));
