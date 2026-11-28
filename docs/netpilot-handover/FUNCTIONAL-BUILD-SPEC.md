# Functional Build Specification

**Purpose:** Convert the product roadmap into explicit user-visible functions and expected behavior so a future developer can build NetPilot as one coherent application rather than infer product requirements from scattered chat or task notes.

This chapter complements, and does not replace:

- [Product requirements](PRODUCT-REQUIREMENTS.md), which define requirement authority and constraints.
- [Feature and package matrix](FEATURE-INVENTORY-AND-PACKAGING.md), which defines what is included or optional.
- [Carol support specification](CAROL-SUPPORT.md), which defines support behavior, messaging and policies.
- [User workflows](WORKFLOWS.md), which define end-to-end journeys.
- [Security and safety](SECURITY-AND-SAFETY.md), which defines mandatory enforcement.
- [Acceptance criteria](ACCEPTANCE-CRITERIA.md), which defines test evidence.

## 1. How to use this specification

The `FUNC-*` identifiers below are stable functional trace IDs. Every row defines an externally observable capability or behavior. The named `NP-*` requirement and `AC-*` test identifiers point to detailed limits and acceptance coverage. Do not implement a function in only one layer: the authorized user needs the UI, the API must enforce the same rules, records/jobs need correct state transitions, and a test must prove the journey and its denial/failure cases.

### Status meanings

- **Existing baseline:** code or earlier merged work is present; the handbook does not certify current behavior. Reinspect and regression-test it before extending it.
- **Planned:** explicitly described in a saved plan, requirement or current conversation; no implementation claim is implied.
- **Selected add-on:** available only when the tenant's explicit quote/entitlement includes it.
- **Open:** no owner-approved answer exists. Show an explicit blocked/unknown/pending state rather than inventing a business rule.
- **Deferred:** appears in older/archive suggestions but is not part of the present build commitment.

### Completion rule

Do not call the complete app finished because the main screens load. Completion requires every selected function in its authorized package, validated role-specific journeys, tenant isolation, external integration evidence, documented failures/recovery, and owner approval of pilot/production expansion. Unsupported models, services, firmware, parameters, and data schemas remain visibly unsupported until verified.

## 2. App sections and access model

### 2.1 Navigation

The application should expose only sections that the signed-in user is permitted to access and the tenant is entitled to use. Hiding a tab is presentation, not access control. Direct URLs, APIs, scheduled workers, webhook callbacks, AI tools and export/download paths must enforce the same tenant, role, assignment, status and entitlement checks.

| App area | Main users | Functions |
|---|---|---|
| Home / service overview | ISP administrator, manager, operations | Health, open support workload, outages, integration state, permitted operational summaries |
| Support inbox | Support agent, senior CS manager, authorized technician | Live subscriber conversations, assignment, handover, internal notes, takeover/handback |
| Subscribers / buildings | ISP administrator, assigned support/technical staff | Source status, import reports, building/unit lookup and authorized subscriber context |
| Network devices | Network operator, authorized technician, read-only staff | Existing MikroTik/Huawei pages and separately entitled drivers |
| AAA visibility | Authorized support, technician, operator | Read-only session/account evidence; no DMA mutation |
| Tickets / incidents | Support staff, manager, operations | Case-linked ticket state, incident correlation, digest and authorized exception actions |
| Appointments | Authorized support/manager | Business calendar policy, availability, booking/change reconciliation |
| Carol / policy studio | Tenant admin, senior CS manager | Persona, runbooks, policies, test/preview/publish/rollback |
| Imports / history | Tenant admin, specifically authorized reviewers | Historical WhatsApp export intake, mapping review, trend reports and retention actions |
| Security / settings | Tenant admin, delegated security admin | Members/roles, channels, alert policy, retention, safety/audit views |
| Product sales / quotes | Internal NetPilot sales admin only | Catalog, price book, prospect package, quote revisions and approved entitlement setup |
| Operations / recovery | Explicitly authorized operators | Provider/queue/device health, job states, backups, releases, recovery evidence |

Platform operator access is separate from ISP tenant administration. No role gets unrestricted cross-tenant subscriber, conversation, device or audit access simply by being a platform operator.

### 2.2 Role/capability matrix

This is the functional minimum. A permission should be a server-enforced capability, not an inferred title. The final names and permission combinations need the owner’s approval before production.

| Capability | Platform operator | Sales admin | ISP admin | Senior CS manager | Support agent | Technician | Network operator | Read-only |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Provision tenant / platform health | Yes | Limited | No | No | No | No | No | No |
| Build SaaS package / quote | No | Yes | No | No | No | No | No | View if granted |
| Manage own ISP tenant/settings/integrations | No | No | Yes | Delegated | No | No | No | No |
| Publish Carol runbooks/policies | No | No | Yes | Yes | Draft/review if granted | No | No | View if granted |
| View subscriber records | No by default | No | Yes | Assigned tenant scope | Assigned cases only | Assigned technical scope | Required device scope | Explicit scope |
| Contact subscriber / case handover | No | No | Yes if permitted | Yes | Yes, exact case | Yes, exact case | Only if explicitly granted | No |
| View assigned live conversations | No by default | No | Tenant controls | Yes, scoped | Yes, assigned | Only related cases | No by default | Explicitly scoped |
| Take over / return Carol case | No | No | Yes | Yes | Yes if assigned | If assigned and permitted | No by default | No |
| Read device / AAA status | No by default | No | If entitled | If entitled/case-scoped | Case-scoped | Scoped | Yes, target-scoped | If entitled |
| Execute R2 device action | No | No | Not inherently | Approval role only if configured | No unless separately approved | Approval/actor if configured | Authorized, exact target | No |
| Change module entitlement | Platform provisioning only | After approved quote | No self-upgrade | No | No | No | No | No |
| Change/remove audit evidence | No ordinary role | No | No | No | No | No | No | No |

`R2` means a consequential single-target action; see security and harness chapters. An approving role cannot approve its own request where the policy requires separation of duties. The exact maker/checker matrix is open.

## 3. Tenant and product administration

### FUNC-PLAT-01 — Create and select an ISP tenant

An authorized internal operator creates a tenant only after an approved customer package/contract decision. Required setup includes tenant name/branding, locale/timezone, service contacts and lifecycle state. The system generates a non-guessable tenant identity. Every tenant-owned record and job is bound server-side to the authenticated membership. A client-supplied tenant identifier cannot grant membership.

If a user belongs to multiple ISPs, tenant switching must show the current tenant explicitly and clear or reload tenant-scoped screens, caches and selections. A stale browser tab must not silently write to the previously selected tenant after a switch. If the active membership has been revoked, all requests fail safely and active workflows stop.

**Map:** NP-TEN-01–02; AC-02–04.

### FUNC-PLAT-02 — Invite, assign, change and revoke staff access

