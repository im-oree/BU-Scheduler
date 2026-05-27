import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, UserPlus } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  Modal,
  Select,
  Tabs,
} from '../../components/ui';
import { PageFrame, GroupCardView } from '../../components/shared';
import { groups } from '../../data/mockData';

export function GroupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [joinModalOpen, setJoinModalOpen] = useState(
    searchParams.get('mode') === 'join',
  );
  const [filter, setFilter] = useState<'joined' | 'all' | 'created'>(
    'joined',
  );
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return groups.filter((group) => {
      if (!query) return true;
      return (
        group.title.toLowerCase().includes(query) ||
        group.courseCode.toLowerCase().includes(query)
      );
    });
  }, [searchTerm]);

  return (
    <PageFrame
      eyebrow="Groups"
      title="Your groups and course cohorts"
      description="Search by course code or group name, then jump straight to group detail, members, or schedule."
      action={
        <div className="toolbar-actions">
          <Button
            variant="secondary"
            leadingIcon={<UserPlus size={18} />}
            onClick={() => setJoinModalOpen(true)}
          >
            Join group
          </Button>
          <Button variant="primary" leadingIcon={<Plus size={18} />}>
            Create group
          </Button>
        </div>
      }
    >
      <Card>
        <div className="search-bar">
          <Input
            label="Search"
            placeholder="Search by course code or group name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select
            label="Filter"
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as 'joined' | 'all' | 'created')
            }
          >
            <option value="joined">Joined</option>
            <option value="all">All</option>
            <option value="created">My created groups</option>
          </Select>
        </div>
        <Tabs
          tabs={[
            { id: 'joined', label: 'Joined' },
            { id: 'all', label: 'All' },
            { id: 'created', label: 'My created groups' },
          ]}
          activeId={filter}
          onChange={(value) => setFilter(value as typeof filter)}
        />
      </Card>

      <div className="group-grid group-grid--dense">
        {filteredGroups.map((group) => (
          <GroupCardView key={group.id} group={group} />
        ))}
      </div>

      <Modal
        open={joinModalOpen}
        title="Join a group"
        description="Enter an invite code or paste a link to join a group quickly."
        onClose={() => {
          setJoinModalOpen(false);
          setSearchParams({});
        }}
        footer={
          <div className="modal-actions">
            <Button
              variant="ghost"
              onClick={() => setJoinModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary">Join group</Button>
          </div>
        }
      >
        <Input label="Invite code or link" placeholder="CS100-B" />
      </Modal>
    </PageFrame>
  );
}