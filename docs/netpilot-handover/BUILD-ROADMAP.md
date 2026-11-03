# Build Roadmap — For Later Authorization

**No milestone in this roadmap is authorized by the handbook request.** Start implementation only after the owner selects a milestone and explicitly permits app work.

This order refines the old task dependencies with safety prerequisites that some task records omit. A dependency-free backlog record does not mean a production action is safe to build first.

| Milestone | Scope | Prerequisites | Exit evidence |
|---|---|---|---|
| M0 · Requirements and baseline | Review handbook, resolve first blocking decisions, inspect code, baseline checks in safe environment | Owner authorization to begin implementation; no production access implied | Requirements acknowledged; current checks/failures captured; first milestone boundaries approved |
| M1 · Tenant and safety foundation | Tenant membership/capabilities, baseline isolation, entitlements, typed action boundary, approval/audit, synthetic fixtures | M0; role/approval decisions | Two-tenant denial tests, no prompt-only privileged path for future automation, stable migration plan |
| M2 · Subscriber/source foundation | External source adapter, fallback import, exact mapping/review, opaque credential references | M1; source schema and credential architecture | Idempotent imports, report, ambiguous-target refusal, source health |
| M3 · Carol shadow support | Official test WhatsApp, durable intake/history, text/photo/voice, runbook/policy admin, selected models, history import and shared inbox | M1–M2; approved provider/test accounts; retention and scope decisions | No external side effects in shadow; staff-labelled cases, language/media checks, policy and takeover races covered |
| M4 · Private connectivity and reads | On-demand VPN/sidecar, secure target routing, DMA read-only, V-SOL diagnostic adapter; preserve Huawei/MikroTik baseline | M1–M2; network decision, version fixtures, approved test devices | Scoped test-site reads; no credential persistence/DMA write; teardown/revocation verified |
| M5 · Controlled L1 live pilot | Small approved recipients use Carol; staff handover/outreach, takeover/handback; manual escalation fallback | M3; approved quality, contact and retention gates; useful diagnostic adapters if required by pilot | Correct identities/ownership, no unintended sends, safe unresolved handling and monitored staff pilot |
| M6 · Guarded single-target L2 | Exact eligible ONT/router/PPPoE actions and managed-router tools | M1–M5; explicit action permission; actual hardware verification | Approval mismatch/replay denial, pre/post evidence, rate/idempotency, compensation and no DMA bypass |
| M7 · Operations modules | Tickets/digests/incidents, calendar, sales requests, snapshots/schedules, sign-in settings/notifications/history | Relevant data/channel/safety adapters; open business rules resolved | End-to-end role-based journeys, partial failure reconciliation, no unapproved broadcast or billing |
| M8 · Optional drivers and commercial provisioning | FortiGate monitor/backup, GenieACS, catalog/price-book/quote revision to entitlement conversion | Applicable M1–M4 foundations; real provider/hardware prerequisites | Driver/version evidence; only entitled modules execute; consistent quotation/export/provisioning |
| M9 · Production readiness | Malaysian VPS topology, staging deployment, migration/rollback, secrets, observability, restore drill, training | Accepted selected modules; explicit infrastructure approval | Repeatable releases; recovery and provider/tunnel failure drills; approved RPO/RTO and service objectives |
| M10 · Building pilot and rollout | One approved building/cohort, then controlled waves | M9; owner approval of evidence and recipients | No known safety breaches, measured quality/service gates, kill switch/manual fallback, explicit expansion approval |

## Work that must not wait until late milestones

- Tenant isolation, baseline privacy, safe media access and durable audit are not premium-only add-ons.
- Reliability instrumentation starts with each adapter, not at the final deployment.
- Quote/module enforcement can begin in M1 as a simple approved configuration; a full sales UI need not delay technical isolation.
- Human handoff and shared inbox are essential Carol safety capabilities even before advanced paid ticketing.
- Read-only DMA gating must exist before PPPoE mutation. No temporary “write now, add safeguards later.”
- Production-like backup/restore and rollback should be exercised incrementally.

## External development process

1. Read the start-here prompt and the source coverage limitations.
2. Restate scope and list blocking questions; select one owner-approved milestone.
3. Inspect existing modules before changing them; document a small proposed diff.
4. Use synthetic fixtures and finite feedback loops. Do not invent remote API or CLI syntax.
5. Add UI, backend behavior, permissions, error/recovery paths, and verification together.
6. Report demonstrated behavior separately from unverified hardware/provider assumptions.
7. Stop at the selected milestone. Do not deploy, switch databases/auth, or widen live access without explicit approval.

## Minimum release evidence bundle

For each accepted milestone include requirement IDs, changed components, migration/rollback notes, commands/journeys performed, results, failed/unverified checks, safe fixture/version provenance, audit evidence, unresolved decisions and owner sign-off when required.

Do not count a build pass as proof a customer journey works. Prioritize real role-specific workflows for sign-in, subscriber matching, handover/takeover, appointments, approvals, and data retention. Fixture passes do not prove real device writes are safe.

