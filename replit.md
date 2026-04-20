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
- Backend routes: `artifacts/api-server/src/routes/mikrotik.ts` — all API calls go through `withClient()` which opens and closes a transport-aware connection per request.

## Sandbox-Side Diagnostics (added 2026-04-20)

To support BGP / ISP troubleshooting where the AI needs a second vantage point on the public internet (independent of the user's router), the chat assistant now has these tools beyond `run_router_command`:

| Tool | Purpose |
|---|---|
| `tcp_probe` | Single TCP connect with timeout — telnet replacement |
| `tcp_ping` | N TCP probes → min/avg/max latency + loss% |
| `dns_lookup` | A / AAAA / MX / TXT / NS / CNAME / SOA / CAA / SRV / PTR |
| `reverse_dns` | PTR for an IP |
| `http_probe` | HTTP/HTTPS reach test → status, latency, redirect chain, TLS cert |
| `asn_lookup` | Origin ASN + AS name for an IPv4 (Team Cymru DNS) |
| `rdap_ip` / `rdap_domain` | Modern WHOIS via RDAP (ARIN bootstrap / rdap.org) |
| `sandbox_info` | This sandbox's public IP / ASN / country (Cloudflare trace) |

All implemented as pure-Node code in `artifacts/api-server/src/lib/diagnostics.ts` — no shell, no privileged sockets, works inside the container without root. ICMP ping/traceroute would need raw sockets so we substitute TCP-based probes (which are actually more useful for BGP/firewall debugging anyway). Tools are routed through a `DIAGNOSTIC_TOOLS` set in `chat.ts` and don't require the user to be connected to a router. The system prompt instructs the AI to compare router-side and sandbox-side probes for asymmetric routing / blackhole / BGP leak detection.

## Multi-Transport Support (added 2026-04-20)

The backend supports **four transports** so the app can reach a router whatever ports the user's firewall allows. The transport is part of `RouterCredentials` (added to `lib/api-spec/openapi.yaml` → regenerated into `@workspace/api-zod` and `@workspace/api-client-react`):

| Transport  | Default port | Use case                                              |
|------------|--------------|-------------------------------------------------------|
| `api-ssl`  | 8729         | DEFAULT — MikroTik binary API over TLS                 |
| `api`      | 8728         | MikroTik binary API, plain                             |
| `rest-tls` | 443          | Webfig REST API over HTTPS (RouterOS 7.1+)             |
| `rest`     | 80           | Webfig REST API plain HTTP (RouterOS 7.1+)             |
| `ssh`      | 22           | SSH — terminal & AI chat only, dashboards unavailable  |

**Architecture:**
- All transports are unified behind a single `RouterAdapter` interface in `artifacts/api-server/src/lib/router-transport.ts`. Every adapter exposes the same `menu(path).{get,getOnly,add,update,remove,enable,disable}` surface that `routeros-client` provided, plus `exec(command)` for raw SSH commands and a `transport` discriminator.
- `connectRouter(creds)` returns the right adapter; `withRouter(creds, fn)` is the open-run-close helper. Both auto-resolve transport from explicit field OR from port number (so legacy clients that just send a port still work).
- `mikrotik.ts` and `chat.ts` are now transport-agnostic — they just do `withClient({...creds, transport}, async (client) => client.menu(...).get())`.

**REST adapter (`buildRestAdapter`):** Webfig REST API on `/rest/<path>`. HTTP Basic auth, JSON in/out. PUT for add, PATCH for update, DELETE for remove, POST `/enable`/`/disable` with `{".id": id}`. Self-signed HTTPS certs accepted via `node:https` with `rejectUnauthorized: false`. Kebab-case keys from REST are converted to camelCase to match the routeros-client contract used by all dashboards.

**SSH adapter (`buildSshAdapter`):** Uses `ssh2` npm package. Connects with username suffix `+ct` (disables color output and pagination) so streams are parseable.
- For raw `exec(line)` (used by terminal route and the AI tool): pipe the line straight through, return stdout.
- For structured `menu(p).get()` (dashboards): runs `<path> print as-value without-paging` and parses semicolon-separated key=val lines per record. Mutations build raw RouterOS CLI commands (`/<path> add k=v ...`, `set <id> ...`, `remove <id>`, `enable/disable <id>`).
- Wide algorithm whitelist (curve25519/dh-group14/group1, ed25519/rsa-sha2/ssh-rsa, aes-ctr/gcm/cbc) to handle older RouterOS SSH defaults.

**Connect screen UI (`artifacts/mikrotik-manager/src/pages/connection.tsx`):** Transport `<select>` above the port field. Picking a transport snaps the port input to the new default (still manually overridable). Shows transport-specific hints + warnings (SSH = "dashboards unavailable", REST = "needs RouterOS 7.1+ with www service").

**Build cache gotcha:** `lib/api-zod` and `lib/api-client-react` had stale `dist/` folders with old `.d.ts` files. After running `pnpm --filter @workspace/api-spec run codegen`, those dist folders must be deleted (or `tsc --build` re-run) — otherwise TypeScript reads the cached declarations and won't see new fields like `transport`. Easy fix: `rm -rf lib/api-zod/dist lib/api-client-react/dist lib/db/dist`.

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
