# BU Scheduler

Frontend: root of the repository. Backend: `/backend`.

## Local development

1. Install dependencies in the frontend root.
2. Install dependencies in `/backend`.
3. Run the backend on port `4000`.
4. Run the frontend on port `5173`.

## Environment variables

Frontend:

- `VITE_API_BASE_URL` - Render API base URL, usually `https://your-service.onrender.com/api`

Backend:

- `PORT` - defaults to `4000`
- `CORS_ORIGIN` - your Vercel URL or a comma-separated list of allowed origins
- `APP_NAME` - optional service label

## Deployment

- Vercel hosts the frontend using the root `package.json` and `vercel.json`.
- Render hosts the backend using `/backend/package.json` and `render.yaml`.

## Notes

The backend currently ships with a deployable scaffold, sample routes, and in-memory demo data so the frontend can boot cleanly before the StudentHub integration is connected.

## Frontend shell

The production UI now boots from [src/RootApp.tsx](src/RootApp.tsx), which wires a routed shell with shared navigation, query setup, and lazy-loaded pages.

Shared UI primitives live in [src/components/ui.tsx](src/components/ui.tsx), the dark theme lives in [src/app.css](src/app.css), and the route catalog is in [src/pages/pages.tsx](src/pages/pages.tsx).

Key routes covered by the scaffold include `/`, `/auth/login`, `/home`, `/groups`, `/timetable`, `/profile`, `/notifications`, and the group detail, chat, member, import, and event editor flows.

For the multi-app StudentHub auth and shared-data contract, see [docs/multi-app-auth.md](docs/multi-app-auth.md).
