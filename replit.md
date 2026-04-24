# Overview

This project is a pnpm workspace monorepo using TypeScript, designed to manage network devices. It features a React-based frontend for controlling MikroTik routers and Huawei SmartAX OLTs, and an Express API server for backend operations and AI assistance. The primary goal is to provide a unified, professional network administration interface with AI-powered configuration and troubleshooting capabilities.

The "Network Device Manager" application aims to simplify the complex task of managing diverse network hardware through a single pane of glass, enhancing efficiency and reducing operational overhead for network administrators. The integration of an AI assistant further augments this by providing intelligent command execution and diagnostic support, acting as a "logged-in admin" on the user's router.

# User Preferences

I prefer iterative development. I want to be asked before making major changes. I want detailed explanations. I prefer simple language. I like functional programming. Do not make changes to the folder `lib/api-zod/dist`. Do not make changes to the folder `lib/api-client-react/dist`. Do not make changes to the folder `lib/db/dist`. The chat AI is positioned as a "logged-in admin" on the user's router. It has exactly one tool, `run_router_command`, which executes any RouterOS command over the active transport (API-SSL / REST / SSH). The system prompt tells it to think like a senior MikroTik engineer who just opened a Terminal: configuration, troubleshooting, diagnostics, statistics, status display, monitoring, scripts — all are in scope. Long-running tools (`/ping`, `/tool/traceroute`, `/tool/torch`, `/tool/bandwidth-test`) must be bounded with `count=N` or `duration=Ns` so they terminate. Read-only commands (print/get/export) run freely; mutating commands (add/set/remove/enable/disable) require explicit user approval first. Read-only role users have mutations server-side blocked via `isMutating()` regardless of AI behavior.

# System Architecture

The project is structured as a pnpm monorepo with separate packages for deployable applications (`artifacts/`) and shared libraries (`lib/`).

## Core Technologies
- **Monorepo Tool**: pnpm workspaces
- **Node.js**: 24
- **TypeScript**: 5.9
- **API Framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, drizzle-zod
- **API Codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite

## Project Structure
- `artifacts/`: Contains deployable applications like `api-server` and `mikrotik-manager`.
- `lib/`: Houses shared libraries including `api-spec`, `api-client-react`, `api-zod`, and `db`.
- `scripts/`: Utility scripts.

## TypeScript Configuration
The monorepo uses TypeScript composite projects. All packages extend `tsconfig.base.json` with `composite: true`. The root `tsconfig.json` manages project references, ensuring correct cross-package type-checking and build order. `tsc --build --emitDeclarationOnly` is used for type checking, emitting only `.d.ts` files, while `esbuild` handles actual JavaScript bundling.

## API Server (`artifacts/api-server`)
An Express 5 server handling API requests.
- Routes are organized in `src/routes/`.
- Uses `@workspace/api-zod` for request/response validation and `@workspace/db` for persistence.
- Provides an AI Assistant endpoint (`/api/chat/stream`) and device management APIs.
- Supports multiple network device transports (API-SSL, API, REST-TLS, REST, SSH) unified by a `RouterAdapter` interface, enabling flexible connectivity to MikroTik and Huawei OLT devices.

## Database (`lib/db`)
Implements the database layer using Drizzle ORM with PostgreSQL.
- Exports a Drizzle client instance and schema models.
- Drizzle Kit is used for configuration.

## API Specification and Codegen (`lib/api-spec`, `lib/api-zod`, `lib/api-client-react`)
- `lib/api-spec` manages the OpenAPI 3.1 specification (`openapi.yaml`) and Orval configuration.
- Codegen produces:
    - `lib/api-client-react`: React Query hooks and a fetch client.
    - `lib/api-zod`: Zod schemas for API validation.

## Frontend Application (`artifacts/mikrotik-manager`)
A React + Vite application branded as "Network Device Manager".
- **UI/UX**: Dark-mode professional network administration UI.
- **Device Management**: Manages MikroTik routers and Huawei SmartAX OLTs.
- **Pages**: Includes connection management, dashboards, interfaces, IP addresses, firewall, DHCP, wireless, terminal for MikroTik, and OLT-specific pages like dashboard, ONTs, service ports, and alarms for Huawei OLTs.
- **State Management**: `router-context.tsx` manages credentials, vendor type, and connection metadata. Auto-probes backend for session verification.
- **Write Capabilities**: Supports write operations like enabling/disabling interfaces, adding/removing IP addresses, managing firewall rules, DHCP leases, and full RouterOS command support via the terminal.
- **Vendor-Awareness**: The UI dynamically adapts based on the selected device vendor, switching navigation, dashboard components, and command suggestions.

## AI Assistant Integration
- **Backend**: `artifacts/api-server/src/routes/chat.ts` provides an SSE endpoint for streaming AI responses.
- **Model**: Uses `claude-sonnet-4-6` for multi-turn agentic interactions.
- **Tooling**: AI has a `run_router_command(command)` tool to execute RouterOS commands via the active transport.
- **Frontend**: A collapsible right sidebar (`chat-sidebar.tsx`) with markdown rendering, tool-call cards, and attachment support (images, text files).
- **Safety**: LLM is prompted to ask for explicit user approval before executing mutating commands.

## Authentication
- **Provider**: Clerk for user authentication.
- **Server**: `clerkMiddleware()` and `clerkProxyMiddleware()` protect API routes.
- **Frontend**: `ClerkProvider` wraps the application, providing themed authentication flows for sign-in and sign-up.

## Huawei OLT Support
- **Backend**: `artifacts/api-server/src/lib/huawei-olt.ts` uses an `ssh2`-based SSH adapter to interact with Huawei SmartAX EA5800 OLTs. It handles CLI interaction, command queuing, and output parsing.
- **Routes**: Specific API endpoints (`/api/olt/*`) for OLT operations like connection verification, dashboard data, ONT management, service port configuration, alarms, and raw command execution.
- **Chat**: Vendor-aware system prompt and toolset for the AI assistant when managing OLTs.
- **Schema**: `router_profiles.ts` includes a `vendor` column to distinguish between MikroTik and Huawei OLT profiles.

# External Dependencies

- **Database**: PostgreSQL
- **Authentication**: Clerk
- **AI Integrations**: Anthropic (via `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` and `AI_INTEGRATIONS_ANTHROPIC_API_KEY` environment variables)
- **MikroTik Connectivity**: `routeros-client` (internally managed by `RouterAdapter`)
- **Huawei OLT Connectivity**: `ssh2` npm package
- **API Generation**: Orval
- **Validation**: Zod