# Project context

- The primary frontend is `frontend/`: React + Vite + TypeScript, Tailwind CSS and shadcn/ui.
- Unless the user explicitly names another target, every frontend/UI/UX change refers to `frontend/`.
- `nextjs-frontend/` is a temporary backup. Keep it intact; do not develop against it, synchronize changes into it, or delete it unless the user explicitly requests that action. Its eventual removal is planned, not authorized now.
- The backend is `backend/` (NestJS + Prisma + PostgreSQL).
- Read `docs/frontend-context.md` and `frontend/README.md` for current frontend architecture and commands. `docs/nextjs-frontend-context.md` is a historical review of the backup, not the active frontend specification.
- Local frontend endpoints: `VITE_API_URL=http://localhost:3333` and `VITE_SOCKET_URL=http://localhost:3333/chat` in `frontend/.env.local`.
- Preserve protected routes under `/dashboard` and their API-backed session validation when modifying navigation or authentication.

## Backend API documentation

- For every new or changed HTTP endpoint or Socket.IO event, including service changes that affect the public contract, update the documentation in the same change. Follow [the backend documentation guide](docs/backend-api-documentation.md).

## Linux deployment documentation

- Keep [the frontend deployment guide](docs/deploy-frontend.md) and [the backend deployment guide](docs/deploy-backend.md) current. When a change requires server work, update the affected guide in the same change with the required configuration, dependencies, commands, verification, and recovery steps for manual deployment and CI/CD.
