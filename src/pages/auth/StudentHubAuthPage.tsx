import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button, Card, Input } from '../../components/ui';
import {
  authorizeStudentHubPopup,
  getStudentHubAuthRequest,
  normalizeReturnTo,
} from '../../lib/auth';

export function StudentHubAuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const state = searchParams.get('state');
  const flow = searchParams.get('flow') === 'login' ? 'login' : 'signup';
  const returnTo = normalizeReturnTo(searchParams.get('returnTo'));
  const pendingRequest = state ? getStudentHubAuthRequest(state) : null;

  const [email, setEmail] = useState(
    pendingRequest?.email ?? 'student@university.edu',
  );
  const [password, setPassword] = useState('password123');
  const [displayName, setDisplayName] = useState(
    pendingRequest?.displayName ?? 'Student Hub User',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pendingRequest) {
      setEmail(pendingRequest.email);
      setDisplayName(pendingRequest.displayName);
    }
  }, [pendingRequest]);

  async function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!state || !pendingRequest) {
      setError(
        'This StudentHub sign-in session expired. Return to BU Scheduler and try again.',
      );
      setLoading(false);
      return;
    }

    try {
      const authorizeResponse = await authorizeStudentHubPopup({
        ...pendingRequest,
        email: email.trim(),
        displayName:
          displayName.trim() ||
          email.trim().split('@')[0] ||
          'Student Hub User',
      });

      window.location.assign(
        `/auth/callback?code=${encodeURIComponent(authorizeResponse.code)}&state=${encodeURIComponent(authorizeResponse.state)}`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to continue with StudentHub',
      );
      setLoading(false);
    }
  }

  if (!state) {
    return (
      <div className="auth-layout auth-layout--centered">
        <Card className="auth-card auth-card--login">
          <p className="eyebrow eyebrow--subtle">StudentHub</p>
          <h1>Invalid sign-in session</h1>
          <p className="muted">
            Return to BU Scheduler and open StudentHub sign-up again.
          </p>
          <Button variant="primary" onClick={() => navigate('/login')}>
            Back to login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-layout auth-layout--centered auth-layout--popup">
      <Card className="auth-card auth-card--login auth-card--popup">
        <p className="eyebrow eyebrow--subtle">StudentHub official auth</p>
        <h1>
          {flow === 'signup'
            ? 'Create your StudentHub account'
            : 'Sign in to StudentHub'}
        </h1>
        <p className="muted">
          Complete this step, then you will be returned to BU Scheduler already
          authenticated.
        </p>

        <form className="auth-form" onSubmit={handleContinue}>
          <Input
            label="StudentHub email or username"
            type="text"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete={
              flow === 'signup' ? 'new-password' : 'current-password'
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Display name"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Button
            variant="primary"
            size="lg"
            className="button--full-width"
            type="submit"
            disabled={loading}
            leadingIcon={<ArrowRight size={18} />}
          >
            {loading ? 'Continuing…' : 'Continue to BU Scheduler'}
          </Button>
        </form>

        <p className="form-note">
          Return to BU Scheduler after StudentHub verifies your identity.
        </p>
        {error ? <p className="form-error">{error}</p> : null}
      </Card>

      <div className="auth-popup__footer">
        <span>Callback will return to</span>
        <strong>{returnTo}</strong>
      </div>
    </div>
  );
}