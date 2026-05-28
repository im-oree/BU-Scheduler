import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Link2, LogIn, Users } from 'lucide-react';
import { Button, Card, EmptyState } from '../../components/ui';
import { PageFrame } from '../../components/shared';

export function InvitePage() {
  const navigate = useNavigate();
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const code = inviteCode?.trim() || 'Unknown invite';

  function handleOpenJoinFlow() {
    navigate(`/groups?mode=join&invite=${encodeURIComponent(code)}`);
  }

  return (
    <PageFrame
      eyebrow="Invite"
      title="Join your group"
      description="Use the invite code to open the group join flow and connect with your coursemates."
    >
      <div className="dashboard-grid">
        <Card>
          <EmptyState
            icon={<Users size={24} />}
            title={code}
            description="This invite can be used to join a course group in StudentHub. If you are not signed in yet, log in first and come back to continue."
            action={
              <div className="toolbar-actions">
                <Button variant="primary" leadingIcon={<Link2 size={18} />} onClick={handleOpenJoinFlow}>
                  Open join flow
                </Button>
                <Button variant="secondary" leadingIcon={<LogIn size={18} />} onClick={() => navigate('/login')}>
                  Sign in
                </Button>
              </div>
            }
          />
        </Card>

        <Card>
          <p className="eyebrow eyebrow--subtle">Next step</p>
          <h2>What happens next</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            The join modal will accept the invite code or a pasted invite link.
            After that, the app will route you into the matching group page.
          </p>
          <div style={{ marginTop: 16 }}>
            <Button variant="ghost" leadingIcon={<ArrowRight size={18} />} onClick={handleOpenJoinFlow}>
              Continue
            </Button>
          </div>
        </Card>
      </div>
    </PageFrame>
  );
}