import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { Button, Modal } from './ui';

export function AuthRequiredModal() {
  const open = useAppStore((s) => s.authModalOpen);
  const intent = useAppStore((s) => s.authModalIntent);
  const close = useAppStore((s) => s.closeAuthModal);
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);

  if (!open) return null;

  return (
    <Modal
      open={open}
      title="Sign in required"
      description={intent ? `You need to sign in to ${intent}.` : 'You need to sign in to continue.'}
      onClose={() => close()}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="ghost" onClick={() => close()}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              close();
              navigate('/login');
            }}
          >
            Sign in
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              close();
            }}
          >
            Continue as guest
          </Button>
        </div>
      }
    />
  );
}

export default AuthRequiredModal;