Tenant admins invite a staff identity through the existing approved authentication system, assign a role/capability and optional building/case/device scope, review membership status and revoke access. Store the actor, change, effective time and reason in audit. Changing a role immediately re-evaluates queued jobs and actions; queued work cannot rely on permission that was removed after intake.

Do not equate a WhatsApp number or forwarded message with an authenticated staff identity. Staff directory enrollment and revocation, plus confirmation of high-risk action approvers, are owner decisions.

**Map:** NP-PRO-02, NP-TEN-02, NP-SEC-01/03/08; AC-02, AC-13, AC-61.

### FUNC-PLAT-03 — Configure tenant defaults

Provide tenant settings for display name/brand, supported languages, timezone, office hours/holidays, support contacts, subscriber source, WhatsApp channel, AI provider/model choices, Carol greeting/persona, policies/runbooks, retention, notification recipients, device sites, calendar, cost/usage limits and module settings. Each setting must show whether it is effective, missing a prerequisite, invalid, or awaiting verification.

Use tenant timezone for greetings, working-hours logic, alert windows, appointment rules and display. Persist canonical timestamps and present localized views. Invalid timezone or unsupported locale values are rejected rather than silently converted to server-local time.

**Map:** NP-TEN-02, NP-CAR-03, NP-DEV-03, NP-OPS-01; AC-03, AC-45.

### FUNC-PLAT-04 — Manage module entitlements

The internal product catalog and each tenant's approved order define active modules, selected vendor drivers, quotas and effective dates. Show entitlement status (`active`, `scheduled`, `suspended`, `expired`, `missing prerequisite`, or `pending approval`) and an explanation. Enforce entitlement at the API, worker, webhook, AI-tool, storage, messaging, reporting and UI layers.

Suspending a module blocks new access/jobs. It must not silently delete its data or replay queued work when reactivated. Reconciliation requires duplicate checks and the tenant's approved resume policy. A plan name alone cannot activate every feature in that tier; apply the explicit line-item entitlement. In particular, V-SOL/FortiGate/GenieACS are selected Operations Pro driver add-ons and are **off** unless explicitly entitled.

**Map:** NP-TEN-03, NP-COM-01–04; AC-04, AC-08–09, AC-68–69.

### FUNC-PLAT-05 — Show product package and add-on boundaries

Display Starter ISP, Operations Pro and Enterprise / Custom as editable price-book bundles. Starter includes platform core, baseline MikroTik/Huawei, basic supported AAA visibility, Carol, policy studio and standard onboarding as specified in the package matrix. Operations Pro enables selected operational modules; selected add-ons must still be named in the approved quote. Enterprise / Custom is not unrestricted access.

The tenant's settings page should explain what is enabled, what is unavailable, what data/configuration is needed, and whether the blocker is an entitlement, hardware, integration or owner decision. Do not display a disabled capability as “temporarily broken” if it is simply not contracted.

**Map:** NP-COM-01–04; AC-08–10, AC-68.

## 4. Subscriber, building and device registry

### FUNC-DATA-01 — Configure the authoritative subscriber source

An ISP admin chooses/configures the ISP-provided external subscriber database as the primary source. The app must not assume its engine, schema, URL pattern or read API. At implementation time, discover an approved schema/API and agree field mapping and read privileges. Keep source access behind a source adapter so future source formats do not change case/device logic.

The settings view shows connection status, last successful read/sync, last error, supported fields, freshness and manual refresh action. Store source credentials in the environment's secure secret facility. Never echo, log or include them in prompts. The exact live-read versus local-sync approach remains an owner decision; do not create a second conflicting “source of truth.”

**Map:** NP-DAT-01; AC-05.

### FUNC-DATA-02 — Import spreadsheet/workbook/CSV fallback

An authorized admin selects a supported file or authorized Google Sheets source, chooses the import preview, reviews detected building tabs and header mapping, and explicitly confirms the import. Expected workbook data includes a building/header section (site device references, ports and switch notes) and unit rows with fields such as unit number, PPPoE ID/password, GPON/ONT serial, Wi-Fi MAC/SSID/password, customer name, plan/status, cable, installation date and remarks.

Passwords and other secrets must not land in ordinary profile/remarks fields. The importer detects header changes, blank rows, non-unit rows (for example, common rooms), duplicates, malformed serials, invalid dates, missing unit numbers and unknown columns. Show per-row `created`, `updated`, `skipped`, `needs review`, or `failed` with safe reasons. Do not silently drop data.

Preview counts and mapping are shown before confirmation. Import is idempotent for the approved tenant key and can safely be repeated. It never changes devices, sends messages, changes billing or assumes that unit/phone data proves identity.

**Map:** NP-DAT-02–04; AC-06–07.

### FUNC-DATA-03 — Browse and resolve a building/unit

The admin building list supports search, filters and a detail view containing approved site/device references, data source and freshness. The unit list displays condo/building + unit, subscriber identity/contact as role permits, service plan/status, PPPoE identifier, mapped ONT serial, managed-router serial/MAC and installation/cable metadata. Do not display PPPoE/Wi-Fi passwords in ordinary list rows.

A lookup returns exactly one tenant-scoped candidate or an explicit `no match`/`ambiguous match` result. Candidate lists are minimized; they must not disclose one household's details to another. Ambiguous mappings enter an admin review queue. A confirmed mapping is auditable and becomes the scoped subscriber/device context for that case.

**Map:** NP-DAT-03, NP-CAR-05, NP-L2-01; AC-02, AC-13, AC-53.

### FUNC-DATA-04 — Manage site and device references

Admins register buildings, devices, vendor, model/firmware, serial/identity, supported capabilities, site membership and opaque credential references. Track connection capability and supported management paths, but do not create arbitrary user-supplied network destinations. Changes to target/subscriber mapping require explicit validation and audit.

Connection credentials are handled by approved secret storage. Public site addresses and VPN credentials that are fetched from the external site-credential source remain transient; persist only opaque reference and non-sensitive operational audit metadata. The separate subscriber workbook's PPPOE/Wi-Fi secrets require a distinct owner-approved storage policy; do not conflate them with site VPN credentials.

**Map:** NP-DAT-03–04, NP-NET-01, NP-SEC-06–08; AC-07, AC-54–55.

### FUNC-DATA-05 — Refresh/synchronize data safely

Provide an explicit admin refresh action and, only if approved, a scheduled refresh. A refresh has a unique batch ID, start/end, source version/cursor if available, counts, field mapping and row-level outcomes. Partial upstream outages leave last-known data intact but marked stale. Empty or partial responses never wipe a tenant's records by default.

Define conflict handling before implementation: which source owns each field, whether app corrections are allowed, how deletions/deactivations propagate and how orphaned device associations are reviewed. This policy remains open until confirmed.

**Map:** NP-DAT-01–04, NP-OPS-01; AC-05–07.

## 5. Existing device manager and device-driver functions

