import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { LoadingScreen } from '../../components/LoadingScreen';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <LoadingScreen message="Redirecting to login…" auth>
      <Button variant="secondary" size="md" onClick={() => navigate('/login')}>
        Back to login
      </Button>
    </LoadingScreen>
  );
}