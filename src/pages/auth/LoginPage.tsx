import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button, Card, Input } from '../../components/ui';
import {
  buildStudentHubAuthUrl,
  normalizeReturnTo,
  prepareStudentHubAuthRequest,
} from '../../lib/auth';
import { useAuthStore } from '../../store/useAuthStore';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const authStatus = useAuthStore((state) => state.status);
  const authSession = useAuthStore((state) => state.session);
  const authError = useAuthStore((state) => state.error);
  const signIn = useAuthStore((state) => state.signIn);

  const [email, setEmail] = useState('student@university.edu');
  const [password, setPassword] = useState('password123');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const returnTo = normalizeReturnTo(
    searchParams.get('returnTo') ?? authSession?.returnTo ?? '/home',
  );

  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate(returnTo, { replace: true });
    }
  }, [authStatus, navigate, returnTo]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    setSubmitting(true);

    try {
      await signIn(email.trim(), password);
      navigate(returnTo, { replace: true });
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Unable to sign in',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStudentHubSignup() {
    setLocalError(null);

    try {
      const request = await prepareStudentHubAuthRequest({
        flow: 'signup',
        email: email.trim() || 'student@university.edu',
        displayName: email.includes('@')
          ? email.split('@')[0]
          : 'Student Hub User',
        returnTo,
      });
      const popupUrl = buildStudentHubAuthUrl(request);
      const popup = window.open(
        popupUrl,
        'studenthub-signup',
        'width=560,height=760',
      );

      if (!popup) {
        navigate(popupUrl, { replace: false });
      }
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : 'Unable to start StudentHub sign-up',
      );
    }
  }

  if (authStatus === 'loading') {
    return (
      <div
        className="loading-screen"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="spinner" />
        <p>Checking your session…</p>
      </div>
    );
  }

  return (
    <div className="auth-layout auth-layout--centered auth-layout--login">
      <Card className="auth-card auth-card--login">
        <div className="auth-card__brand">
          <div className="brand-link__mark brand-link__mark--small">B</div>
          <div>
            <p className="eyebrow eyebrow--subtle">BU Scheduler</p>
            <h1>Sign in</h1>
          </div>
        </div>
        <p className="muted">Sign in to manage your timetable and groups.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <Input
            label="Email or username"
            type="text"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="stack stack--small">
            <Button
              variant="primary"
              size="lg"
              className="button--full-width"
              type="submit"
              disabled={submitting}
              leadingIcon={<ArrowRight size={18} />}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="button--full-width"
              type="button"
              onClick={handleStudentHubSignup}
              leadingIcon={<Sparkles size={18} />}
            >
              Create account with StudentHub
            </Button>
          </div>
        </form>

        <div className="auth-card__list">
          <div>
            <strong>Your StudentHub identity powers BU Scheduler</strong>
            <span>
              Use the same account across devices without creating a separate
              profile.
            </span>
          </div>
          <div>
            <strong>Protected session</strong>
            <span>No access tokens are placed in the URL.</span>
          </div>
        </div>

        {localError || authError ? (
          <p className="form-error">{localError ?? authError}</p>
        ) : null}
      </Card>
    </div>
  );
}