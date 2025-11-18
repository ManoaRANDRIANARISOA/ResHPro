# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project: Fusion Starter (TypeScript, React + Vite, Express)

Commands
- Install dependencies
  - pnpm install

- Develop (client + API in one dev server)
  - pnpm dev
  - Opens Vite at http://localhost:8080 with Express mounted as middleware; API routes are served under /api (see server/index.ts).

- Tests (Vitest)
  - Run all tests: pnpm test
  - Run a single test by name: pnpm test -t "cn function"
  - Run a single file: pnpm test client/lib/utils.spec.ts

- Type checking and formatting
  - Type check: pnpm typecheck
  - Format (Prettier): pnpm format.fix

- Build and run production
  - Build client and server: pnpm build
    - Client output: dist/spa
    - Server bundle: dist/server/node-build.mjs
  - Start production server (serves SPA and API): pnpm start
    - Default port is 3000; set PORT to override.

Architecture overview
- High level
  - Single repo with three top-level areas:
    - client/: React SPA (Vite) with React Router, Redux Toolkit (session), React Query for data, Tailwind + MUI + shadcn-style UI primitives.
    - server/: Express API. During development it is mounted into the Vite dev server; in production it serves the built SPA and exposes API routes.
    - shared/: Shared TypeScript domain types used by both client and server.

- Dev integration (vite.config.ts)
  - A custom Vite plugin creates the Express app (createServer from server/index.ts) and mounts it as middleware. This means during pnpm dev, frontend and /api routes run in one process on port 8080.

- Production serving (server/node-build.ts and vite.config.server.ts)
  - Server bundle is built with Vite in lib SSR mode targeting Node 22.
  - At runtime, Express serves static assets from dist/spa and falls back to index.html for non-API routes to support React Router. API routes continue to respond under /api.

- Client app
  - Entry: index.html -> client/App.tsx.
  - Routing: client/App.tsx defines routes; AppLayout wraps pages and computes the sidebar using role-based access control (useRBAC).
  - State: client/store (Redux Toolkit) for session (role, user), React Query for server data (currently mocked).
  - Data layer: client/services/api.ts wraps queries/mutations against in-memory mock data in client/services/mock.ts; swap these to real fetch calls when integrating a backend.
  - Styling: Tailwind (tailwind.config.ts, postcss.config.js) with CSS variables defined in client/global.css; MUI theme in client/theme/mui.ts; reusable UI components in client/components/ui.

- Server
  - server/index.ts exports createServer which configures CORS, JSON parsing, and example routes (/api/ping, /api/demo). dotenv is loaded for environment variables.
  - server/routes contains route handlers (e.g., demo.ts). server/node-build.ts is the production entry that serves the SPA and binds the Express app.

- Shared types
  - shared/api.ts defines domain models (clients, reservations, menu items, stock, invoices, etc.) and are imported on both sides via path aliases.

- Build configuration and aliases
  - Vite client config (vite.config.ts):
    - Output to dist/spa
    - Aliases: "@" -> ./client, "@shared" -> ./shared
    - Dev server on port 8080
  - Vite server config (vite.config.server.ts):
    - Entry server/node-build.ts, output to dist/server/node-build.mjs (ESM)
    - Target node22, externalizes express/cors and Node built-ins

Notes
- Linting: ESLint is not configured in this repo. Use TypeScript type checking (pnpm typecheck) and Prettier formatting (pnpm format.fix).
- Package manager: package.json pins pnpm@10.14.0 via the packageManager field.
