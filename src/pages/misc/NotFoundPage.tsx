import { Link } from 'react-router-dom';
import { Button, Card } from '../../components/ui';

export function NotFoundPage() {
  return (
    <div className="auth-layout auth-layout--centered">
      <Card className="auth-card auth-card--login">
        <p className="eyebrow eyebrow--subtle">404</p>
        <h1>Page not found</h1>
        <p className="muted">That route does not exist in this build.</p>
        <div className="stack stack--large">
          <Link to="/home" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="lg" fullWidth>
              Go home
            </Button>
          </Link>
          <Link to="/groups" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" size="lg" fullWidth>
              Browse groups
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}