### FUNC-DEV-01 — Preserve the MikroTik management workspace

Keep the existing connection/profile flow and vendor-neutral shell. Preserve the current dashboard, interfaces, IP addresses, firewall, DHCP, wireless, terminal and existing staff AI/device-assistant routes. Maintain per-device transport selection supported by current code (RouterOS API/API-SSL, REST variants and SSH where configured) and show identity/vendor to prevent acting on the wrong device.

Support profile create/select/reconnect/delete states only after inspecting current behavior; clear secrets and transport state when switching devices/vendors. Preserve existing pages and URLs unless a separately approved change calls for migration. Never silently downgrade TLS or send management ports over the public internet.

The existing raw terminal is a staff feature. Subscriber-facing Carol must not inherit arbitrary terminal access.

**Map:** NP-DEV-01; AC-42–43.

### FUNC-DEV-02 — Preserve and revalidate Huawei OLT workspace

Keep the Huawei EA5801E/EA5800-family connection path and applicable dashboard, ONT, optical information, service-port, alarms, user-management, terminal/chat, and configuration-snapshot screens where present. The dashboard exposes the currently supported identity/model/version, uptime, board/GPON summaries and active-alarm counts when the model returns them. The ONT list includes serial/index/state/down cause; optical values are explicitly on-demand and include units/freshness. Service-port add/delete and device-user/password/policy changes are consequential device mutations and require the new server-side authorization gate before any future enablement.

Do not use Huawei output as proof of V-SOL support. List unsupported models/firmware clearly. Existing code and previous device tests are not certification of current live firmware.

**Map:** NP-DEV-02/04, NP-SEC-03; AC-42–43, AC-46–47.

### FUNC-DEV-03 — OLT user, login and security-history console

Where the supported OLT exposes these data, administrators can:

1. View OLT-side operator accounts, user class/policy information and current online sessions.
2. Add/remove an OLT user, change a password or supported password policy only through a protected writer workflow.
3. View recent device logins and active sessions. Distinguish live device-buffer data from stored history.
4. Force-logout one exact session only through a protected action.
5. Search/filter historical login events by host, username, source IP, channel, result and time range; export the exact filtered set as safe CSV.
6. View suspicious-login patterns, recipients and notification state; writers acknowledge/dismiss and see who/when; history links to matching rows.
7. Configure threshold, rolling window, lookback, business-hours start/end and timezone per tenant/profile, with validated ranges and effective-state preview.
8. Notify configured administrators once per alert/watermark window; email is minimum planned channel, push/webhook depends on separate provider configuration.

Retention, acknowledgement, delete/purge/export permissions, recipient consent, stale log warnings and daylight-saving/timezone behavior are visible. CSV escaping, formula injection, UTF-8, streaming/backpressure, file naming, tenant limits and filter parity are tested.

**Map:** NP-DEV-03; AC-43–45.

### FUNC-DEV-04 — Capture, browse, schedule and restore snapshots

Capture a supported config snapshot on demand. Show snapshot list entries with timestamp, device identity, safe host/site reference, size, checksum/integrity, vendor/version, capture status and storage status. Allow authorized users to download/review only when permitted; protect configuration artifacts as secrets-bearing files. A snapshot that failed capture/storage must show failure, not look complete.

Nightly schedule is per eligible profile/device and uses an explicit tenant timezone/hour, an enable state and next/last run. The scheduler deduplicates runs and exposes start/result/retry state. Do not schedule a live action with an unapproved access route.

Restore and delete are separate high-risk paths: preview target and snapshot version, verify model/firmware and format, require an approved backup/impact/authorization, and record pre-state, result, compensation and audit. Restore must not run from a mere download action or from AI-generated prose.

**Map:** NP-DEV-04, NP-OPS-02; AC-46–47, AC-65.

### FUNC-DEV-05 — Add V-SOL V1600G OLT support

Provide an explicit V-SOL vendor/model selection for V1600G0-B, G1-B and G2-B with model-aware PON port layout. Route SSH/CLI operations through the planned Python Netmiko sidecar, use generic SSH with an explicit V-SOL command/parser set, and dispatch from the shared OLT layer by the registered vendor/model. Do not use public Telnet or skip host identity verification.

Read and render uptime, software version, PON state, alarm list, ONT inventory and per-ONT online state/down cause where supported. Resolve a requested ONT by validated serial + building/PON/port mapping; fetch optical Rx/Tx on demand, with units and timestamp. Handle paginated, partial, delayed, malformed and disconnected CLI output. Exact command syntax and threshold meanings must be verified from captured and real V-SOL evidence.

Activate/deactivate/reboot applies only to one exact ONT. Preview current state and intended change; require action entitlement, requester/approver rules, subscriber/device resolution and expiring bound approval. Verify post-state; timeout yields unknown/reconcile, not success.

**Map:** NP-VSO-01–02, NP-NET-01, NP-SEC-03–06; AC-48, AC-54, AC-61–62.

### FUNC-DEV-06 — Add FortiGate monitoring and on-demand backup

Allow admins to add a supported FortiGate, confirm FortiOS version/capabilities and securely register an API identity. Prefer HTTPS REST with certificate verification and a least-privileged token. Use SSH/Netmiko fallback only where an exact API read is unavailable, explicitly approved and separately verified. Do not weaken trusted-host restrictions or expose the management interface publicly.

The status view displays model, FortiOS version, uptime, HA state, CPU/memory, interface up/down, active policy list, session count and VPN tunnel status where the API version supplies each value. Missing privileges or unsupported fields show `unavailable/unsupported`; zero is not a fallback for missing data.

The backup control fetches a full configuration on demand, records source/version/time/checksum/completion and stores it in protected snapshot storage. Operations are audit-correlated. Initial scope is read/monitor/backup only: no policy edits/object changes, no scheduled FortiGate backup unless later approved, and no other firewall vendor.

**Map:** NP-FGT-01, NP-SEC-06–08; AC-49.

### FUNC-DEV-07 — Add GenieACS/TR-069 subscriber-router integration

This is a selected optional Operations Pro driver; it is not included by default. Use an existing/user-provided GenieACS host, database and API; do not build an ACS from scratch. Provide a separate admin prerequisite/setup guide for GenieACS + MongoDB, TLS, API credentials, connection-request authentication, supported TP-Link/TR-069 router settings and enrollment. Verify current GenieACS/API and router parameters rather than generating untested field scripts.

Associate ACS records with the tenant's subscriber by verified serial/MAC mapping. Look up by subscriber/unit in the UI, not by exposing opaque ACS IDs to support agents. The subscriber-router panel shows registered model, last inform/contact, online/stale/offline classification, uptime, WAN state, Wi‑Fi SSID and connected host count/signal only if the router reports them. Display source time/freshness and each unsupported parameter. Unregistered or customer-owned unsupported routers are clearly marked “not remotely manageable.”

