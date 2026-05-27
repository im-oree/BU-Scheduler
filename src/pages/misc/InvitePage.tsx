import { ArrowRight, Copy, Lock } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { invitePreview } from '../../data/mockData';

export function InvitePage() {
  return (
    <div className="auth-layout auth-layout--centered">
      <Card className="auth-card auth-card--login">
        <p className="eyebrow eyebrow--subtle">Invite flow</p>
        <h1>{invitePreview.title}</h1>
        <p className="muted">{invitePreview.subtitle}</p>
        <div className="invite-card__details">
          <Lock size={18} />
          <span>{invitePreview.note}</span>
        </div>
        <div className="stack stack--large">
          <Button
            variant="primary"
            size="lg"
            leadingIcon={<ArrowRight size={18} />}
          >
            Sign in to accept
          </Button>
          <Button
            variant="secondary"
            size="lg"
            leadingIcon={<Copy size={18} />}
          >
            Copy invite code
          </Button>
        </div>
      </Card>
    </div>
  );
}