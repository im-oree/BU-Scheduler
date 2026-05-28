import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Lock } from 'lucide-react';
import { Button, Card, Input, Select } from '../../components/ui';
import { PageFrame } from '../../components/shared';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchCurrentUserProfile } from '../../lib/studenthubData';
import { getFirebaseApp } from '../../lib/firebase';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export function GroupCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = useAuthStore((s) => s.session?.user.uid);

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => (userId ? fetchCurrentUserProfile(userId) : null),
    enabled: Boolean(userId),
  });

  const requestedLevel = searchParams.get('level') ?? '';

  const [courseCode, setCourseCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [studyLevel, setStudyLevel] = useState(requestedLevel || '');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine whether the level selector should be locked to the user's level
  const isLevelRep = Boolean((profileQuery.data?.levelCourseReps ?? []).length);
  const prefilledLevel = profileQuery.data?.studyLevel || profileQuery.data?.level || '';

  useEffect(() => {
    if (isLevelRep && prefilledLevel) setStudyLevel(prefilledLevel);
  }, [isLevelRep, prefilledLevel]);

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!courseCode || !groupName || !studyLevel) {
      setError('Please fill course code, group name, and level');
      return;
    }

    setCreating(true);
    try {
      const app = getFirebaseApp();
      const db = getFirestore(app);

      const data = {
        courseCode: courseCode.trim(),
        groupName: groupName.trim(),
        studyLevel: studyLevel.trim(),
        members: [],
        memberCount: 0,
        createdAt: serverTimestamp(),
        createdBy: userId ?? null,
      } as Record<string, unknown>;

      const ref = await addDoc(collection(db, 'courseGroups'), data);
      navigate(`/groups/${ref.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  }

  return (
    <PageFrame
      eyebrow="Create group"
      title="New course group"
      description="Create a new course group. Level may be prefilled and locked for level course reps."
      action={
        <Button variant="primary" leadingIcon={<Plus size={18} />} onClick={handleCreate} disabled={creating}>
          Create
        </Button>
      }
    >
      <form onSubmit={handleCreate}>
        <Card>
          <div className="form-grid">
            <Input label="Course code" placeholder="CS100" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} required />
            <Input label="Group name" placeholder="CS100 - Group A" value={groupName} onChange={(e) => setGroupName(e.target.value)} required />

            <div>
              <label className="label">Level</label>
              {isLevelRep ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input" value={studyLevel} readOnly />
                  <span title="Your level is locked because you are a level course rep"><Lock /></span>
                </div>
              ) : (
                <Select label="Level" value={studyLevel} onChange={(e) => setStudyLevel(e.target.value)}>
                  <option value="">Select level</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="300">300</option>
                  <option value="400">400</option>
                </Select>
              )}
            </div>

          </div>
          {error && <p className="muted" style={{ color: 'var(--danger)' }}>{error}</p>}
        </Card>
      </form>
    </PageFrame>
  );
}

export default GroupCreatePage;
