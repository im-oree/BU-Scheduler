import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button, Card, Input } from '../../components/ui';
import {
  buildStudentHubAuthorizeUrl,
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

  const returnTo = normalizeReturnTo(
    searchParams.get('returnTo') ?? authSession?.returnTo ?? '/home',
  );

  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate(returnTo, { replace: true });
    }
  }, [authStatus, navigate, returnTo]);

  async function beginStudentHubAuth(flow: 'login' | 'signup') {
    try {
      const request = await prepareStudentHubAuthRequest({
        flow,
        returnTo,
      });
      navigate(buildStudentHubAuthUrl(request), { replace: false });
    } catch (error) {
      if (error instanceof Error) {
        window.alert(error.message);
      }
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
        <p className="muted">Sign in with your real StudentHub account to load live timetable and app data.</p>
        <div className="stack stack--small">
          <Button variant="primary" size="lg" className="button--full-width" type="button" onClick={() => beginStudentHubAuth('login')} leadingIcon={<ArrowRight size={18} />}>
            Sign in with StudentHub
          </Button>
          <Button variant="secondary" size="lg" className="button--full-width" type="button" onClick={() => beginStudentHubAuth('signup')} leadingIcon={<Sparkles size={18} />}>
            Create StudentHub account
          </Button>
        </div>

        <div className="auth-card__list">
          <div>
            <strong>Real provider login</strong>
            <span>You are redirected to the hosted StudentHub OAuth flow.</span>
          </div>
          <div>
            <strong>Shared identity</strong>
            <span>The backend links your StudentHub subject to one canonical account.</span>
          </div>
        </div>

        {authError ? <p className="form-error">{authError}</p> : null}
      </Card>
    </div>
  );
}