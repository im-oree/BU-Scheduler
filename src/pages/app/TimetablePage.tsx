import { CalendarRange } from 'lucide-react';
import { Badge, Button, Card, Tabs } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { formatDateTime } from '../../lib/format';
import { scheduleEvents } from '../../data/mockData';
import { useAppStore } from '../../store/useAppStore';

export function TimetablePage() {
  const scheduleView = useAppStore((state) => state.scheduleView);
  const setScheduleView = useAppStore((state) => state.setScheduleView);

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
                  <Badge
                    tone={
                      event.accent === 'green'
                        ? 'success'
                        : event.accent === 'amber'
                          ? 'warning'
                          : 'info'
                    }
                  >
                    {event.subjectCode}
                  </Badge>
                  <h3>{event.title}</h3>
                  <p>{event.groupName}</p>
                </div>
                <div className="timeline-card__right">
                  <span>{formatDateTime(event.startAt)}</span>
                  <span>{event.location}</span>
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
                  <Badge tone="info">2 events</Badge>
                </Card>
              ),
            )}
          </div>
        )}
      </div>
    </PageFrame>
  );
}