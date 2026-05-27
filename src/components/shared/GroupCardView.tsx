import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Badge, Card } from '../ui';
import { AvatarStack } from './AvatarStack';
import type { StudentHubGroup } from '../../lib/studenthubData';

interface GroupCardViewProps {
  group: StudentHubGroup;
}

export function GroupCardView({ group }: GroupCardViewProps) {
  return (
    <Card className="group-card">
      <div className="group-card__top">
        <div>
          <Badge
            tone={
              group.accent === 'green'
                ? 'success'
                : group.accent === 'amber'
                  ? 'warning'
                  : 'info'
            }
          >
            {group.courseCode}
          </Badge>
          <h3>{group.title}</h3>
          <p>{group.description}</p>
        </div>
        <AvatarStack />
      </div>
      <div className="group-card__meta">
        <span>{group.memberCount} members</span>
        <span>{group.nextClass}</span>
      </div>
      <div className="group-card__footer">
        <span className="muted">Updated {group.lastActivity}</span>
        <Link to={`/groups/${group.id}`} className="inline-link">
          Open group <ChevronRight size={16} />
        </Link>
      </div>
    </Card>
  );
}