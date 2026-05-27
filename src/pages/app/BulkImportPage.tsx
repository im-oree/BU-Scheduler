import { Download, Upload } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { formatDateLabel } from '../../lib/format';
import { scheduleEvents } from '../../data/mockData';

export function BulkImportPage() {
  return (
    <PageFrame
      eyebrow="Bulk import"
      title="Upload, preview, and confirm"
      description="CSV and ICS imports are split into a validation step and a confirmation step so errors are visible before the job starts."
      action={
        <Button variant="primary" leadingIcon={<Upload size={18} />}>
          Upload file
        </Button>
      }
    >
      <div className="section-block section-block--split">
        <Card className="drop-zone">
          <Upload size={28} />
          <h2>Drop CSV or ICS file here</h2>
          <p className="muted">
            title, subject_code, start, end, timezone, recurrence, location
          </p>
          <Button variant="secondary">Browse files</Button>
        </Card>

        <Card>
          <div className="section-block__head">
            <div>
              <p className="eyebrow eyebrow--subtle">Preview</p>
              <h2>Parsed rows</h2>
            </div>
          </div>
          <div className="preview-table">
            {scheduleEvents.map((event) => (
              <div key={event.id} className="preview-table__row">
                <strong>{event.title}</strong>
                <span>{formatDateLabel(event.startAt)}</span>
                <span>{event.location}</span>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <Button
              variant="ghost"
              leadingIcon={<Download size={18} />}
            >
              Download errors
            </Button>
            <div className="form-actions__right">
              <Button variant="ghost">Back</Button>
              <Button variant="primary">Confirm import</Button>
            </div>
          </div>
        </Card>
      </div>
    </PageFrame>
  );
}