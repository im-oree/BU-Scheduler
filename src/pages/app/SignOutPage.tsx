import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { LoadingScreen } from '../../components/LoadingScreen';

export function SignOutPage() {
  const signOut = useAuthStore((s) => s.signOut);
  const [busy, setBusy] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        await signOut();
      } catch (err) {
        // ignore errors during sign-out
        // eslint-disable-next-line no-console
        console.error('[SignOutPage] signOut error', err);
      } finally {
        setBusy(false);
        navigate('/login', { replace: true });
      }
    })();
  }, [signOut, navigate]);

  return <LoadingScreen message={busy ? 'Signing out…' : 'Redirecting…'} />;
}
