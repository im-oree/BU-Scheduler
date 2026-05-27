import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui';
import {
  clearStudentHubAuthRequest,
  normalizeReturnTo,
} from '../../lib/auth';
import { useAuthStore } from '../../store/useAuthStore';

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const completeStudentHubCallback = useAuthStore(
    (state) => state.completeStudentHubCallback,
  );

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('Completing sign-in...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      setStatus('error');
      setError('Invalid callback request. Please retry sign-in.');
      return;
    }

    const callbackCode = code;
    const callbackState = state;
    let cancelled = false;

    async function finishCallback() {
      try {
        const session = await completeStudentHubCallback(
          callbackCode,
          callbackState,
        );
        const destination = normalizeReturnTo(session.returnTo ?? '/home');

        if (cancelled) return;

        setStatus('success');
        setMessage('Sign-in complete. You can return to BU Scheduler now.');

        if (window.opener && !window.opener.closed) {
          try {
            window.opener.location.replace(destination);
            window.opener.postMessage(
              { type: 'bu-scheduler:auth-complete', destination },
              window.location.origin,
            );
          } catch {
            window.opener.postMessage(
              { type: 'bu-scheduler:auth-complete', destination },
              window.location.origin,
            );
          }
          window.setTimeout(() => window.close(), 400);
          return;
        }

        window.location.replace(destination);
      } catch (callbackError) {
        if (cancelled) return;
        setStatus('error');
        setError(
          callbackError instanceof Error
            ? callbackError.message
            : 'Unable to complete sign-in',
        );
        clearStudentHubAuthRequest(callbackState);
      }
    }

    finishCallback();
    return () => {
      cancelled = true;
    };
  }, [completeStudentHubCallback, navigate, searchParams]);

  return (
    <div
      className="loading-screen loading-screen--auth"
      aria-live="polite"
      aria-busy={status === 'loading'}
    >
      <div className="spinner" />
      <p>{status === 'error' ? error : message}</p>
      {status === 'error' ? (
        <Button
          variant="secondary"
          size="md"
          onClick={() => navigate('/login')}
        >
          Back to login
        </Button>
      ) : null}
    </div>
  );
}