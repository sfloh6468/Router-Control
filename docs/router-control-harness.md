# Router Control Engineering Harness

## Purpose and Authority

This specification applies Harness Engineering to Router Control work involving
live ISP equipment, subscriber data, Carol, and external services. It governs
how future implementation, debugging, refactoring, and integration work is
prepared and validated; it does not implement runtime safeguards itself.

Load `.agents/skills/harness-engineering/SKILL.md`, then run the existing Loop
Engineering cycle inside this project harness.

### Current enforcement versus required target state

The current application deterministically blocks RouterOS and OLT mutations for
users with the `read_only` role. For users allowed to write, the AI prompt asks
for explicit approval before calling the command tool, but the server does not
currently verify an expiring approval bound to the actor, exact target,
normalized action, and parameters. Therefore writer approval is
**prompt-enforced, not deterministically enforced, and is unverified against
this harness**. Do not describe the current writer command path as an approved
single-target mode or rely on it for harness-compliant live mutation.

This specification preserves the existing role block and command model while
defining the safety boundary future mutating paths must satisfy. Implementing
that runtime approval boundary is outside this documentation task.

## Environments and Boundaries

Treat these as distinct environments:

1. **Local/test** — synthetic data, sanitized fixtures, recorded responses, and
   isolated databases. No production device routes or subscriber records.
2. **Staging/sandbox** — non-production accounts and equipment or vendor
   sandboxes, with separate credentials and explicit target allowlists.
3. **Approved hardware verification** — one identified test device or
   subscriber-owned test endpoint, bounded to the approved action and window.
4. **Production** — live devices, subscribers, messages, and external systems.
   Production access is never implied by a development task.

System boundaries include the browser, API server, database, AI provider,
WhatsApp provider, calendar and other connectors, the planned device sidecar,
VPN/tunnel boundary, and each remote device or service. Treat all network,
device, webhook, model, and recorded-response input as untrusted.

The required target state is for trust decisions to occur server-side:
authenticate the actor, enforce role and tenant/owner scope, resolve an exact
target, classify the action, verify approval, impose limits, execute through
the approved driver, and record the result. UI controls and AI prompts
supplement but never replace these checks. Where a current path lacks one of
these controls, mark it unimplemented or unverified rather than assuming the
prompt supplies it.

## Operating Modes and Risk Classes

Operating mode describes where and how an operation runs. Risk class describes
what it can do. Both must be recorded for consequential operations.

### Operating modes

- **Fixture mode** — synthetic or sanitized recorded inputs; no external side
  effects. Default for automated development and CI.
- **Dry-run mode** — validates and renders the exact proposed operation,
  resolved target, authorization result, and expected impact without sending a
  mutating command. A dry run must not be represented as proof that the live
  mutation succeeds.
- **Approved single-target mode** — executes one approved mutation against one
  fully resolved device, subscriber, conversation, session, or configuration
  object. Approval is bound to the actor, target, action, parameters, and a
  short validity window. This mode is a required future capability and is not
  currently implemented for writer-issued router/OLT chat commands.
- **Broad/high-impact mode** — affects multiple targets, shared infrastructure,
  network-wide policy, bulk messages, schema/data sets, or service
  availability. It requires a separately reviewed execution plan, explicit
  impact limits, staged rollout, stop conditions, backup/rollback evidence, and
  human authorization. It must not be reached by widening a single-target
  approval.

### Action-risk classes

| Class | Examples | Minimum expectation |
|---|---|---|
| R0: local/read fixture | Parse recorded CLI/API output, render UI | Fixture mode; automated assertions |
| R1: live read-only | Status, health, sessions, optical levels, config backup read | Authorized identity; exact target; timeout/rate limit; audit where data or devices are accessed |
| R2: reversible single-target mutation | Enable/disable one interface, reboot one ONT/router, change one SSID, disconnect one PPPoE session | Deterministic, expiring approval bound to actor/target/action/parameters; server-side role/target checks; pre-state; bounded command; post-state verification; audit; rollback/compensation. The current prompt-only writer approval does not satisfy this class. |
| R3: destructive or broad impact | Bulk device changes/messages, shared firewall or OLT changes, mass session disconnect, production migration | Broad/high-impact mode only; reviewed plan; staged canary; hard limits; independent approval; backups; tested rollback; active monitoring and kill switch |

