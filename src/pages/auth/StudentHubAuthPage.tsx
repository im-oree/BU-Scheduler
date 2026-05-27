import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card } from '../../components/ui';
import {
  buildStudentHubAuthorizeUrl,
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

  useEffect(() => {
    if (!pendingRequest) {
      return;
    }
    window.location.replace(buildStudentHubAuthorizeUrl(pendingRequest));
  }, [pendingRequest]);

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
        <h1>{flow === 'signup' ? 'Create your StudentHub account' : 'Sign in to StudentHub'}</h1>
        <p className="muted">Redirecting you to the hosted StudentHub login now.</p>
        <div className="spinner" aria-hidden="true" />
        <p className="form-note">If redirect does not start automatically, go back and try again.</p>
      </Card>

      <div className="auth-popup__footer">
        <span>Callback will return to</span>
        <strong>{returnTo}</strong>
      </div>
    </div>
  );
}