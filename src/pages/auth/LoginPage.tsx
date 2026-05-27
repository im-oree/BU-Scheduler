import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Input } from '../../components/ui';
import { normalizeReturnTo } from '../../lib/auth';
import { initFirebase, signInWithEmail } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const authStatus = useAuthStore((state) => state.status);
  const authSession = useAuthStore((state) => state.session);
  const authError = useAuthStore((state) => state.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingEmailSignIn, setLoadingEmailSignIn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const returnTo = normalizeReturnTo(
    searchParams.get('returnTo') ?? authSession?.returnTo ?? '/home',
  );

  const isBusy = loadingEmailSignIn;
  const displayedError = formError ?? authError ?? null;

  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate(returnTo, { replace: true });
    }
  }, [authStatus, navigate, returnTo]);

  async function handleEmailSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setFormError('Please enter both your email and password.');
      return;
    }

    setLoadingEmailSignIn(true);

    try {
      initFirebase();

      await signInWithEmail(trimmedEmail, password);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Sign in failed.',
      );
    } finally {
      setLoadingEmailSignIn(false);
    }
  }

  if (authStatus === 'loading') {
    return (
      <div className="loading-screen" aria-live="polite" aria-busy="true">
        <div className="spinner" />
        <p>Checking your session…</p>
      </div>
    );
  }

  return (
    <div className="auth-layout auth-layout--centered auth-layout--login">
      <Card className="auth-card auth-card--login auth-card--elevated">
        <div className="auth-card__brand">
          <div className="brand-link__mark brand-link__mark--small">B</div>
          <div>
            <p className="eyebrow eyebrow--subtle">BU Scheduler</p>
            <h1>Welcome back</h1>
          </div>
        </div>

        <p className="muted auth-card__intro">
          Sign in with your StudentHub email and password. This uses Firebase
          Auth directly in the browser.
        </p>

        <form onSubmit={handleEmailSignIn} className="auth-form">
          <label className="auth-field">
            <span className="auth-field__label">Email</span>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isBusy}
              required
            />
          </label>

          <label className="auth-field">
            <span className="auth-field__label">Password</span>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isBusy}
              required
            />
          </label>

          <Button
            type="submit"
            variant="ghost"
            className="button--full-width"
            disabled={isBusy}
          >
            {loadingEmailSignIn ? 'Signing in…' : 'Sign in with email'}
          </Button>
        </form>

        {displayedError ? (
          <p className="form-error" role="alert">
            {displayedError}
          </p>
        ) : null}

        <div className="auth-card__list">
          <div>
            <strong>Firebase Auth</strong>
            <span>No backend token exchange is required for login.</span>
          </div>
          <div>
            <strong>Firestore rules</strong>
            <span>Data access should be controlled by Firestore security rules.</span>
          </div>
        </div>
      </Card>
    </div>
  );
}