Unknown actions default to the higher plausible class. A read that exposes
sensitive subscriber data may be operationally read-only but still requires
strict authorization, minimization, and audit.

## AI and Carol Safety Boundary

AI output is advisory and untrusted. Models may suggest commands, classify
intent, summarize data, or draft messages, but they do not grant permission.
The following bullets define required controls, not a claim that every current
path already implements them.

- Deterministic server code resolves identity, role, tenant, target, risk,
  approval, rate limits, and allowed parameters before any execution.
- The executor accepts typed, validated operations rather than treating model
  prose as authorization.
- Prompt instructions must not be the sole barrier to mutation or disclosure.
- Tool results are scoped and minimized before returning to a model.
- Carol's subscriber context is limited to the resolved subscriber/unit;
  staff-group context follows the application's existing staff-group model.
- Group-chat silence, human-handoff, shadow-mode, and message-retention rules
  require deterministic tests independent of model compliance.
- Incorrect, adversarial, duplicated, delayed, or unavailable model output must
  fail closed without bypassing approval or causing duplicate side effects.

## Shared Integration Requirements

Every driver or external-service adapter must define:

- a typed request/response or operation contract;
- sanitized fixtures or sanitized recorded responses for supported versions;
- contract tests for normal, empty, malformed, partial, unauthorized, timeout,
  disconnect, duplicate, rate-limited, and version-drift responses;
- explicit connect, read, write, and overall operation timeouts;
- finite retries only for classified transient and safely repeatable operations,
  with backoff and jitter; mutations require idempotency or reconciliation
  before retry;
- cancellation and a hard bound for long-running work;
- per-target concurrency/rate limits and a circuit breaker for repeated
  transport or authentication failures;
- health signals that distinguish dependency failure from a valid empty result;
- correlation from request and approval through driver call, result, and audit;
- real-hardware/provider verification criteria and supported-version evidence.

Never retry authentication failures indefinitely, silently downgrade TLS, or
fall back to a less restricted transport.

## Integration-Specific Harnesses

### MikroTik RouterOS

- Cover API-SSL, REST, and SSH adapter contracts used by the project without
  assuming identical output or error semantics.
- Maintain sanitized outputs for print/get/export, mutation results, permission
  denial, transport loss, malformed sentences, and RouterOS version variance.
- Bound `/ping`, `/tool/traceroute`, `/tool/torch`, and
  `/tool/bandwidth-test` with `count=N` or `duration=Ns`, plus transport and
  operation deadlines.
- Contract tests must prove read/mutation classification and server-side
  blocking for read-only roles.
- Mutations require exact device and resource resolution, pre/post state, and
  rollback or a documented compensating action. Verify on one approved test
  router before claiming transport/version compatibility.

### Huawei and V-SOL OLTs

- Keep vendor and model fixtures separate; never validate V-SOL parsing using
  Huawei output. V-SOL V1600G variants must include representative port and ONT
  layouts.
- Recorded CLI sessions must preserve prompts, pagination, echo, line endings,
  warning text, delayed output, and truncated/disconnected sessions while
  removing addresses, serials, credentials, and subscriber identifiers.
- Test parser behavior for optical values, absent/offline ONTs, alarms,
  ambiguous identifiers, CLI errors, and command completion.
- Activate, deactivate, reboot, service-port, or configuration operations are
  at least R2 and must bind to one resolved OLT/PON/ONT identity. Require
  pre-state, post-state, audit, and rollback/compensation evidence.
- Real hardware is required to certify command syntax and parser compatibility
  for each supported vendor/model/firmware family before enabling mutations.

