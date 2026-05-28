import { useEffect, useState, useRef, type FormEvent } from 'react';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Card, Input } from '../../components/ui';
import { normalizeReturnTo } from '../../lib/auth';
import { initFirebase, signInWithEmail } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';

const STUDENTHUB_SIGNUP_URL = 'https://studenthub-app.vercel.app/signup';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const authStatus = useAuthStore((s) => s.status);
  const authSession = useAuthStore((s) => s.session);
  const authError = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingSignIn, setLoadingSignIn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSignupBanner, setShowSignupBanner] = useState(false);

  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const returnTo = normalizeReturnTo(
    searchParams.get('returnTo') ?? authSession?.returnTo ?? '/home',
  );

  const isBusy = loadingSignIn;
  const displayedError = formError ?? authError ?? null;

  // Redirect if already authenticated
  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate(returnTo, { replace: true });
    }
  }, [authStatus, navigate, returnTo]);

  // Cleanup popup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Open StudentHub signup in a popup
  function openSignupPopup() {
    const w = 480;
    const h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;

    const popup = window.open(
      STUDENTHUB_SIGNUP_URL,
      'studenthub_signup',
      `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`,
    );

    if (!popup) {
      // Popup blocked — open in new tab instead
      window.open(STUDENTHUB_SIGNUP_URL, '_blank');
      setShowSignupBanner(true);
      return;
    }

    popupRef.current = popup;

    // Poll to detect when popup closes
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (!popupRef.current || popupRef.current.closed) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        popupRef.current = null;
        setShowSignupBanner(true);
      }
    }, 500);
  }

  // Handle sign in
  async function handleEmailSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setFormError('Please enter both your email and password.');
      return;
    }

    setLoadingSignIn(true);

    try {
      initFirebase();
      await signInWithEmail(trimmedEmail, password);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Sign in failed.',
      );
    } finally {
      setLoadingSignIn(false);
    }
  }

  // Loading state
  if (authStatus === 'loading') {
    return <LoadingScreen message="Checking your session…" />;
  }

  return (
    <div className="auth-layout auth-layout--centered auth-layout--login">
      <Card className="auth-card auth-card--login auth-card--elevated">

        {/* ── Brand header ──────────────────────────── */}
        <div className="auth-card__brand">
          <div className="brand-link__mark brand-link__mark--small">B</div>
          <div>
            <p className="eyebrow eyebrow--subtle">BU Scheduler</p>
            <h1>Welcome back</h1>
          </div>
        </div>

        <p className="muted auth-card__intro">
          Sign in with your StudentHub account to access your schedules and
          groups.
        </p>

        {/* ── Signup complete banner ────────────────── */}
        <AnimatePresence>
          {showSignupBanner && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                overflow: 'hidden',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 12,
                  backgroundColor: 'rgba(46, 204, 113, 0.1)',
                  border: '1px solid rgba(46, 204, 113, 0.2)',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: 'rgba(46, 204, 113, 0.15)',
                    flexShrink: 0,
                    marginTop: 2,
                    color: '#2ECC71',
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  ✓
                </span>

                <div style={{ flex: 1 }}>
                  <strong
                    style={{
                      display: 'block',
                      fontSize: 13,
                      color: '#2ECC71',
                      marginBottom: 2,
                    }}
                  >
                    Account created?
                  </strong>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#B3B6C6',
                      lineHeight: 1.5,
                    }}
                  >
                    If you just finished signing up on StudentHub, enter your
                    new email and password below to sign in.
                  </span>
                </div>

                <button
                  onClick={() => setShowSignupBanner(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6B7280',
                    fontSize: 16,
                    padding: 4,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Sign in form ──────────────────────────── */}
        <form onSubmit={handleEmailSignIn} className="auth-form">
          <label className="auth-field">
            <span className="auth-field__label">Email</span>
            <Input
              label="Email"
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
              label="Password"
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
            variant="primary"
            className="button--full-width"
            disabled={isBusy}
          >
            {loadingSignIn ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        {/* ── Error message ─────────────────────────── */}
        <AnimatePresence>
          {displayedError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="form-error" role="alert">
                {displayedError}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Divider ───────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '24px 0',
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              backgroundColor: '#23263D',
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#6B7280',
            }}
          >
            No account?
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              backgroundColor: '#23263D',
            }}
          />
        </div>

        {/* ── Create account button ─────────────────── */}
        <button
          type="button"
          onClick={openSignupPopup}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '14px 20px',
            borderRadius: 12,
            border: '1px solid #23263D',
            backgroundColor: '#1C1F35',
            color: '#B3B6C6',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#232640';
            e.currentTarget.style.borderColor = '#2ECC71';
            e.currentTarget.style.color = '#2ECC71';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#1C1F35';
            e.currentTarget.style.borderColor = '#23263D';
            e.currentTarget.style.color = '#B3B6C6';
          }}
        >
          {/* User plus icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>

          <span>Create a StudentHub Account</span>

          {/* External link icon */}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.5 }}
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>

        <p
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: '#6B7280',
            marginTop: 12,
            lineHeight: 1.6,
          }}
        >
          Opens StudentHub signup. Come back here to sign in once done.
        </p>
      </Card>
    </div>
  );
}

export default LoginPage;