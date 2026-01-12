# Repository Guidelines

## Project Structure & Module Organization
This is an npm workspaces monorepo. Key locations:
- `frontend/`: Vite + React UI (components in `frontend/src/components`, API client in `frontend/src/api`).
- `backend/`: Express API server (controllers in `backend/src/controllers`, services in `backend/src/services`, Prisma in `backend/prisma`).
- `shared/`: shared TypeScript types in `shared/src/types`.
- `backend/generated/`: generated `.scad`, `.stl`, `.3mf` outputs (ignored by git).

## Build, Test, and Development Commands
Run commands from the repo root unless noted.
- `npm run dev`: start frontend and backend concurrently.
- `npm run dev:frontend`: run Vite dev server only.
- `npm run dev:backend`: run the Express server with `tsx` + `nodemon`.
- `npm run build`: build all workspaces.
- `npm run type-check`: TypeScript checks across workspaces.
- `npm run db:up|db:down|db:reset`: manage the local Postgres container.
- `npm run db:generate|db:push|db:migrate`: Prisma client and schema changes.
- `cd backend && npm run db:studio`: open Prisma Studio.

## Coding Style & Naming Conventions
- Indentation: 2 spaces (TypeScript/TSX files follow this).
- Naming: `camelCase` for variables/functions, `PascalCase` for React components, `kebab-case` for folders when needed, and `*.tsx` for React components.
- Keep services/controllers small and focused; add shared types to `shared/src/types` when they cross frontend/backend.
- No configured formatter or linter; keep diffs tidy and consistent with existing files.
- Follow SOLID Principles, creating abstractions as needed, ensuring single responsibility and extendibility.

## Testing Guidelines
No automated test framework is currently configured. If you add tests, document the runner and add a root-level script. For now, verify changes by running `npm run type-check` and exercising the UI/API flow locally.

## Commit & Pull Request Guidelines
Recent commits use short, lowercase, imperative-style subjects (e.g., “fix error in browser”). Follow that pattern.
PRs should include:
- A concise summary of changes and how to run/verify them.
- Linked issues (if applicable).
- UI screenshots or short clips for frontend changes.

## Security & Configuration Tips
- Store secrets in `backend/.env` (never commit `.env` files).
- OpenAI and database settings are required for backend runtime; see `README.md` for example values.
