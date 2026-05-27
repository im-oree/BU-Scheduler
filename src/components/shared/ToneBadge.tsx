import { Badge } from '../ui';

interface ToneBadgeProps {
  tone: 'success' | 'warning' | 'danger' | 'info';
}

export function ToneBadge({ tone }: ToneBadgeProps) {
  const label =
    tone === 'success'
      ? 'Green'
      : tone === 'warning'
        ? 'Amber'
        : tone === 'danger'
          ? 'Red'
          : 'Blue';
  return <Badge tone={tone}>{label}</Badge>;
}