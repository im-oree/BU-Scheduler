import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, ChevronRight, Grid2x2, Link2 } from 'lucide-react';
import { Badge, Button, Card } from '../../components/ui';
import { PageFrame, StatGrid } from '../../components/shared';
import { fetchGroups, fetchHealth } from '../../lib/api';
import {
  announcementsByGroup,
  groups,
  quickActions,
  stats,
} from '../../data/mockData';

export function HomePage() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => fetchHealth(signal),
    staleTime: 30_000,
  });
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: ({ signal }) => fetchGroups(signal),
    staleTime: 30_000,
  });

  const activeGroups =
    groupsQuery.data && groupsQuery.data.length > 0
      ? groupsQuery.data
      : groups;

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
            <h2>Problem Solving Tutorial</h2>
            <p className="muted">
              Today 10:00 AM - 11:00 AM · Room 2 · CS 100 Level - Group B
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
            <Badge tone="success">On track</Badge>
            <span>
              {healthQuery.data?.service ?? 'API'}{' '}
              {healthQuery.data?.ok ? 'online' : 'offline'}
            </span>
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
              <p className="eyebrow eyebrow--subtle">Announcements</p>
              <h2>Recent course-rep updates</h2>
            </div>
          </div>
          <div className="announcement-list">
            {announcementsByGroup.grp_100.map((item) => (
              <article key={item.id} className="announcement-list__item">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
                <span className="muted">{item.date}</span>
              </article>
            ))}
          </div>
        </Card>
      </section>
    </PageFrame>
  );
}