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
- `VITE_STUDENTHUB_API` - Hosted StudentHub backend base URL, for example `https://studenthub-backend-1w1n.onrender.com`
- `VITE_OAUTH_CLIENT_ID` - StudentHub OAuth client id used by the login redirect

Backend:

- `PORT` - defaults to `4000`
- `CORS_ORIGIN` - your Vercel URL or a comma-separated list of allowed origins
- `APP_NAME` - optional service label

## Deployment

- Vercel hosts the frontend using the root `package.json` and `vercel.json`.
- Render hosts the backend using `/backend/package.json` and `render.yaml`.

## Notes

The frontend now uses the hosted StudentHub backend for OIDC login and shared data loading. The backend implements a complete **StudentHub-linked authentication system** with canonical identity mapping. This ensures a single user account even when logging in from multiple apps.

**Key auth features:**
- PKCE-based OAuth2 code exchange with StudentHub
- Canonical user identity (prevents duplicate accounts across apps)
- Token revocation and logout functionality
- Complete audit logging of all auth events
- Multi-app permission grants

See [docs/BACKEND_AUTH_SUMMARY.md](docs/BACKEND_AUTH_SUMMARY.md) for implementation overview and [docs/backend-auth-implementation.md](docs/backend-auth-implementation.md) for detailed technical documentation.

The backend ships with a deployable scaffold, sample routes, and in-memory demo data so the frontend can boot cleanly. To integrate with a live StudentHub backend, see the auth documentation for StudentHub ID linking configuration.

## Frontend shell

The production UI now boots from [src/RootApp.tsx](src/RootApp.tsx), which wires a routed shell with shared navigation, query setup, and lazy-loaded pages.

Shared UI primitives live in [src/components/ui.tsx](src/components/ui.tsx), the dark theme lives in [src/app.css](src/app.css), and the route catalog is in [src/pages/pages.tsx](src/pages/pages.tsx).

Key routes covered by the scaffold include `/`, `/auth/login`, `/home`, `/groups`, `/timetable`, `/profile`, `/notifications`, and the group detail, chat, member, import, and event editor flows.

For the multi-app StudentHub auth and shared-data contract, see [docs/multi-app-auth.md](docs/multi-app-auth.md).
