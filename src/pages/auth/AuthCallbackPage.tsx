import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div className="loading-screen loading-screen--auth" aria-live="polite">
      <div className="spinner" />
      <p>Redirecting to login…</p>
      <Button variant="secondary" size="md" onClick={() => navigate('/login')}>
        Back to login
      </Button>
    </div>
  );
}