### FortiGate

- Prefer FortiOS HTTPS REST with TLS verification and a least-privileged token;
  SSH/Netmiko fallback must be explicit and separately tested.
- Fixtures must cover supported FortiOS versions, pagination, HA, interfaces,
  policies, sessions, VPN status, backup payloads, authorization errors, and
  rate limits.
- The planned monitor/backup scope is R1. Treat configuration snapshots as
  sensitive secrets-bearing artifacts: encrypt/restrict access, redact logs,
  verify snapshot completeness, and record checksums and provenance.
- Do not infer configuration-write permission from backup access. Verify API
  paths and one backup against an approved test firewall/version before
  claiming live compatibility.

### FreeRADIUS

- Use a separate read-only database identity for session/auth visibility and an
  isolated database populated with sanitized `radacct`/authentication shapes.
- Cover SQL dialect/version differences, stale/open sessions, duplicates,
  missing stop records, rejected authentication, clock skew, and unavailable
  databases.
- Queries must be tenant/subscriber scoped, bounded, parameterized, and
  time-limited. Logs and AI context must minimize IP, credential, and
  authentication details.
- CoA/disconnect is R2: require explicit approval, exact NAS/session target,
  idempotency/reconciliation, rate limits, and post-action session evidence.
  Verify read compatibility with one approved known test subscriber; never use
  arbitrary production records for development.

### GenieACS / TR-069

- Use sanitized GenieACS responses for model-specific parameter paths, absent
  parameters, stale last-contact, task queueing, connection-request failure,
  duplicate tasks, timeout, and unsupported routers.
- Keep ACS credentials separate by environment. Device lookup must bind the
  ACS identity to the authorized subscriber record before returning data.
- Status reads are R1. Reboot and SSID/password changes are R2 and require exact
  device/parameter allowlists, approval, a bounded task, reconciliation of
  queued/completed state, and post-state evidence. Never expose WiFi passwords
  in logs, audit payloads, fixtures, or AI context.
- Verify supported parameter mappings and mutation completion on one approved
  registered test router/model before enabling them.

### WhatsApp, Carol, AI Providers, and External Services

- Use provider sandboxes or test recipients where available. Fixtures must
  cover webhook signatures, text, button/list replies, images, voice notes,
  groups, duplicates, out-of-order delivery, retries, provider errors, and
  model timeout/refusal/malformed tool calls.
- Verify webhook authenticity, deduplicate by provider identifier, preserve
  inbound/outbound correlation, and make sends idempotent where supported.
- Default to fixture or shadow mode. Any outbound test must use an approved test
  recipient/group; broad sends are R3 with audience caps, canary delivery,
  preview, cancellation, and independent approval.
- Deterministically test Carol's group gating, subscriber isolation, one-time
  greeting/voice notice, written-only voice handling, escalation rules,
  shadow-mode non-delivery, language behavior, and model-provider switching.
- Calendar or other connector writes require exact account/calendar/resource
  scope, explicit intent, idempotency, audit, and compensation for partial
  success (for example, a calendar update succeeding while a notice fails).
- Do not place full subscriber histories, contact details, secrets, or
  unnecessary identifiers in model prompts or provider logs.

### Future Device and Service Integrations

No new integration inherits trust merely by using an existing adapter
interface. Before enablement, assign its risk classes, document transport and
version support, create sanitized contracts and failure fixtures, enforce
timeouts/retries/circuit breaking, define target and impact limits, specify
audit/redaction, and state which claims require approved live verification.

## Data, Secret, and Audit Protections

### Test and subscriber data

- Generate synthetic subscribers, buildings, units, device identifiers, phone
  numbers, sessions, and conversations by default.
- If a recorded response is necessary, sanitize before committing it and review
  both content and metadata. Maintain no reversible mapping to real identities.
- Use isolated databases and storage prefixes/buckets for tests. Test cleanup
  must be target-scoped and must not share production credentials.