Authorized staff can request a supported router reboot or read/change a supported Wi‑Fi SSID/password. Changes require explicit confirmation and deterministic exact-target/parameter allowlists, an approved actor/entitlement, action audit, bounded GenieACS task state, reconciliation and post-state verification. Do not return the Wi‑Fi password in normal transcripts, dashboard lists, logs, fixture files or model context. Carol may invoke only the same typed, permission-checked operations; a subscriber message does not bypass server approval.

Verify on one approved registered EX141 with its actual firmware and captured GenieACS responses. Other TR-069 models are unsupported until separately validated. Bulk firmware, provisioning templates and field preconfiguration are out of scope.

**Map:** NP-ACS-01–02, NP-COM-03, NP-SEC-03/06–08; AC-50, AC-68–69.

### FUNC-DEV-08 — Read-only DMA Softlab Radius Manager/AAA visibility

An admin configures the customer-provided DMA installation using secure credentials and explicitly approved test access. During discovery, show detected product/version, supported API read functions, DB/schema dialect, query capability and health without showing secrets. Do not assume an API is REST or a database/schema is identical across versions.

Prefer documented read methods. Where needed, use a separate read-only MySQL account and parameterized, time-bounded, tenant/subscriber-scoped queries. Join by normalized PPPoE ID to the tenant subscriber record.

Subscriber view: session up/down/unknown; start time; assigned IP only to authorized roles; usage/session counters; account enabled/disabled; service plan; expiry/remaining allowance if supported; recent authentication outcomes; source timestamp/freshness and adapter health. Manager view: building-level active-session counts, data coverage and unknown/missing accounting state.

Carol receives a minimized typed “check subscriber AAA status” result and may explain the likely category (authentication/account/line/device) with uncertainty. DMA is strictly read-only: no account creation/edit/delete, credit/refill, plan or expiry changes, enable/disable/suspension/reactivation, CoA/PoD/disconnect, SQL writes or billing data changes. If DMA says disabled, expired, depleted, or otherwise blocked, route to staff. MikroTik must never override DMA authority.

**Map:** NP-AAA-01–02; AC-51–53.

## 6. Carol subscriber support functions

### FUNC-CAR-01 — Receive and route a WhatsApp request

Use the official WhatsApp Business connection selected for the tenant. Verify webhook signatures, bind each event to exactly one tenant/channel before subscriber lookup, deduplicate provider event IDs, handle delayed/out-of-order retries and durably record accepted inbound events before acknowledging where the provider supports it. One tenant’s number, templates, credentials, policies, AI settings and staff notifications are not shared with another.

Existing ordinary WhatsApp groups remain human-managed. Provide a tenant-specific `wa.me` URL/QR code and copy-ready group description/pinned message. Do not rely on group access or group API capabilities. Telegram is excluded. Optional staff WhatsApp notifications are individual, explicitly configured one-to-one recipients; staff operations remain in the authenticated console.

**Map:** NP-CAR-05–06, NP-SEC-09; AC-27, AC-36.

### FUNC-CAR-02 — Identify subscriber and establish case scope

Greet once at the start of a new complaint in local timezone; detect English/Malay/Chinese and let the subscriber correct language. Ask for condo/building and unit through a list/button or free text. Verify the selected record and any separately approved verification challenge before sensitive details or actions. Attach conversation, case, exact tenant/subscriber/building/unit, source channel, issue and current case owner.

If the record is missing, duplicated, stale or ambiguous, ask a minimal clarification or route to staff. Never disclose another unit's customer name, phone, account, status or device by listing candidates. A forwarded staff message supplies context but is not identity proof.

**Map:** NP-CAR-03/05, NP-DAT-03; AC-11–13, AC-26.

### FUNC-CAR-03 — Conduct L1 Internet troubleshooting

Support categories include no internet, slow subscribed speed, weak Wi‑Fi, line/signal issue and read-only billing/account-status inquiry. Provide guided buttons for common branches (`Done`, `Still red`, etc.) while accepting ordinary typed responses. An admin-published runbook guides questions/evidence, step order and stop conditions.

Validated ISP-side steps can include model-specific router/ONU LED guidance with approved diagrams, safe checks that supplied power/fiber/CAT6 cables appear seated, ISP/ONT/WAN status and bounded router/session reachability checks. Do not tell the customer to open a device, repair/clean/splice optical fiber, factory-reset equipment, or change customer-owned endpoint settings. A managed-device restart is a separately entitled/authorized action, not a casual instruction.

For a slow-speed claim, capture relevant plan, link/session, device-path, test method/location/time and supported measurements. Explain uncertainty if only partial evidence exists; a working phone does not prove subscribed speed or perfect service. If one endpoint fails while another using the same ISP connection works and relevant ISP checks are healthy, politely refer that endpoint to its manufacturer/installer. Continue ISP checks when multiple devices fail or available network evidence is abnormal.

For account/billing inquiry, read only supported minimal DMA/plan status. Do not change a balance, plan, expiry or account state; send payment or account disputes to authorized staff.

Urgent or angry messages increase case priority and receive acknowledgement but do not by themselves end troubleshooting or page staff. Human escalation occurs if the subscriber asks or the runbook remains unresolved/stuck; unsafe/unavailable checks are explicitly marked unknown and handed off.

**Map:** NP-CAR-01–02/07/10, NP-AAA-01–02; AC-14–18, AC-22–23.

### FUNC-CAR-04 — Interpret photos

Accept supported router/ONU photos and speed/error screenshots. Validate content, MIME/type, size, malware/parser constraints, provider media URL authentication and retention. Route only to an image-capable model/API. Use the reported device model and visible image evidence; ask a follow-up when uncertain. Do not claim numeric optical power, plan speed, account status or action consent from an image.

Image text, QR content and visual prompt-injection are untrusted data. They cannot alter policies, grant access or call tools. Staff may request a clearer/closer image or take over.

**Map:** NP-CAR-08, NP-AI-01–02, NP-SEC-05/07; AC-19.

### FUNC-CAR-05 — Interpret voice notes; reply only in writing

Accept supported WhatsApp voice-note files; associate original media with a bounded transcript, source timestamp, language/confidence and conversation. Use the chosen model's verified audio input or a separately approved transcription provider. Do not promise a provider or cost until selected. Ask the subscriber to confirm uncertain names, unit numbers, numbers/dates or action consent. Handle conversion, codec, duration, size and transcription failures with a clear request to repeat/type or staff handoff. Never drop an accepted message silently.

Show the voice-capability notice once per applicable conversation and continue with written WhatsApp replies. Do not answer WhatsApp calls or send generated voice responses.

**Map:** NP-CAR-09, NP-AI-01–02; AC-20–21.

### FUNC-CAR-06 — Select models and evaluate quality

