import { useEffect, useState, useRef, type FormEvent } from 'react';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Card, Input } from '../../components/ui';
import { normalizeReturnTo } from '../../lib/auth';
import { initFirebase, signInWithEmail } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { BearMascot, type BearMood } from '../../components/BearMascot';
import { bearSounds } from '../../lib/bearSounds';
import {
  EmailProviderModal,
  EmailProviderBadge,
  SplitEmailInput,
} from '../../components/EmailProviderPicker';
import { DEFAULT_PROVIDER } from '../../lib/emailProviders';

const STUDENTHUB_SIGNUP_URL = 'https://studenthub-app.vercel.app/signup';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const authStatus = useAuthStore((s) => s.status);
  const authSession = useAuthStore((s) => s.session);
  const authError = useAuthStore((s) => s.error);

  const [emailUsername, setEmailUsername] = useState('');
  const [activeProvider, setActiveProvider] = useState<string>(DEFAULT_PROVIDER);
  const [showProviderModal, setShowProviderModal] = useState(false);

  const [password, setPassword] = useState('');
  const [loadingSignIn, setLoadingSignIn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSignupBanner, setShowSignupBanner] = useState(false);

  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [soundsMuted, setSoundsMuted] = useState(bearSounds.isMuted());

  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const returnTo = normalizeReturnTo(
    searchParams.get('returnTo') ?? authSession?.returnTo ?? '/home',
  );

  const isBusy = loadingSignIn;
  const displayedError = formError ?? authError ?? null;

  const fullEmail = emailUsername ? `${emailUsername}${activeProvider}` : '';

  const bearMood: BearMood = (() => {
    if (loginSuccess || authStatus === 'authenticated') return 'happy';
    if (displayedError) return 'sad';
    if (focusedField === 'password') {
      return passwordVisible ? 'peeking' : 'hiding';
    }
    if (focusedField === 'email') return 'tracking';
    return 'idle';
  })();

  const prevMoodRef = useRef<BearMood>('idle');
  useEffect(() => {
    const prev = prevMoodRef.current;
    if (prev === bearMood) return;

    if (bearMood === 'hiding') bearSounds.hide();
    else if (bearMood === 'peeking') bearSounds.peek();
    else if (bearMood === 'sad') bearSounds.sad();
    else if (bearMood === 'happy') bearSounds.happy();

    prevMoodRef.current = bearMood;
  }, [bearMood]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      setLoginSuccess(true);
      const t = setTimeout(() => {
        navigate(returnTo, { replace: true });
      }, 900);
      return () => clearTimeout(t);
    }
  }, [authStatus, navigate, returnTo]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
      window.open(STUDENTHUB_SIGNUP_URL, '_blank');
      setShowSignupBanner(true);
      return;
    }

    popupRef.current = popup;

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

  async function handleEmailSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const trimmedEmail = fullEmail.trim();

    if (!emailUsername.trim() || !password) {
      setFormError('Please enter both your email and password.');
      return;
    }

    setLoadingSignIn(true);

    try {
      initFirebase();
      await signInWithEmail(trimmedEmail, password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Sign in failed.');
    } finally {
      setLoadingSignIn(false);
    }
  }

  function toggleMute() {
    const muted = bearSounds.toggleMute();
    setSoundsMuted(muted);
  }

  if (authStatus === 'loading') {
    return <LoadingScreen message="Checking your session…" />;
  }

  return (
    <div className="auth-layout auth-layout--centered auth-layout--login">
      <Card className="auth-card auth-card--login auth-card--elevated">
        {/* ── 🐻 Bear mascot ────────────────────────── */}
        <div style={{ position: 'relative' }}>
          <BearMascot
            mood={bearMood}
            emailProgress={Math.min(emailUsername.length / 20, 1)}
          />

          <button
            type="button"
            onClick={toggleMute}
            aria-label={soundsMuted ? 'Unmute bear' : 'Mute bear'}
            title={soundsMuted ? 'Unmute bear' : 'Mute bear'}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6B7280',
              fontSize: 14,
              padding: 6,
              opacity: 0.6,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
          >
            {soundsMuted ? '🔇' : '🔊'}
          </button>
        </div>

        {/* ── Brand header ──────────────────────────── */}
        <div className="auth-card__brand">
          <div>
            <h1>Welcome back</h1>
          </div>
        </div>

        <p className="muted auth-card__intro">
          Sign in with your StudentHub account.
        </p>

        {/* ── Signup banner ────────────────────────── */}
        <AnimatePresence>
          {showSignupBanner && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', marginBottom: 16 }}
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
                  <span style={{ fontSize: 12, color: '#B3B6C6', lineHeight: 1.5 }}>
                    If you just finished signing up on StudentHub, enter your new email
                    and password below to sign in.
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
        <form
          onSubmit={handleEmailSignIn}
          className="auth-form"
          style={{ display: 'grid', gap: 16 }}
        >
          {/* Provider badge - OUTSIDE any label */}
          <EmailProviderBadge
            activeValue={activeProvider}
            onClick={() => setShowProviderModal(true)}
          />

          {/* Email field - using plain div, NOT auth-field */}
          <div style={{ display: 'grid', gap: 8 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#B3B6C6',
                paddingLeft: 2,
              }}
            >
              Email
            </span>
            <SplitEmailInput
              username={emailUsername}
              onUsernameChange={setEmailUsername}
              activeValue={activeProvider}
              onOpenProviderModal={() => setShowProviderModal(true)}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              disabled={isBusy}
            />
            {emailUsername && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  fontSize: 11,
                  color: '#6B7280',
                  paddingLeft: 4,
                }}
              >
                Signing in as{' '}
                <strong style={{ color: '#B3B6C6' }}>{fullEmail}</strong>
              </motion.span>
            )}
          </div>

          {/* Password field - use Input directly without auth-field wrapper */}
          <div style={{ display: 'grid', gap: 8 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#B3B6C6',
                paddingLeft: 2,
              }}
            >
              Password
            </span>
            <Input
              label="Password"
              hideLabel
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              onShowPasswordChange={setPasswordVisible}
              disabled={isBusy}
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="button--full-width"
            disabled={isBusy}
            style={{ marginTop: 8 }}
          >
            {loadingSignIn ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <AnimatePresence>
          {displayedError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="form-error" role="alert" style={{ marginTop: 12 }}>
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
          <div style={{ flex: 1, height: 1, backgroundColor: '#23263D' }} />
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
          <div style={{ flex: 1, height: 1, backgroundColor: '#23263D' }} />
        </div>

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

      <EmailProviderModal
        isOpen={showProviderModal}
        onClose={() => setShowProviderModal(false)}
        activeValue={activeProvider}
        onSelect={(value) => setActiveProvider(value)}
      />
    </div>
  );
}

export default LoginPage;