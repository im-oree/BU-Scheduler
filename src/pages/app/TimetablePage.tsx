import { useQuery } from '@tanstack/react-query';
import { CalendarRange } from 'lucide-react';
import { Badge, Button, Card, Tabs } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { formatDateTime } from '../../lib/format';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchUserTimetableEntries } from '../../lib/studenthubData';
import { useAppStore } from '../../store/useAppStore';

export function TimetablePage() {
  const scheduleView = useAppStore((state) => state.scheduleView);
  const setScheduleView = useAppStore((state) => state.setScheduleView);
  const userId = useAuthStore((state) => state.session?.user.uid);

  const timetableQuery = useQuery({
    queryKey: ['timetable', userId],
    queryFn: async () => (userId ? fetchUserTimetableEntries(userId) : []),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const scheduleEvents = timetableQuery.data ?? [];

  return (
    <PageFrame
      eyebrow="Timetable"
      title="Merged schedule"
      description="Switch between week, day, list, and calendar views for the current academic week."
      action={
        <Button
          variant="primary"
          leadingIcon={<CalendarRange size={18} />}
        >
          Today
        </Button>
      }
    >
      <Tabs
        tabs={[
          { id: 'week', label: 'Week' },
          { id: 'day', label: 'Day' },
          { id: 'list', label: 'List' },
          { id: 'calendar', label: 'Calendar' },
        ]}
        activeId={scheduleView}
        onChange={(value) =>
          setScheduleView(value as typeof scheduleView)
        }
      />
      <div className="schedule-board">
        {scheduleView === 'list' ? (
          <div className="timeline-list">
            {scheduleEvents.map((event) => (
              <Card key={event.id} className="timeline-card">
                <div className="timeline-card__left">
                  <Badge tone="info">{event.courseCode}</Badge>
                  <h3>{event.courseName}</h3>
                  <p>{event.groupName || event.day}</p>
                </div>
                <div className="timeline-card__right">
                  <span>{formatDateTime(event.startTime)}</span>
                  <span>{event.venue}</span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="calendar-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
              (day) => (
                <Card key={day} className="calendar-grid__day">
                  <strong>{day}</strong>
                  <span>8 AM - 6 PM</span>
                  <Badge tone="info">{scheduleEvents.length} events</Badge>
                </Card>
              ),
            )}
          </div>
        )}
      </div>
    </PageFrame>
  );
}