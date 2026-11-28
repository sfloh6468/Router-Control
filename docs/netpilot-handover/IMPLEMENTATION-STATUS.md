# Implementation Status and Engineering Starting Point

**Code inventory last inspected: 3 November 2026. Planning-record coverage re-evaluated: 28 November 2026. Read-only inspection only.**

No app build, browser suite, typecheck, production query, device connection, or workflow restart was performed for this documentation request. Earlier conversation reports of passing checks are historical, not revalidated here.

## 1. Current repository

The code is a pnpm TypeScript monorepo with:

- React/Vite device-manager frontend.
- Express API.
- PostgreSQL/Drizzle shared database package.
- OpenAPI specification, generated validation and React query/client packages.
- Clerk-based authentication visible in source.
- Anthropic-backed staff device AI assistant visible in source.
- Separate slide-deck and mockup-sandbox artifacts.

These are inspected technical starting facts, not a recommendation to rewrite the stack.

## 2. Evidence-based inventory

| Area | Inspected evidence | Status and limitation |
|---|---|---|
| MikroTik staff manager | `artifacts/mikrotik-manager/src/pages/` dashboard/interfaces/IP/firewall/DHCP/wireless/terminal/connection; `artifacts/api-server/src/routes/mikrotik.ts`; `src/lib/router-transport.ts` | Code present; current functional/hardware compatibility not tested |
| Huawei OLT | API `src/routes/olt.ts`, adapter `src/lib/huawei-olt.ts`; OLT dashboard/ONT/service-port/alarm/user/snapshot pages | Code present; do not claim V-SOL works from Huawei code |
| Profiles/conversations | API `src/routes/profiles.ts`; shared profile/conversation/message schema | Staff owner-scoped device chat exists; not Carol's subscriber WhatsApp system |
| Staff AI | API `src/routes/chat.ts` includes `claude-sonnet-4-6` and device command tools | Existing Anthropic model is not the selected future Carol Gemini configuration |
| Approval | Chat route checks read-only mutation classification then executes writer tool calls; harness explicitly warns prompt-only writer approval | Target-bound deterministic writer approval missing from inspected path |
| Authentication/roles | `src/middlewares/requireAuth.ts`, admin routes and frontend | Existing roles `superuser`, `read_write`, `read_only`; not proof of ISP tenant-membership model |
| Database | Exports app users, router profiles, conversations, messages, OLT login events/alerts | No full tenant/subscriber/building/policy/ticket foundation found in exported schemas |
| OLT login/export | OLT route and history/CSV test files, users page, login event/alert schema | Code/test files present; current runtime passes not asserted |
| Configuration storage | `src/lib/objectStorage.ts`, snapshot-related code | Replit-specific integration requires external hosting review; permissions/restore not certified |
| Tests | API `olt.history.test.ts`, `olt.csv.test.ts`; frontend `tests/mikrotik-flow.spec.ts`, `tests/huawei-olt-flow.spec.ts` | Existing tests cover portions of baseline; not the full NetPilot acceptance suite |
| Business proposal | `artifacts/router-control-business-proposal/` | Separate deck; legacy name still visible in inspected sources; rename planned separately |
| Carol/tenant platform | Current registered API routes mount health, MikroTik, OLT, chat, admin, profiles | Full WhatsApp, tenant entitlements, runbook admin, subscriber history import, appointments and tickets remain planned in this scope |
| Additional adapters | No dedicated V-SOL/FortiGate/GenieACS/DMA modules found in the inspected route/lib inventory | Planned, not implemented by this handbook |

“Not found” means not found in the stated exported schema/route inventory, not proof that no experimental code exists anywhere else. Reinspect before coding.

## 3. Known issues and stale evidence

