import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Select,
  Textarea,
} from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { getGroup } from '../../data/mockData';

export function EventEditorPage() {
  const { groupId, eventId } = useParams();
  const group = getGroup(groupId);

  return (
    <PageFrame
      eyebrow="Event editor"
      title={eventId ? 'Edit event' : `Add class for ${group.title}`}
      description="Use validated fields for start and end time, recurrence, visibility, and attachments."
      action={
        <Button variant="primary" leadingIcon={<Plus size={18} />}>
          Save
        </Button>
      }
    >
      <Card>
        <div className="form-grid">
          <Input
            label="Title"
            required
            placeholder="Problem Solving Tutorial"
          />
          <Input label="Subject code" placeholder="COS102" />
          <Textarea
            label="Description"
            rows={4}
            placeholder="Optional notes for the session"
          />
          <Input label="Start date & time" type="datetime-local" required />
          <Input label="End date & time" type="datetime-local" required />
          <Select label="Timezone" defaultValue="Africa/Lagos">
            <option value="Africa/Lagos">Africa/Lagos</option>
            <option value="UTC">UTC</option>
          </Select>
          <Input label="Location" placeholder="Room 2 or virtual link" />
          <Select label="Recurrence" defaultValue="weekly">
            <option value="none">No repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom</option>
          </Select>
          <Select label="Visibility" defaultValue="group">
            <option value="group">Private (group only)</option>
            <option value="public">Public</option>
          </Select>
        </div>
        <div className="form-actions">
          <Button variant="danger">Delete</Button>
          <div className="form-actions__right">
            <Button variant="ghost">Cancel</Button>
            <Button variant="primary">Save event</Button>
          </div>
        </div>
      </Card>
    </PageFrame>
  );
}