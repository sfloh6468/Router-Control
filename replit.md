# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/mikrotik-manager` (`@workspace/mikrotik-manager`)

React + Vite frontend for managing MikroTik routers. Dark-mode professional network admin UI. Mounted at `/` (preview path `/`).

- Pages: connection, dashboard, interfaces, ip-addresses, firewall, dhcp, wireless, terminal
- State: `src/lib/router-context.tsx` stores credentials and current route
- Hooks: `src/hooks/use-mikrotik.ts` wraps generated API hooks with credential injection AND write mutations
- Entry: `src/main.tsx`
- Dev: `pnpm --filter @workspace/mikrotik-manager run dev`

**Write capabilities (non-OpenAPI, direct fetch):**
- Interfaces: enable/disable toggle, inline comment edit
- IP Addresses: add (dialog), remove (confirm), enable/disable toggle
- Firewall: add rule (dialog), remove (confirm), enable/disable toggle
- DHCP Leases: remove (confirm), make-static
- Terminal: full RouterOS command support — print, add, set, remove, enable, disable (index or .id)

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

## MikroTik Connectivity Notes

- Router runs **RouterOS v7.8** on IP `175.139.250.90`
- API SSL port `8729` is open and reachable; plain API port `8728` is ECONNREFUSED from external
- **Critical TLS fix**: MikroTik's API SSL uses **ADH (Anonymous Diffie-Hellman)** ciphers (`ADH-AES256-SHA256`). OpenSSL 3.0 disables ADH by default. Must pass `ciphers: "ADH:@SECLEVEL=0"` to `tls.connect()` options in the `routeros-client` config.
- The REST API on port 58080 (HTTP) returns 404 — it likely requires HTTPS. HTTPS also fails due to the same ADH cipher issue in openssl s_client, but works via `routeros-client` with the fix above.
- Backend routes: `artifacts/api-server/src/routes/mikrotik.ts` — all API calls go through `withClient()` which opens and closes a binary API connection per request.

## Authentication & AI Assistant (added 2026-04-20)

**Auth (Clerk):**
- Provisioned via `setupClerkWhitelabelAuth()`. Env: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`.
- Server: `clerkMiddleware()` + `clerkProxyMiddleware()` mounted in `artifacts/api-server/src/app.ts`.
- All `/api/mikrotik/*` and `/api/chat/*` routes gated by `requireAuth` middleware.
- Frontend: `App.tsx` wraps app in `<ClerkProvider>` with custom themed appearance, dedicated `/sign-in` and `/sign-up` routes, signed-out users redirect to sign-in.

**AI Chat Assistant (Anthropic via AI Integrations):**
- Provisioned via `setupReplitAIIntegrations({ providerSlug: "anthropic" })`. Env: `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`.
- Backend: `artifacts/api-server/src/routes/chat.ts` — `POST /api/chat/stream` SSE endpoint. Multi-turn agentic loop with `claude-sonnet-4-6`. One tool: `run_router_command(command)` which opens a fresh API-SSL session, parses RouterOS commands (menu/sub/key=value/positional), and returns output.
- Frontend: `src/lib/chat-context.tsx` (state + SSE parser) + `src/components/chat-sidebar.tsx` (collapsible right sidebar with markdown rendering, tool-call cards, file/image attachments, suggestion prompts). Always visible (collapsed handle when closed), works on connection screen too.
- Attachments: images sent as base64 image blocks; text files (configs, logs, .rsc) inlined into user message. 25 MB body limit on api-server.
- Safety: LLM is system-prompted to ask explicit approval before mutating commands; user sees every command live in tool-call cards with status; has Stop button. No backend command policy gate yet — could be added (parse subcommand, require approval token for non-print/get/export).
