import { useEffect, useMemo, useState } from 'react';

type HealthResponse = {
  ok: boolean;
  service: string;
  timestamp: string;
};

type GroupSummary = {
  id: string;
  name: string;
  courseCode: string;
  level: string;
  memberCount: number;
  nextClass: string;
};

const featureColumns = [
  {
    title: 'StudentHub SSO',
    text: 'Authenticate once, reuse the same identity, and keep BU Scheduler linked to StudentHub as the canonical source.',
  },
  {
    title: 'Timetable Engine',
    text: 'Create recurring classes, precompute upcoming instances, and warn on overlaps before events are saved.',
  },
  {
    title: 'Group Workflows',
    text: 'Manage group reps, course reps, invites, audit logs, and role-based permissions from one place.',
  },
  {
    title: 'Reminders & Sync',
    text: 'Schedule in-app, email, push, and SMS reminders with offline browsing and background reconciliation.',
  },
];

const apiBlocks = [
  'GET /api/health',
  'GET /api/spec',
  'POST /api/groups',
  'POST /api/groups/:id/events',
  'POST /api/events/bulk-import',
  'GET /api/groups/:id/messages',
];

const roadmap = [
  'Phase 1: auth linking, group CRUD, single-instance events, reminders, invites',
  'Phase 2: recurrence, bulk import/export, push notifications, role flows',
  'Phase 3: chat, offline sync, third-party calendar sync, analytics',
  'Phase 4: admin tools, dashboards, elections and delegation',
];

const defaultGroups: GroupSummary[] = [
  { id: 'grp_100', name: 'CS 100 Level - Group B', courseCode: 'COS102', level: '100', memberCount: 48, nextClass: 'Today 10:00 AM' },
  { id: 'grp_210', name: 'Software Engineering Cohort', courseCode: 'CSC214', level: '200', memberCount: 62, nextClass: 'Tomorrow 2:00 PM' },
  { id: 'grp_310', name: 'Faculty Admin Panel', courseCode: 'ENGR300', level: '300', memberCount: 18, nextClass: 'Wed 9:30 AM' },
];

export default function App() {
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_BASE_URL || '/api', []);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>(defaultGroups);
  const [status, setStatus] = useState('Connecting to backend...');

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        setStatus(`Loading from ${apiBaseUrl}...`);

        const [healthResponse, groupsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/health`, { signal: controller.signal }),
          fetch(`${apiBaseUrl}/groups`, { signal: controller.signal }),
        ]);

        if (healthResponse.ok) {
          setHealth((await healthResponse.json()) as HealthResponse);
        }

        if (groupsResponse.ok) {
          const payload = (await groupsResponse.json()) as { data?: GroupSummary[] };
          if (Array.isArray(payload.data) && payload.data.length > 0) {
            setGroups(payload.data);
          }
        }

        setStatus('Backend connected. UI is ready for StudentHub SSO.');
      } catch {
        setStatus('Backend is offline. Frontend is still usable in local preview mode.');
      }
    }

    loadDashboard();

    return () => controller.abort();
  }, [apiBaseUrl]);

  return (
    <div className="app-shell">
      <main className="page-grid">
        <section className="hero card card--hero">
          <div className="eyebrow">BU Scheduler</div>
          <h1>StudentHub-linked timetables, reminders, groups, and rep workflows.</h1>
          <p className="lead">
            A deployable starter for the BU Scheduler product spec, with the frontend at the repo root and the API service isolated in <span>/backend</span>.
          </p>

          <div className="hero-actions">
            <a className="button button--primary" href="#deployment">Configure deployment</a>
            <a className="button button--secondary" href="#api">Review API surface</a>
          </div>

          <div className="status-row">
            <div>
              <span className="label">Backend status</span>
              <strong>{status}</strong>
            </div>
            <div>
              <span className="label">Health</span>
              <strong>{health ? `${health.service} · ${health.ok ? 'ok' : 'degraded'}` : 'pending'}</strong>
            </div>
            <div>
              <span className="label">API base</span>
              <strong>{apiBaseUrl}</strong>
            </div>
          </div>
        </section>

        <aside className="card card--stack">
          <div>
            <span className="label">Live groups</span>
            <div className="stack">
              {groups.map((group) => (
                <article key={group.id} className="mini-card">
                  <div>
                    <strong>{group.name}</strong>
                    <p>{group.courseCode} · Level {group.level}</p>
                  </div>
                  <div className="mini-card__meta">
                    <span>{group.memberCount} members</span>
                    <span>{group.nextClass}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </aside>

        <section className="card">
          <div className="section-heading">
            <span className="label">Core modules</span>
            <h2>Functional areas ready for expansion</h2>
          </div>
          <div className="feature-grid">
            {featureColumns.map((item) => (
              <article key={item.title} className="feature-card">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="card" id="api">
          <div className="section-heading">
            <span className="label">API surface</span>
            <h2>Backend routes aligned to the product spec</h2>
          </div>
          <div className="api-list">
            {apiBlocks.map((route) => (
              <div key={route} className="api-row">
                <code>{route}</code>
                <span>ready for integration</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="section-heading">
            <span className="label">Roadmap</span>
            <h2>Build phases</h2>
          </div>
          <ol className="roadmap-list">
            {roadmap.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        <section className="card card--deployment" id="deployment">
          <div className="section-heading">
            <span className="label">Hosting</span>
            <h2>Vercel frontend + Render backend</h2>
          </div>
          <p>
            The root app is configured for Vercel static hosting. The API service lives under <span>/backend</span> with its own build and start commands for Render.
          </p>
          <div className="deployment-notes">
            <div>
              <strong>VITE_API_BASE_URL</strong>
              <span>Set this to the Render API URL in Vercel environment variables.</span>
            </div>
            <div>
              <strong>CORS_ORIGIN</strong>
              <span>Set this to your Vercel domain in the backend environment.</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}