Tenant admin configures the initially selected Gemini 2.5 Pro complex-support model and Gemini 2.5 Flash routine classifier/summary model, with per-capability overrides where supported. DeepSeek vision is an optional comparison candidate in shadow mode; DeepSeek's use as code developer is a separate choice. Verify live API availability, image/audio capabilities, supported model ID, region/privacy terms, tool format and rate/size limits during implementation.

Shadow-evaluate candidates on the same authorized/anonymized labelled cases. Score diagnosis, evidence fidelity, ISP-only scope, endpoint refusal, language/translation, photo/audio confidence, escalation, tool selection, hallucination and outcome. Human support reviewers approve the quality gate. Log model/version and policy/runbook versions without dumping sensitive raw prompts. Model outage or unsupported media gives a clear unknown/fallback/queue/handoff; it never silently drops messages or broadens model permissions.

**Map:** NP-AI-01–02; AC-34–35.

### FUNC-CAR-07 — Retrieve prior support case context

Carol can retrieve a restricted, role-authorized, tenant-scoped subset of the same subscriber's earlier reports, categorized issues, open cases and outcomes. Display source/date and relevance. Do not treat history as current device state or truth; stale/contradictory records require fresh checks. Minimize personal details in model context. Historical imports are never searched across tenants.

**Map:** NP-CAR-13, NP-HIS-01–02, NP-SEC-01/05/07; AC-29, AC-37–41.

## 7. Carol Runbook & Policy Studio

### FUNC-POL-01 — Maintain separate runbook and policy records

Tenant admin/senior CS manager opens a versioned editor and creates multiple records rather than editing one master prompt.

- **Policy:** name/title, category, natural-language rule, examples, priority, applicability, effective interval, status, author, publisher, revision/reason.
- **Runbook:** title/purpose, issue triggers, ordered steps and branches, required evidence, permitted existing actions, stop conditions, referral/out-of-scope conditions, escalation target, language, applicability, effective interval, state, author/publisher, revision.
- **Persona/service charter:** optional separate editable tone/name/greeting/language content; `SOUL.md` is a proposed readable export, not an authorization format or approved technical dependency.
- **Knowledge:** only approved/validated source material; a separate generic FAQ/coverage knowledge-base editor was an archived proposal, not included unless owner approves it.

Draft, test, publish, disable, supersede and rollback actions are role-gated and audited. Editing does not make a rule effective automatically.

**Map:** NP-CAR-04, NP-POL-01–03; AC-30, AC-33.

### FUNC-POL-02 — Preview interpretation and conflicts

Before publish, show the exact proposed version, target scope/effective dates, interpreted plain-language meaning, conflicts with active policies, affected test scenarios, sample responses, actions requested, and known missing evidence. A dangerous/ambiguous conflict blocks publication or requires correction; do not let the LLM silently choose precedence.

Platform safety, privacy, authorization, DMA read-only boundary, financial integrity, tenant separation and endpoint support boundaries always win. Global company policy applies before narrower policy; narrower policy can refine but never relax a mandatory constraint. Conversation text is user input, not policy.

**Map:** NP-POL-03, NP-SEC-05/08; AC-31–33.

### FUNC-POL-03 — Run simulation and shadow review

Authorized admins run test cases covering normal complaint, missing identity/evidence, endpoint-only problem, out-of-scope behavior, angry/urgent customer, malicious image/audio/text, account-blocked subscriber and unsupported device. Display expected route, model draft, evidence used, tool request (if any), policy versions and reviewer correction. Shadow mode may only write to staff-only console/fixture dataset; the executor blocks all WhatsApp sends, calendar writes and device mutations even if model output requests them.

**Map:** NP-POL-01/03, NP-HIS-03, NP-AI-02, NP-SEC-05; AC-30–35, AC-40.

### FUNC-POL-04 — Publish, schedule, disable and roll back

Publishing creates an immutable version with publisher/time, reason, effective start/end and test evidence. Disabling/superseding does not rewrite history. Rolling back activates a prior version as a new audited state; it does not erase intervening versions. For each conversation, record exactly which versions were retrieved/applied. The behavior of already-open cases during a policy change is open; do not silently mix snapshots.

**Map:** NP-POL-01–03; AC-30, AC-32.

## 8. Staff inbox, outreach and historical support

### FUNC-SUP-01 — View and search support inbox

Authorized tenant staff see case list with conversation/customer/unit (privacy-minimized for role), issue/urgency, status, owner, last activity, unread/awaiting customer, ticket/incident links and assignment. Filter by assigned queue, status, issue, building, urgency and time window. Search must respect tenant/role and not index hidden transcripts. Active conversation view distinguishes customer messages, Carol messages, tool/action status, delivery state, and staff-only notes.

Do not expose model chain-of-thought. Show concise explanation/evidence references and policy/runbook/model versions appropriate to staff role.

**Map:** NP-CAR-11–13, NP-TKT-01; AC-24–25, AC-29, AC-58.

### FUNC-SUP-02 — Hand over a request to Carol

Authorized staff create a one-subscriber handover, paste/forward original message as context, choose/confirm a registered tenant subscriber, reason, destination and urgency, review a customer-visible message preview and channel/template eligibility, then submit once. Case progression includes awaiting identity confirmation, awaiting approval/template, queued, contacting, awaiting customer, troubleshooting, handoff, resolved or cancelled as applicable.

Carol's opening identifies itself as an AI assistant for the ISP, states that support staff asked for help, gives only the minimum issue summary and asks permission to continue. It never pretends the customer initiated the message. If service window/template/contact basis/consent/suppression/quiet-hours policy blocks contact, create a pending staff task with the reason. A resend/replay is deduplicated. Staff can cancel before send; after WhatsApp accepts it, mark in-flight/delivered and do not promise recall.

**Map:** NP-CAR-12, NP-SEC-04/09; AC-26–28.

### FUNC-SUP-03 — Human takeover and return

Any authorized responder can take over a case, including before Carol escalates. The server atomically increments/claims owner version, stops future AI dispatch, cancels queued but unsent drafts, rechecks ownership at the send boundary, assigns a human and emits a transparent customer notice. If another staff member has already claimed, show the winning owner and do not double-send.

Human replies and internal notes have separate composers, storage permissions and rendering. “Return to Carol” requires a handback summary; the system reloads current messages/evidence/policy versions and rechecks the case owner before it resumes. A disconnected browser never automatically resumes Carol. Record actor/time/reason for view, takeover, handback, notes, delivery and resolution.

**Map:** NP-CAR-11, NP-SEC-04/08; AC-24–25.

### FUNC-SUP-04 — Initiate a staff-to-subscriber inquiry

An authorized staff member starts via authenticated console or an explicitly supported private staff WhatsApp route; verify the staff identity/directory entry and role. Resolve one exact subscriber from that tenant's registry, specify reason and allowed action, preview destination/message and require confirmation when ambiguous. Do not accept arbitrary phone-number targeting, automated marketing, forwarding a group message as authorization or one case as permission to contact other units.

