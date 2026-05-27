import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, ChevronRight, Grid2x2, Link2 } from 'lucide-react';
import { Badge, Button, Card } from '../../components/ui';
import { PageFrame, StatGrid } from '../../components/shared';
import { quickActions } from '../../data/mockData';
import { formatDateTime } from '../../lib/format';
import { useAuthStore } from '../../store/useAuthStore';
import {
  fetchNotifications,
  fetchUserGroups,
  fetchUserTimetableEntries,
} from '../../lib/studenthubData';

function formatNextClassLabel(startTime?: string) {
  if (!startTime) return 'No upcoming class';
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return startTime;
  return date.toLocaleString([], {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function HomePage() {
  const userId = useAuthStore((state) => state.session?.user.uid);

  const groupsQuery = useQuery({
    queryKey: ['home-groups', userId],
    queryFn: async () => (userId ? fetchUserGroups(userId) : []),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
  const timetableQuery = useQuery({
    queryKey: ['home-timetable', userId],
    queryFn: async () => (userId ? fetchUserTimetableEntries(userId) : []),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
  const notificationsQuery = useQuery({
    queryKey: ['home-notifications', userId],
    queryFn: async () => (userId ? fetchNotifications(userId) : []),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  const activeGroups = groupsQuery.data ?? [];
  const nextClass = timetableQuery.data?.[0];
  const stats = [
    { label: 'Up next', value: formatNextClassLabel(nextClass?.startTime) },
    { label: 'Groups', value: `${activeGroups.length} active` },
    { label: 'Unread messages', value: `${notificationsQuery.data?.length ?? 0}` },
    { label: 'Reminders queued', value: `${timetableQuery.data?.length ?? 0}` },
  ];

  return (
    <PageFrame
      eyebrow="Dashboard"
      title="Your next class and active groups"
      description="A compact overview that surfaces the next action, the latest activity, and the quick entry points you need most."
      action={
        <Button
          variant="secondary"
          leadingIcon={<CalendarDays size={18} />}
        >
          Open timetable
        </Button>
      }
    >
      <div className="dashboard-grid">
        <Card className="hero-card">
          <div>
            <p className="eyebrow eyebrow--subtle">Your next class</p>
            <h2>{nextClass?.courseName ?? 'No upcoming class'}</h2>
            <p className="muted">
              {nextClass
                ? `${formatDateTime(nextClass.startTime)} · ${formatDateTime(nextClass.endTime)} · ${nextClass.venue} · ${nextClass.groupName || nextClass.courseCode}`
                : 'Firestore timetable entries will appear here once available.'}
            </p>
          </div>
          <div className="hero-card__actions">
            <Button variant="primary" leadingIcon={<Bell size={18} />}>
              Set reminder
            </Button>
            <Button variant="ghost" leadingIcon={<Link2 size={18} />}>
              Join link
            </Button>
          </div>
          <div className="hero-card__status">
            <Badge tone="success">Connected</Badge>
            <span>{activeGroups.length} live groups</span>
          </div>
        </Card>

        <div className="stack stack--compact">
          <StatGrid items={stats} />
        </div>
      </div>

      <section className="section-block">
        <div className="section-block__head">
          <div>
            <p className="eyebrow eyebrow--subtle">Recent groups</p>
            <h2>Groups you can jump into quickly</h2>
          </div>
          <Button variant="ghost" size="sm">
            View all
          </Button>
        </div>
        <div className="group-grid">
          {activeGroups.slice(0, 3).map((group) => (
            <Card key={group.id} className="group-card group-card--compact">
              <div className="group-card__top">
                <div>
                  <Badge tone="info">{group.courseCode}</Badge>
                  <h3>{group.title}</h3>
                  <p>{group.memberCount} members</p>
                </div>
                <div className="group-card__icon">
                  <Grid2x2 size={20} />
                </div>
              </div>
              <div className="group-card__footer">
                <span className="muted">{group.nextClass}</span>
                <Link to={`/groups/${group.id}`} className="inline-link">
                  Open <ChevronRight size={16} />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="section-block section-block--split">
        <Card>
          <div className="section-block__head">
            <div>
              <p className="eyebrow eyebrow--subtle">Quick actions</p>
              <h2>Most common tasks</h2>
            </div>
          </div>
          <div className="quick-action-list">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                to={action.href}
                className="quick-action-list__item"
              >
                <div>
                  <strong>{action.title}</strong>
                  <p>{action.description}</p>
                </div>
                <ChevronRight size={18} />
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div className="section-block__head">
            <div>
              <p className="eyebrow eyebrow--subtle">Notifications</p>
              <h2>Recent updates from Firestore</h2>
            </div>
          </div>
          <div className="announcement-list">
            {(notificationsQuery.data ?? []).slice(0, 3).map((item) => (
              <article key={item.id} className="announcement-list__item">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <span className="muted">{item.time}</span>
              </article>
            ))}
          </div>
        </Card>
      </section>
    </PageFrame>
  );
}