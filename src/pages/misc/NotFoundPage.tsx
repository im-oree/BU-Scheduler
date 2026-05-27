import { Button, Card } from '../../components/ui';

export function NotFoundPage() {
  return (
    <div className="auth-layout auth-layout--centered">
      <Card className="auth-card auth-card--login">
        <p className="eyebrow eyebrow--subtle">404</p>
        <h1>Page not found</h1>
        <p className="muted">That route does not exist in this build.</p>
        <div className="stack stack--large">
          <Button variant="primary" size="lg">
            Go home
          </Button>
          <Button variant="ghost" size="lg">
            Browse groups
          </Button>
        </div>
      </Card>
    </div>
  );
}