- Enforce owner/tenant and resolved-unit scope in queries and mutations; test
  cross-owner and wrong-target denial.

### Secrets and redaction

- Store device, VPN, database, provider, and API credentials only in approved
  secret/connection facilities. Never persist externally fetched site
  credentials locally.
- Redact authorization headers, cookies, tokens, passwords, SNMP communities,
  private keys, VPN material, connection strings, configuration secrets,
  subscriber contact data, and sensitive command output from logs and errors.
- Make redaction tests part of adapters, audit serialization, AI tool results,
  and failure handling.

### Audit evidence

Consequential activity must create append-only or access-controlled,
tamper-evident evidence containing a correlation ID, timestamp, environment,
actor, role, source, operating mode, risk class, approval reference, resolved
target identifiers, normalized action, redacted parameters, pre/post outcome,
duration, and failure category. Do not log raw secrets or full sensitive
payloads. Link AI suggestion, deterministic authorization, execution, and
external result as separate events so an AI statement cannot masquerade as
approval.

### Backup and rollback

- Capture configuration/state before an R2/R3 change when the platform supports
  it; record version, target, timestamp, checksum, secure location, and restore
  procedure.
- Validate that a backup is complete and retrievable. For high-impact work,
  rehearse restore or compensation in a non-production environment.
- Define post-change assertions, rollback triggers, operator/automation
  authority, and a maximum observation window.
- Reboot, disconnect, and message sends may not be literally reversible;
  document compensating actions and expected recovery instead of claiming
  rollback.

## Validation Matrix

These are minimums; higher risk or cross-cutting changes inherit all applicable
rows.

| Change type | Minimum automated evidence | Runtime evidence | Real system required? |
|---|---|---|---|
| UI | Type/build checks; component/interaction tests for permissions, loading, empty, error, confirmation, and stale state | Browser check of changed flow and role behavior | No, unless usability depends on a live-only device state |
| API/auth | Unit/integration tests for schema, validation, role/owner/target checks, idempotency, limits, errors, and redaction | Request/response check through the running API with isolated dependencies | No for generic behavior; provider/device compatibility follows its row |
| Database/schema | Migration/static checks; isolated forward migration; constraints and cross-owner denial; rollback or restore test where supported | Query changed path against an isolated populated database | Production is not required; production migration requires a separate reviewed plan and backup |
| AI/WhatsApp | Deterministic policy/tool tests; adversarial and malformed model output; webhook signature/dedup/order tests; shadow-mode non-delivery; prompt-data minimization | End-to-end sandbox/test-recipient flow with audit correlation | Approved provider sandbox/test recipient for delivery claims; never broad recipients |
| Read-only device/driver | Parser and protocol contract fixtures; timeout, auth, malformed, partial, disconnect, retry, breaker, and redaction tests | One bounded read against an approved test target with audit | Yes before claiming support for a device/model/firmware or provider version |
| Single-target mutation | All read-only evidence plus classification, approval binding, exact-target, pre/post state, idempotency/reconciliation, impact-limit, and rollback/compensation tests | Dry run, then one approved test-target mutation and restoration/post-state verification | Yes before enabling or claiming live mutation compatibility |
| Broad/high-impact | All applicable evidence plus staged/canary plan, hard caps, stop conditions, monitoring, backup integrity, and rehearsed rollback | Separately authorized staged execution with active observation and immutable audit | Yes; it cannot be approved solely from fixture evidence |

## Reporting Blocked Verification

If required evidence is unavailable, do not mark that capability verified.
Report:

1. the exact check that did not run;
2. why it was unavailable, including the missing environment, fixture,
   hardware, account, or approval (without exposing secrets);
3. which claims remain unverified and the resulting release restriction;
4. the strongest substitute evidence that did run;
5. the exact approved target and steps needed to complete verification later.

“Tests pass” must identify the relevant commands or flows and outcomes. Fixture
coverage may support implementation completion while live compatibility remains
explicitly blocked; it must not silently authorize production use.