At send time, enforce WhatsApp customer-service window or approved utility template, opt-out/suppression, quiet hours, permitted contact basis, quotas, duplicate suppression and audit. If blocked, surface a staff task rather than sending.

**Map:** NP-CAR-12, NP-SEC-01/09; AC-26–28.

### FUNC-SUP-05 — Import old WhatsApp handset exports

An authorized admin creates an import batch with tenant, source handset/export label, date range/timezone and privacy review record. Parse text/media references from supported exports; report incomplete media separately. Normalize encoding, language, forwarded markers and timestamps; deduplicate overlapping batches while preserving provenance.

Map participants/subscriber only above an approved confidence rule. Ambiguous, unmatched or contradictory identities enter a review queue. Imported events go into a separate, read-only history collection. They cannot contact customers, create a live appointment/ticket as operational work, alter subscriber/device state or be treated as current consent. Original vs normalized text is traceable and access-controlled.

**Map:** NP-HIS-01, NP-SEC-05/07; AC-37–38, AC-41.

### FUNC-SUP-06 — Review support trends and candidate runbooks

Show issue trends by tenant/building/time/issue/language/resolution/escalation and cautious response-time estimates where the source timestamps support them. Report source coverage, missing attachments, uncertain identity and date limitations alongside charts/tables. Do not treat estimated trends as full-ISP truth. Allow admin-reviewed export if entitlement/role/retention permits.

Carol may draft a runbook or policy proposal with references to sanitized sample cases; this remains draft-only until authorized admin tests/publishes it. No automatic model training/fine-tuning or policy activation is authorized.

**Map:** NP-HIS-02, NP-POL-01/03; AC-39–40.

### FUNC-SUP-07 — Apply retention/deletion policy

Provide tenant-configurable retention decisions only after owner/privacy review. Scope policy to live messages, imported messages, media, transcription, caches/search indexes, analytics and backups. Show scheduled expiry/deletion state and legal hold. Report when an item is purged from primary storage but remains in encrypted backup until the approved backup expiry. Do not promise infinite retention or immediate global deletion from all backups until technically verified and policy approved.

**Map:** NP-CAR-13, NP-HIS-01, NP-SEC-07/10; AC-41, AC-65.

## 9. L2 troubleshooting, tunnels and guarded actions

### FUNC-L2-01 — Gather bounded subscriber diagnostics

For a resolved unit, display fresh/unknown state from the permitted source for active incident, DMA account/session, mapped MikroTik PPPoE session and mapped ONT online/optical status. Provide a bounded reachability test; avoid open-ended scans. The diagnostic summary states source, sample time, unit/device association and limitations. Separate `offline`, `not found`, `stale`, `unsupported`, `access denied`, `timeout` and `monitor unreachable`.

The authorized operator may perform supported ping/traceroute/torch/bandwidth diagnostics with explicit target/duration/count/traffic limits and appropriate warning. A bandwidth test is a traffic-generating operation, not an unbounded harmless read.

**Map:** NP-L2-01, NP-AAA-01, NP-NET-01, NP-SEC-02/06; AC-51, AC-54–55.

### FUNC-L2-02 — Establish and close an on-demand site path

For sites needing private access, resolve an opaque site reference; fetch one site’s connection target/OpenVPN credentials from the user's external store at execution time; verify allowlist and approved connection profile; open one site tunnel; perform only requested bounded operations; close on case completion/cancel or idle timeout. Record open/close reason, status and correlation without storing fetched destination/credentials in local tables/logs/AI prompts. Show tunnel state/last-used and error health to authorized staff.

Provide reviewable one-time RouterOS VPN/firewall setup instructions that block WAN management SSH/API and permit those paths only through the private tunnel; do not auto-deploy those rules. OpenVPN is initial choice; WireGuard is optional only if the site's approved record specifies it. Ongoing outage polling/nightly work must not silently turn this into permanent tunnels; design the schedule/sidecar model separately.

**Map:** NP-DAT-04, NP-NET-01, NP-SEC-06; AC-07, AC-54–55.

### FUNC-L2-03 — Prepare/approve a single-target action

For a separately entitled supported action, resolve one tenant/building/subscriber/device/resource/session. Refresh eligibility/account authority, ownership and device status. Render a dry-run showing exact typed action, normalized parameters, effects, pre-state and compensation. Capture authenticated requester and eligible separate approver if required. The approval expires, can be used only for this exact actor/target/action/parameter set, and is rechecked at execution. A changed target or parameter invalidates it.

Mutations possible in planned specific drivers include exact OLT ONT activate/deactivate/reboot; registered GenieACS router reboot/SSID/password change; exact active MikroTik PPPoE session reset; eligible exact MikroTik-local PPPoE account disable/enable/reactivate; and separately approved Huawei account/service-port or session actions only where the owner confirms them and the target harness validates support. DMA itself never mutates. Current existing prompt-only approval does not meet this function.

**Map:** NP-L2-02, NP-SEC-02–04; AC-43, AC-48, AC-50, AC-53, AC-61–62.

### FUNC-L2-04 — Execute and reconcile an action

The executor accepts a typed allowlisted operation, not arbitrary model-generated CLI text. It records start/correlation/pre-state, uses target concurrency/rate limits, idempotency key, finite timeout and cancellation; driver/tool credentials remain outside model context. On clear success, verify post-state and report it in plain language. On explicit rejection, record a failure category. On timeout/connection loss after dispatch, mark `unknown` and reconcile device state before retry; never blindly issue a second reboot/reset.

Report outcome to staff and subscriber only after evidence supports it. Save rollback or compensating-action information where possible. Reboots/sent WhatsApp messages may not be reversible; state that accurately. Stop all actions on role/entitlement revocation, tunnel loss, changed target, circuit breaker or safety conflict.

**Map:** NP-SEC-03–04/08, NP-L2-02; AC-61–63.

## 10. Tickets, incidents, reporting and calendar

### FUNC-OPS-01 — Create/update a case-linked ticket

One support case may create one ticket and repeated messages update it; deduplicate to avoid one ticket per inbound message. Ticket fields include ID, tenant, case/conversation, subscriber/unit/building, issue category/priority, status, assignee/queue, created/updated, evidence links, action/diagnostic links, escalation reason, resolution summary and close/reopen state. Keep the source conversation and ticket identities distinct.

Provide authorized filter/search by status, priority, issue, assignee, building and time. Manual close/reopen and assignment changes are audited. SLA target/clock/pauses and exact reopen rules remain open until supplied.

**Map:** NP-TKT-01; AC-58.

### FUNC-OPS-02 — Daily digest and exception notifications

At an owner-configured schedule/tenant timezone, manager digest summarizes total cases, issue categories, resolved-by-Carol rate, unresolved/open workload and confirmed incidents with source/freshness. Immediate alerts are limited to configured exceptions/action-needed cases and deduplicated; do not alert once per ordinary conversation. Configurable email is the minimum planned path; individual WhatsApp notifications require compliant recipients/templates. Failed delivery is visible/retried within bounds.

