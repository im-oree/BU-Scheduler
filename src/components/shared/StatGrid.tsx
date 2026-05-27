import { Card } from '../ui';

interface StatGridProps {
  items: Array<{ label: string; value: string }>;
}

export function StatGrid({ items }: StatGridProps) {
  return (
    <div className="stat-grid">
      {items.map((item) => (
        <Card key={item.label} className="stat-card">
          <span className="stat-card__label">{item.label}</span>
          <strong className="stat-card__value">{item.value}</strong>
        </Card>
      ))}
    </div>
  );
}