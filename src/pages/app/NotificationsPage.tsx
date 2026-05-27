import { useQuery } from '@tanstack/react-query';
import { Bell, Info, XCircle } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { PageFrame, CheckMark, AlertMark } from '../../components/shared';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchNotifications } from '../../lib/studenthubData';

export function NotificationsPage() {
  const userId = useAuthStore((state) => state.session?.user.uid);
  const notificationsQuery = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => (userId ? fetchNotifications(userId) : []),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  return (
    <PageFrame
      eyebrow="Activity"
      title="Notifications and updates"
      description="Recent state changes, reminders, and group activity in a dismissible feed."
      action={
        <Button
          variant="secondary"
          leadingIcon={<Bell size={18} />}
        >
          Mark all read
        </Button>
      }
    >
      <div className="notification-list">
        {(notificationsQuery.data ?? []).map((notification) => (
          <Card
            key={notification.id}
            className="notification-list__item"
          >
            <div className="notification-list__icon">
              {notification.tone === 'success' ? (
                <CheckMark />
              ) : notification.tone === 'warning' ? (
                <AlertMark />
              ) : notification.tone === 'danger' ? (
                <XCircle size={20} />
              ) : (
                <Info size={20} />
              )}
            </div>
            <div>
              <strong>{notification.title}</strong>
              <p>{notification.detail}</p>
              <span className="muted">{notification.time}</span>
            </div>
          </Card>
        ))}
      </div>
    </PageFrame>
  );
}