Whether every completed endpoint-vendor referral pages staff is open; use a boundary outcome by default, not an automatic alert. Security incidents or provider failures use separately configured operational alerts.

**Map:** NP-TKT-02, NP-OPS-01; AC-58, AC-64.

### FUNC-OPS-03 — Detect and manage a building/PON incident

Run only approved, bounded monitoring/read jobs. Correlate MikroTik/site reachability, OLT/PON/ONT state, session counts and independent health sources. Distinguish “site monitoring path is down” from “subscriber service outage confirmed.” Require configurable building/PON thresholds/windows and data freshness; these values must be owner/vendor agreed.

Incident dashboard shows incident ID, affected site/PON, start/last evidence, confidence, linked tickets/cases, owner, state, updates and closure/verification. Merge duplicate signals and link new cases rather than duplicate incidents. Outage monitoring must honor the on-demand tunnel rule; the permitted schedule/sidecar strategy remains open.

**Map:** NP-OUT-01, NP-AAA-01, NP-OPS-01; AC-59.

### FUNC-OPS-04 — Notify affected subscribers during an incident

Prepare a preview with verified recipient count, building/unit basis, approved template, incident evidence/status, message, rate limit and stop condition. Multi-subscriber sends are R3 and require a separate impact-limited approval; one subscriber's support case never grants broadcast permission. Send a test/canary if approved, then bounded waves with per-message delivery state and cancellation/kill switch. Reconcile duplicates/out-of-order sends and update the incident/ticket trail.

A restoration message requires fresh verification. Do not claim all customers restored based on one router/ping. If no legal/contact basis/template or recipient mapping exists, stop and create a staff task.

**Map:** NP-OUT-01, NP-SEC-02–04/09; AC-60.

### FUNC-APT-01 — Configure the business appointment calendar

Connect one explicitly selected company Google Calendar, not personal calendars by default. Authorized manager configures appointment types, durations, working hours, holidays/blackouts, travel/setup buffers, building/service-area constraints, available technicians/resources and display timezone. Show connection status and last sync. Avoid writing to personal calendars, payroll or route optimization.

The resource/assignment model and multiple staff calendars are open; use only approved calendar/resource scopes.

**Map:** NP-APT-01, NP-TEN-02; AC-56–57.

### FUNC-APT-02 — Offer, book, reschedule and cancel

After exact subscriber/case identity and service intent are confirmed, offer a small set of currently free slots. Recheck availability before commit to handle races. Show exact local date/time/timezone, duration, location and event purpose. Require subscriber confirmation before create/reschedule/cancel. Write an idempotent event linked to subscriber/case/ticket; send a compliant confirmation and store calendar/message delivery states.

For service provider success but WhatsApp failure, and vice versa, show `partial/unknown` and reconcile; never claim booking/notice succeeded without evidence. Customer reschedules/cancels with event identity and intent confirmation. Technician postponement proposes the new slot and apologizes, but the ordering of customer acceptance vs calendar update remains an owner decision. Do not silently finalize a new time.

**Map:** NP-APT-01–02, NP-CAR-12; AC-56–57.

## 11. ISP subscriber sales and NetPilot commercial sales

### FUNC-SALES-01 — Record a new ISP service inquiry

Carol's subscriber-facing flow presents only currently approved ISP service plans/availability and captures chosen plan, building/unit, contact, desired install and consented communication details. A prospect is not a verified existing subscriber; do not reveal current unit occupants. Validate building/coverage from approved tenant data. Create a staff-visible lead/install request with captured values, timestamp, source, conversation link, consent/contact state and status. Notify configured manager once.

Starter vs appointment add-on boundary: without calendar entitlement, create a manual staff scheduling request; do not offer false live availability. Calendar booking requires explicit entitlement. No payment, automated activation, install promise or device provisioning occurs.

**Map:** NP-SAL-01, NP-COM-04; AC-10.

### FUNC-SALES-02 — Record cancellation request and approved retention offer

Resolve/verify the existing tenant subscriber. Confirm cancellation intent once; display only an admin-approved, effective retention option with accurate terms and no pressure loop. Record accept/decline/no-answer, requested effective date if supported, plan/offer version and message outcome. Notify the manager and make a staff task/request.

Do not mark service cancelled merely because a chat request was received. No billing/payment/credit/expiry changes or automatic disconnect/reactivation. Staff completes the authoritative action in its source system.

**Map:** NP-SAL-02, NP-AAA-02; AC-10.

### FUNC-COM-01 — Maintain product catalog and price book

Internal sales admin—not an ISP tenant user—maintains versioned module catalog, dependencies, limits, usage meters, setup fee, recurring fee, allowances, optional usage charges, discounts, tax assumptions, effective dates, validity terms, support/onboarding inclusions and exclusions in MYR. Record versions and who changed them. Do not hard-code prices in app logic or infer tax/legal terms.

Price dimensions include tenant account, seats, buildings, subscribers, managed devices, WhatsApp volume, AI, storage and support as price-book configuration permits. Usage metering definitions and billing are not settled.

**Map:** NP-COM-01–02; AC-08–09.

### FUNC-COM-02 — Assemble and export an ISP-product quotation

Sales admin selects a prospect, package/tier, specific modules/add-ons, quantities/limits, price-book version and onboarding assumptions. Validate prerequisites/conflicts; show what is included, optional, unavailable, one-time fee, recurring estimate, allowances/overage, assumptions, expiration, and exclusions. The quote editor must show that GenieACS, V-SOL and FortiGate are individually optional driver add-ons rather than defaults.

Export a customer-review quote, retain immutable revisions and approval status, and compare revisions. Reject changes that silently mutate an already approved quote; create a new revision and re-approval instead. No online payment/checkout in this scope.

**Map:** NP-COM-01–04; AC-08–09, AC-68.

### FUNC-COM-03 — Provision approved tenant entitlements

After the authorized approval event, translate the exact quote revision into tenant module/driver entitlements and limits once. Preserve relationship to quote/version and audit actor/time. Show provisioning errors/partial state and reconcile safely; do not accept replays as duplicate provisioning. A payment event is not required because payment integration is excluded. Pause when package prerequisites, required source, secure access or hardware are unready.

**Map:** NP-TEN-03, NP-COM-01–03; AC-04, AC-09, AC-68.

## 12. Operations, security, deployment and launch functions

### FUNC-OPS-05 — Show dependency health and service jobs

Authorized operator dashboard distinguishes web/API/database/storage/queue, identity, AI provider/model, WhatsApp, Google Calendar, external subscriber database, DMA, VPN, sidecars and each device driver. Show current/last successful check, latency/error category, freshness, queue depth, pending/retry/dead-letter counts, circuit state and affected tenant scope. Do not expose credentials or subscriber payloads. A valid empty result and failed dependency are different states.

