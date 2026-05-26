export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function formatRelativeLabel(value: string) {
  const date = new Date(value);
  const diffHours = Math.round((date.getTime() - Date.now()) / 3_600_000);

  if (diffHours === 0) {
    return 'now';
  }

  if (diffHours > 0 && diffHours < 24) {
    return `in ${diffHours}h`;
  }

  if (diffHours < 0 && Math.abs(diffHours) < 24) {
    return `${Math.abs(diffHours)}h ago`;
  }

  return formatDateTime(value);
}