- The backlog contains an API admin parameter typecheck issue involving Express parameter types. The current file still has the relevant code shape, but no check was run to confirm the exact current error.
- Earlier context reported Vite dependency-resolution problems in the device-manager workflow. Do not claim this is fixed or necessarily still the same error.
- Planning records also note a flaky parallel end-to-end suite and text-dependent selectors. Their current conditions were not rechecked.
- Prompt-only writer approval is a confirmed source-level gap. Do not enable Carol automation by reusing the unrestricted staff writer command path.
- Existing per-owner scoping must be migrated deliberately to tenant membership. It is not interchangeable with complete multi-tenant isolation.

## 4. Preserve existing structure

Inspect before editing. Keep working MikroTik/Huawei flows; use incremental changes. Preserve API codegen and generated-package conventions. Existing project instructions forbid hand-editing `lib/api-zod/dist`, `lib/api-client-react/dist`, and `lib/db/dist`; generate outputs from their sources.

The original project uses Harness Engineering and Loop Engineering instructions. When transferring to a tool that cannot access those skills, apply the portable safety/verification rules in this handbook rather than assuming Replit callbacks exist.

### Existing commands, for future implementation only

These scripts were confirmed in package manifests but **not run** for this handbook:

```sh
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/mikrotik-manager typecheck
pnpm --filter @workspace/mikrotik-manager test:e2e
pnpm typecheck
```

Use an isolated test database and synthetic fixtures before running tests. Inspect scripts and their side effects before execution. Some root typecheck/build commands generate declarations/build outputs; do not treat them as purely read-only.

## 5. Logical future data model

This is a proposed conceptual model, not an approved migration:

| Domain | Records and links |
|---|---|
| Access | ISP tenant, member, role/capability, assignment, module entitlement, usage counter |
| Subscribers | Source/import, building, unit, subscriber/account, plan/status, opaque site/device references |
| Support | Channel, conversation, message/delivery, case/owner, private note, ticket, incident, handover |
| AI configuration | Provider/model capability, prompt/persona version, policy/runbook version, evaluation case/result |
| Historical imports | Batch, provenance message/media, mapping review, source coverage, approved reference extracts |
| Operations | Typed action, approval, execution/idempotency, audit, tunnel/sidecar job, backup/schedule |
| Appointments | Resource/calendar reference, booking/event link, confirmation/reconciliation state |
| Commercial | Catalog/module dependency, price-book version, quotation revision/approval, entitlement provisioning |

Each tenant-controlled relation needs enforced tenant scope, including indirect references. Credential material is not an ordinary business column. Migration must preserve ownership and history, with dry-run mapping/backup/reconciliation and rollback before production.

## 6. Running outside Replit

The planned Malaysian VPS and a DeepSeek developer are separate choices. Changing developer does not automatically change hosting. If hosting changes, deliberately replace or provision these dependencies:

| Dependency | External-environment work to plan |
|---|---|
| Authentication | Establish appropriate Clerk tenant/configuration or separately approved alternative; validate issuer/proxy/callback behavior |
| AI access | Use the selected provider/gateway account and supported SDK/API; Replit-managed keys/base URLs are not portable credentials |
| PostgreSQL | Provision/version/migrate/back up securely; no production data copy without approval |
| Object storage | Provision bucket/identity/private access/retention; adapt provider-specific helper rather than copy hidden runtime assumptions |
| Routing | Preserve app/API base paths; configure public reverse proxy, TLS, host allowlist, callback URLs and streaming |
| Background work | Select durable queue/scheduler, worker supervision, retry/reconciliation and dead-letter strategy |
| WhatsApp/calendar/email | Provision accounts/consents/webhooks with appropriate identities, scopes and approved test recipients |
| Site VPN/Netmiko | Verify host privileges, route isolation, client capacity, sidecar authentication, network restrictions and installation method |
| GenieACS | Separate approved host, database, ACS registration, TLS and device authentication |
| Release/monitoring | Service supervision, migration gates, logs/metrics, backup restore, rollback, secrets injection |

No exact production sizing, provider contract, queue technology, or infrastructure bill is approved here. Do not generate working credentials or deploy as part of reading the handbook.