Every accepted inbound message or support request has a durable processing state. Retries are bounded/classified; staff can inspect/reconcile dead letters and incomplete external operations with authorization and audit.

**Map:** NP-OPS-01, NP-SEC-06/09; AC-64.

### FUNC-OPS-06 — Monitor and limit AI, WhatsApp and infrastructure cost

Track usage/cost by tenant/module/provider/time/metric without storing unnecessary conversation content. Display thresholds and notify configured operators before limits are reached. Enforce hard caps according to the approved package/operating policy. If usage is exhausted, refuse or queue work transparently; do not route around entitlement with a different tenant/provider or incur unbounded external calls.

Exact currency conversions, budgets, price-source and cap behavior are owner decisions.

**Map:** NP-TEN-03, NP-OPS-01–02; AC-04, AC-64.

### FUNC-OPS-07 — Back up and restore application data

Encrypt backups of allowed app data, policy versions, audit evidence, conversation metadata/allowed media references, and approved device config snapshots. Track schedules, retention, encryption/integrity, completion/errors and permissions. Test restore into isolated staging and record measured RPO/RTO, integrity and follow-up. Never overwrite production in a restore drill.

Deletion, legal hold and backup expiration must be consistent with approved retention. Agree operational RPO/RTO and provider topology before production.

**Map:** NP-OPS-02, NP-SEC-07/10; AC-41, AC-65–66.

### FUNC-OPS-08 — Deploy to a Malaysian VPS

The planned production host is a Malaysian VPS, but provider, size, DNS/domain, TLS, network and exact cost are unselected. Supply an operator runbook for production topology, supported services, process supervision, firewall, secret injection/rotation, separate dev/staging/prod identities/data/storage, release artifacts, database migration validation, health gates, canary when appropriate, rollback, patching, monitoring, incident access and VPN/sidecar recovery.

No production publish or server provisioning is implied by this specification. Replit-only services require deliberate equivalents/adapters; do not copy Replit secret values into the VPS.

**Map:** NP-DEP-01, NP-OPS-01–02, NP-SEC-10; AC-65–66.

### FUNC-OPS-09 — Stage, pilot, stop and expand

Staging uses synthetic subscribers, sanitized fixtures, approved provider sandboxes/test recipients, test calendar and allowlisted hardware. Start Carol shadow-only, record staff corrections, then small approved staff cohort; next one approved building/subscriber cohort. Measure troubleshooting accuracy, evidence fidelity, wrong-subscriber prevention, escalation precision, duplicates, response times, provider failures and staff override rate.

Provide independent kill switches for Carol sends, each device-action class, outbound bulk alerts and deployment/worker processing. Train staff on handover/manual fallback. Stop expansion if safety/quality gates fail. Wider rollout requires owner review of evidence for the current wave; all-building operation is never an automatic step.

**Map:** NP-PIL-01, NP-SEC-10; AC-67.

## 13. Required common behavior for every integration

Every connector/driver (MikroTik, Huawei, V-SOL, FortiGate, GenieACS, DMA, WhatsApp, Google Calendar, subscriber source, storage, VPN/sidecar) must implement/document:

1. Exact identity/version/capability contract and least-privileged access.
2. Valid/empty/unsupported/stale/unauthorized/malformed/partial/timeout/disconnect/rate-limited outcomes.
3. Sanitized captured fixtures for each supported version; no real subscriber/secret/device dumps in Git.
4. Separate connect/read/write/overall timeouts, cancellation, bounded concurrency, rate limits and finite retries.
5. Mutation idempotency or reconciliation before retry; never blindly repeat a request with unknown outcome.
6. TLS/host identity verification and allowlisted target/port/operation; no arbitrary proxy/scan.
7. Tenant/role/assignment/entitlement checks at the server for web, API, worker, webhook, AI tool and export paths.
8. Correlation across request/case, integration call, approval, result, delivery and audit.
9. Redaction tests for secrets, private addresses, subscriber identifiers and sensitive config.
10. A versioned real provider/device verification checklist before claiming that model/firmware is supported.

## 14. Detailed state and error semantics

### 14.1 General state vocabulary

Use distinct states rather than coercing every failure into `false`, zero, empty list or “success”:

- `healthy`, `degraded`, `unavailable`, `unauthorized`, `unsupported`.
- `fresh`, `stale`, `unknown`, `not registered`, `not remotely manageable`.
- `draft`, `awaiting review`, `published`, `disabled`, `superseded`, `rolled back`.
- `queued`, `running`, `succeeded`, `failed`, `cancelled`, `unknown/reconciling`.
- `pending approval`, `denied`, `expired`, `in flight`, `sent`, `delivered`, `read`, `failed` where provider gives the evidence.

States may be renamed in implementation, but semantic distinctions and user explanations must remain. A timeout is not a negative device result. Missing data is not zero. A scheduled job is not complete. A WhatsApp-accepted send is not necessarily delivered.

### 14.2 Human-readable errors

Every UI, Carol or staff API outcome should state what was attempted, whether it completed, what evidence is available, and what safe next step is allowed. Do not include raw stack traces, private keys, auth headers, full device command secrets or another tenant's details. Give staff a correlation ID and support-friendly error classification.

### 14.3 Destructive actions

Create/edit/delete, disable/enable, expire/reactivate, cancel/reschedule, purge, restore and send are distinct operations. A cancel request is not completed cancellation until the authoritative system confirms it. Never collapse a request into a state change on the subscriber's behalf if that requires external billing/service authority.

## 15. What this specification deliberately does not decide

The developer should not choose silently on:

- Exact database/source API/schema and field ownership.
- Package entitlement/price counts beyond the explicit proposed matrix.
- Starter installation booking without a paid calendar entitlement.
- Subscriber/staff verification and separation-of-duties combinations.
- Message/history retention, legal holds, deletion deadlines and provider region.
- Current WhatsApp service-window/template/contact-basis rules.
- Current model names/availability, audio/vision capability, transcription vendor or cost.
- Real hardware CLI/API parameter paths, firmware compatibility, speed/optical thresholds.
- DMA capabilities/schema/accounting semantics beyond read-only allowlisted data.
- Site tunnel lifetime/monitoring architecture for recurring polling/backups.
- Ticket/SLA thresholds, outage correlation windows, manager alert criteria and operational budgets.
- Malaysian production provider, infrastructure size, RPO/RTO, service targets and final cost.
- Final NetPilot sales price book, tax/legal contract values, or paid usage caps.
- Whether raw redacted device command transcripts belong in staff inbox/history.
- Deferred archived ideas such as optical degradation campaigns, satisfaction surveys, generalized FAQ editor, temporary service extensions or online payments.

For each unresolved item, present a concise question with a recommended safe default, describe its product/price/safety consequence, and wait for the owner's answer before implementing the affected function.

