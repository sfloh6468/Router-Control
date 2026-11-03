# Security and Safety Requirements

Sources: `S-HARNESS`, `S-39`, `S-40`, `S-42`, `S-43`, `S-45`, and narrower read-only DMA/on-demand connectivity decisions.

The existing harness describes target controls, not proof of runtime enforcement. These controls are planned unless implementation evidence establishes otherwise.

## NP-SEC-01 — Server authority

Authenticate actor and membership; enforce role, entitlement, tenant, building, subscriber, device, and conversation scope on the server for every data read/action. Do not trust a client tenant ID, known-looking staff number, AI-generated role, unit name, imported message, or hidden UI control.

Separate platform administration from ISP administration. Subscriber context cannot retrieve other units; cross-tenant data, vector retrieval, cache entries, object paths, callback state, and queued work require equivalent isolation.

## NP-SEC-02 — Operating modes and risk

| Class | Example | Required boundary |
|---|---|---|
| R0 | Synthetic/recorded fixture parsing | No external effects; deterministic assertions |
| R1 | Approved live status/session/optical read | Authorized exact target; bounded work; minimized data; audit |
| R2 | One router reboot, SSID change, session reset, or consequential appointment/contact action | Typed action; verified scope; required consent/approval; pre-state; limits; idempotency; post-state; compensation |
| R3 | Shared infrastructure change, restore with broad impact, bulk communication, mass disconnect, production migration | Separate reviewed impact-limited plan, independent approval, backups, staged canary, stop conditions and recovery |

Operating modes: fixture, dry-run, approved single-target, broad/high-impact. Unknown actions default to the higher plausible risk. A dry run proves validation/preview only, not successful live behavior.

Do not retry diagnostics indefinitely or assume a read is harmless: config reads can expose secrets; bandwidth tests create load; saving configuration mutates persistence.

## NP-SEC-03 — Deterministic approval

Replace prompt-only approval with server-side approval records bound to authenticated actor, tenant, exact target, typed action, normalized parameters, risk, validity window, and permitted use count. Revalidate current permissions, eligibility, ownership, and approval at execution.

Reject stale/replayed approval, changed target/parameters, unknown tools, ambiguous identifiers, unsupported firmware, and revoked staff. A subscriber's message is consent evidence, not a substitute for staff authorization when an action requires it.

UI/API/worker/AI tool paths must reach the same enforcement boundary. Never allow “approved” prose or a policy edit to execute an arbitrary CLI string.

## NP-SEC-04 — Action execution and race safety

Capture relevant pre-state, exact intended effect, expected post-state, and rollback/compensation. Rate-limit and serialize per target. Use idempotency keys, duplicate suppression, bounded retries, circuit breakers, cancellation, and reconciliation of unknown outcomes.

Cancellation after external acceptance cannot guarantee reversal; record in-flight state and block follow-up duplicates. Human takeover and AI dispatch require ownership/version checks immediately before send. A delivered WhatsApp message cannot be treated as retractable just because a draft was cancelled.

## NP-SEC-05 — AI and policy safety

AI output and all retrieved content are untrusted. Use typed validated tool contracts, allowlisted parameters, minimized results, finite tool loops, and clear error states. User text, photos, audio, device banners, imported chat, or model output cannot grant permissions.

Admin runbooks/policies cannot change tenant isolation, action authorization, financial integrity, support scope, or privacy. Shadow mode disables all external effects at the executor layer, including sends, calendar writes, and device mutation. Keep active policy/version attribution; do not expose private reasoning as “monitoring.”

Tools unavailable because of provider/entitlement/security problems must report unknown/blocked, not healthy or completed. If safe continuation is impossible, queue or escalate.

## NP-SEC-06 — Integration contracts and network access

Every adapter needs typed contracts, capability/version discovery, sanitized normal/error fixtures, timeouts for connection/read/write/overall duration, retry classification, rate limits, cancellation, and correlated audit.

Only explicitly allowlisted targets/ports/operations may be reached. Block arbitrary proxying, metadata-service access, DNS rebinding, cross-building access, and destination changes after validation. Verify TLS/SSH host identity; never silently disable checks or fall back to an insecure transport.

OpenVPN site sessions are on demand, not permanent. Resolve temporary site connection details from the external store; protect them in memory/logs and do not persist fetched secrets or public management destinations locally. Sidecars require mutual authentication, job scope, rotation/revocation, health, and kill controls.

The broader harness's generic FreeRADIUS CoA example does not authorize DMA writes. The stricter DMA read-only rule always applies.

## NP-SEC-07 — Privacy, credentials, and retention

- Store credentials through approved secret facilities; never in code, ordinary profile tables, Git, screenshots, prompts, or logs.
- Encrypt traffic and sensitive stored data; restrict backup/media access and rotate credentials.
- Minimize subscriber data in model context, staff notifications, analytics, and audit.
- Validate and scan uploads; constrain decompression, parsing, media conversion, and temporary files.
- Keep imported history separate; treat it as untrusted reference, never consent or live work.
- Agree lawful processing/notice, vendor data use, region/cross-border transfers, retention/deletion/legal holds with the owner and qualified legal/privacy advisers. Do not claim legal compliance from an engineering checklist.
- Delete/expire source media, transcripts, indexes, caches, replicas, and backups according to a documented policy; explain what cannot be deleted immediately from backups and when it expires.

“Permanent messages” versus configured deletion remains unresolved. Do not implement irreversible purging or infinite retention without approval.

## NP-SEC-08 — Audit

Record actor/service identity, tenant and exact target references, request/case correlation, timestamp, mode/risk, policy/runbook/model version, authorization result, approval reference, sanitized action parameters, pre/post evidence, outcome, and verification/compensation. Include denials and failures.

Use tamper-evident storage with restricted write/delete access and auditable retention procedures. Do not log raw credentials or unnecessary full prompts. Normal users cannot edit audit evidence. Internal notes and customer-visible messages are separate record types.

## NP-SEC-09 — Webhooks, jobs, and delivery

Verify webhook authenticity and bind to one tenant. Deduplicate provider event IDs and handle duplicates, reordering, delayed delivery, retries, and replay. Make durable acceptance, delivery statuses, worker retries, and dead-letter/manual recovery explicit.

Recheck live owner/entitlement/suppression/approval before outbound effects; a valid event at intake may become unauthorized while queued. WhatsApp service windows/contact basis/templates are checked at send time, not assumed from a forwarded request.

## NP-SEC-10 — Recovery and release

Separate local fixtures, staging/sandbox, approved single-hardware verification, and production. Access to code does not authorize production.

Back up data and permitted device configs with encryption, integrity checks, retention, and demonstrated staging restore. Agree RPO/RTO, abort thresholds, kill switches, manual service continuity, schema migration/reversal strategy, health gates, and deployment rollback.

Release evidence must distinguish unit/fixture tests, browser tests, real provider delivery, and real hardware behavior. Fixture passes do not prove firmware compatibility. No broad rollout until the owner approves pilot evidence.

