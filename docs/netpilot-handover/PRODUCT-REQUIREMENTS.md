# Product Requirements

## 1. Purpose and boundaries

**NP-PRO-01 · Selected · Sources S-45, U-NAME, U-SCOPE**

NetPilot is a secure, modular, multi-tenant ISP operations platform. It should reduce manual subscriber support, connect support cases to reliable network evidence, coordinate staff work, and provide controlled device operations. The initial business context includes Malaysian ISPs, condominium buildings, roughly 80 or more sites in the source plans, and English, Malay, and Chinese support. Site count is context, not an approved capacity limit.

“Router Control” and “RouteManager” appear in legacy plans. NetPilot is the product name; RouteManager refers to the planned L2 automation component, not a separate new product. Existing package names and directories must not be renamed indiscriminately.

The owner has approved documentation now, not app construction. This specification defines future implementation.

**NP-PRO-02 · Planned · Sources S-45, S-39**

Primary roles are platform operator, internal sales administrator, ISP tenant administrator, senior customer-service manager, support agent, senior technician/consultant, network operator, read-only staff, and subscriber/prospect. One person can hold several explicitly assigned capabilities. Existing device-manager roles do not by themselves implement this target model.

| Role | Intended access | Important restriction |
|---|---|---|
| Platform operator | Provision tenants, service health, entitlement administration | No implicit unrestricted reading of all customer messages |
| Sales administrator | Module catalog, price book, quotations, approved provisioning | No network actions or subscriber-history access by default |
| ISP administrator | Own tenant settings, memberships, integrations, policies | Cannot edit platform safety or access another tenant |
| Senior CS manager | Publish runbooks/policies, review quality and escalations | No device permission created by policy prose |
| Support agent | Assigned cases, subscriber lookup, handover, takeover, appointments | No unrestricted command execution |
| Senior technician/consultant | Scoped diagnostics, support outreach, eligible approvals | Identity and exact-target permission required |
| Network operator | Scoped device reads and approved mutations | Independent approval and risk limits still apply |
| Read-only staff | Explicitly permitted views/exports | Cannot mutate or acknowledge as a writer |
| Subscriber/prospect | Own support or commercial request | No staff operations; no access to another unit |

This role table is a proposed capability decomposition of the saved roles; final approver combinations and manager visibility require owner confirmation.

## 2. Platform, tenancy, and entitlements

**NP-TEN-01 · Planned · Source S-45**

Every tenant-controlled record and operation must belong to exactly one ISP. Membership determines the active tenant on the server. A browser-supplied tenant ID is never sufficient authorization. Enforce this on API calls, workers, webhooks, AI retrieval, caches, exports, storage paths, device operations, and notifications.

**NP-TEN-02 · Planned · Source S-45**

Provide tenant-specific branding, timezone, default language, office hours, support contacts, staff membership, subscriber sources, integration connections, device connectivity, AI models, policy versions, retention, and usage limits.

**NP-TEN-03 · Planned · Source S-45**

Modules declare prerequisites, capabilities, limits, meters, navigation, API permissions, and commercial metadata. Server enforcement must cover UI, direct API access, workers, webhooks, AI tools, exports, and storage consumption. Hiding a menu is not enforcement. Suspension preserves data under an explicit retention/export/deletion policy; reactivation must not corrupt history.

## 3. Subscriber and building data

**NP-DAT-01 · Planned · Source S-24**

The primary subscriber source is an external cloud database maintained by the user. Its exact engine, schema, query contract, and live-query versus sync approach are open. Provide source configuration, on-demand refresh, scheduled refresh if selected, health information, and a per-import report. Use least privilege; do not modify the upstream database unless separately approved.

**NP-DAT-02 · Planned · Source S-24**

Support a secondary Google Sheets/workbook/CSV bulk-import path. Normalize casing, dates, and identifiers. Idempotent imports add new records and update matching records without silently duplicating units. Show success, skipped, flagged, and failed rows with reasons, including blanks, malformed serials, invalid dates, missing unit numbers, and non-residential rows.

**NP-DAT-03 · Planned · Sources S-24, S-27**

Represent tenant, building, unit, subscriber/account, service plan/status, PPPoE ID, ONT/GPON serial, WiFi SSID/MAC, installation/cabling metadata, remarks, and device associations. Condo plus unit is a lookup key within a tenant, not proof of ownership. Keep ambiguous matches for review. Secret fields in spreadsheets must enter secure credential handling, not ordinary profile text.

**NP-DAT-04 · Selected constraint · Source S-27**

Site public management destinations and OpenVPN credentials are fetched on demand from the user's external credential database and are not persisted in the NetPilot database. Keep opaque site/device references and safe audit metadata locally. Distinguish subscriber-data ingestion from site-credential retrieval. Older plans that propose storing IPs/passwords locally conflict with this later constraint; see open decisions.

## 4. Existing device-manager baseline

**NP-DEV-01 · Code present; preserve and revalidate · Sources S-CODE, S-2**

Retain MikroTik connection, status/dashboard, interfaces, IP addresses, firewall, DHCP, wireless, terminal, saved profiles, and staff AI-assistant flows. Current transport code includes RouterOS API/API-SSL, REST variants, and SSH. Production defaults must require secure approved paths; do not silently downgrade to cleartext or weaken certificate verification.

**NP-DEV-02 · Code present; preserve and revalidate · Sources S-CODE, S-2–S-7**

Retain Huawei SmartAX support including connection, OLT dashboard, ONTs, optical/status information, service ports, alarms, raw staff terminal/AI interaction, local operator accounts and password rules, configuration capture, and snapshot-related UI. Verify exact EA5801E/EA5800 hardware and firmware compatibility using approved fixtures/hardware. Existing code uses a Node SSH adapter; planned Netmiko adoption is not already complete.

**NP-DEV-03 · Code present plus planned refinements · Sources S-6, S-10, S-13–S-18, S-19–S-21**

Preserve live/historical OLT login views, filtering, CSV export, suspicious-login detection, acknowledgements, shared filter behavior, and large export handling. Extend to:

- Configurable sign-in failure threshold, window, lookback, business hours, and timezone.
- Deduplicated outbound notifications with configurable recipients; email is the minimum planned channel, push/webhook optional.
- Dismissal attribution and time; acknowledgement history with a link to corresponding login rows.
- Explicit read/export versus purge/acknowledge permissions.

Existing historical defaults in plans are five failures in ten minutes, a 24-hour lookback, and 06:00–22:00 server-time business hours. These are legacy defaults, not approved universal production policy.

**NP-DEV-04 · Planned extension · Sources S-8, S-9, S-42**

Provide tenant/device-scoped archive list, preview, download, retention, and integrity status. Scheduled OLT backups use per-profile enablement and selected hour/timezone, durable scheduling, duplicate prevention, and failure visibility. Restore and deletion are separately guarded actions, not ordinary reads. Optional restoration mechanisms require vendor validation and owner approval; “save config” can change device state and must not be disguised as an R1 read.

## 5. Additional drivers

**NP-VSO-01 · Planned · Source S-25**

Support V-SOL V1600G0-B/G1-B/G2-B variants explicitly: uptime/version, PON state, alarms, ONT discovery, exact serial mapping, optical Rx/Tx dBm, and online state. Model-specific parsing must use actual sanitized CLI evidence; Huawei fixtures are not a substitute.

**NP-VSO-02 · Planned · Sources S-25, S-39**

Expose exact-ONT activate/deactivate/reboot only through guarded operations. The plan proposes a Python Netmiko sidecar, initially a generic SSH channel plus custom V-SOL parsing. Check the current Netmiko driver catalog before implementation; do not assume an old “no native driver” claim remains true. WAN Telnet is not permitted.

**NP-FGT-01 · Planned · Source S-30**

Add FortiGate vendor selection, model/FortiOS/uptime/HA/CPU/memory, interface status, policy list, session count, VPN status, and full on-demand configuration backup. Prefer authenticated HTTPS REST with a restricted API identity; use approved SSH fallback only where needed. Match actual FortiOS versions and capabilities. Audit access and backups.

FortiGate configuration edits, other firewall vendors, and automatic scheduled FortiGate backups are not included in this initial driver scope.

**NP-ACS-01 · Planned · Source S-31**

Use GenieACS rather than building an ACS. Supply deployment/configuration guidance for the user-provided server, its required database, TLS, connection-request authentication, and TP-Link TR-069 onboarding. Confirm EX141 hardware/firmware and provider-specific parameter names with at least one registered test router.

Show subscriber-linked router online state, last contact, uptime, WAN state, SSID, connected-device count/signal where actually available. Distinguish stale last-inform data from live state. Unsupported or unregistered devices show “not remotely manageable,” not fabricated success.

**NP-ACS-02 · Planned · Sources S-31, S-39**

Authorized staff/Carol may request scoped reboot or WiFi SSID/password changes on ISP-managed registered routers with confirmation, server approval, task-status reconciliation, pre/post checks, and audit. Do not disclose WiFi secrets in routine transcripts or dashboards. Customer-owned phone/TV/laptop setup remains out of scope.

Bulk firmware campaigns, provisioning-template management, and field router preconfiguration are excluded from the initial ACS implementation; field work receives instructions only.

## 6. AAA and guarded L2

**NP-AAA-01 · Selected read-only boundary; implementation planned · Source S-32**

DMA Softlab Radius Manager remains authoritative for account/billing/AAA decisions. Discover its installed version, API transport/functions, schema, licensing, accounting behavior, and capability set. Prefer documented read operations; use a separate read-only MySQL identity with bounded parameterized queries only where necessary.

Show PPPoE session state, start time, assigned IP, usage, enabled/disabled state, plan, expiry/remaining allowance, and recent authentication outcomes where supported; provide per-building aggregates. Label timestamps, source, stale/unknown/unsupported states. Missing accounting stop records do not prove a subscriber is online.

**NP-AAA-02 · Selected · Sources S-32, S-27**

No DMA account creation/edit/delete, plan/expiry changes, credit/refill, enable/disable, suspension/reactivation, PoD/CoA/disconnect, or SQL writes. Enforce a read-only allowlist even if a credential could do more. Do not bypass a DMA-disabled, expired, depleted, or blocked account through MikroTik. Escalate account problems to authorized staff.

**NP-L2-01 · Planned · Sources S-27, S-39**

For one verified subscriber/unit, combine live PPPoE/session, ONT optical/state, reachability, and available managed-router evidence. Bound ping/traceroute/torch/bandwidth tests; classify their load and impact rather than assuming every diagnostic is harmless. Report evidence in plain language.

**NP-L2-02 · Planned · Sources S-27, S-39**

Possible actions are exact ONT/router reboot, exact active MikroTik session reset, or exact MikroTik-local account disable/enable/reactivation where eligible. Verify subscriber ownership, account authority, role, entitlement, target, action parameters, explicit confirmation, rate limits, idempotency, pre/post state, and audit. A local account action must never become a Radius Manager bypass.

**NP-NET-01 · Selected · Sources S-27, S-40**

Use on-demand per-site VPN, OpenVPN as the user's stated initial choice, WireGuard optional when supported by that site's record. Do not expose site SSH/API ports publicly or assume permanent tunnels. Fetch connection details temporarily, open only the required site route, execute bounded work, close on completion/cancellation/resolution, and enforce idle timeout. Generate reviewable RouterOS setup guidance, not automatic deployment.

Sidecars require identity, mutual authentication, encrypted transport, rotation/revocation, health, allowlisted destinations/ports, bounded retries, concurrency caps, and resistance to arbitrary proxying/DNS rebinding/cross-building access. Continuous outage monitoring and nightly backups must respect this on-demand rule; their access strategy is an open decision.

## 7. Support operations and commercial journeys

**NP-TKT-01 · Planned · Source S-28**

Create/update a case-linked ticket with issue category, priority, status, ownership, resolution, diagnostic/action links, and timeline. Provide filters and manager views. Distinguish conversation, case, and ticket so one repeated message does not create duplicate tickets. Exact reopen rules and SLA thresholds need approval.

**NP-TKT-02 · Planned · Source S-28**

Manager reporting includes scheduled daily digest of volume, AI-contained cases, unresolved cases, and service issues. Immediate notifications are exceptions, not every chat. Deduplicate and route through configured email and compliant one-to-one WhatsApp recipients. A simple endpoint-vendor referral that completes the runbook should not automatically page staff; older “all out-of-scope” alerts need clarification.

**NP-OUT-01 · Planned · Sources S-28, S-39**

Detect building/PON incidents from permitted reachability and correlated ONT/session signals. Distinguish unreachable monitoring infrastructure from confirmed customer outage. Link affected cases to an incident, suppress duplicate warnings, display incident status, and provide staff-reviewed restoration updates. Thresholds, detection schedule, and mass-notification approval are open.

Multi-subscriber outage messages require a separately approved impact-limited workflow with recipient verification, WhatsApp templates/contact basis, suppression, audit, and stop controls. A single-customer outreach permission never authorizes broadcast.

**NP-APT-01 · Planned · Source S-41**

Use one explicitly selected tenant company Google Calendar. Configure appointment types/durations, business hours, blackouts, buffers, buildings, and staff/resource availability. Offer valid slots and confirm before create/reschedule/cancel. Record exact calendar/event/subscriber/case links; ensure concurrency-safe booking and idempotency.

**NP-APT-02 · Planned; conflict noted · Sources S-41, S-26**

Support technician postponements with polite subscriber notice, proposed time, acceptance/alternative handling, and staff delivery status. The order of final calendar change versus subscriber reconfirmation conflicts in older plans; do not silently choose. Reconcile partial calendar/message failure. Personal calendar writes, payroll, and route optimization are excluded.

**NP-SAL-01 · Planned · Source S-29**

Prospects can choose an approved service plan, give building/unit/contact, and book installation where offered. Create a lead/installation record and notify the manager. Prospects are not yet verified subscribers; never expose existing occupants' information.

**NP-SAL-02 · Planned · Source S-29**

Cancellation requests confirm intent, offer an approved bounded retention option, and create a staff action with manager notice. Do not pressure a customer indefinitely or claim service has been cancelled when it has only been logged. Payments, billing changes, and automatic activation/deactivation are not included.

## 8. Commercial product packaging

**NP-COM-01 · Selected packaging; planned system · Source S-45**

Initial module catalog: Platform Core; Network Device Manager; Additional Device Drivers; AAA & Subscriber Visibility; Carol AI Customer Service; Carol Policy Studio (Runbook & Policy Management); Guarded Network Automation; Ticketing & Escalation; Appointments; Security & Compliance; Backup & Recovery; Operations & Analytics.

| Tier | Initial bundle |
|---|---|
| Starter ISP | Core tenant/users/buildings/subscribers/imports/audit; standard MikroTik/Huawei manager; basic supported AAA visibility; Carol, runbooks/policies, official WhatsApp, multilingual text/photos/voice-note understanding with written replies; history/shadow/human handoff/model selection |
| Operations Pro | Private connectivity; deeper multi-vendor diagnostics; V-SOL/FortiGate/GenieACS as selected add-ons; tickets/outages/appointments/backups/operations views; eligible approved single-target actions |
| Enterprise / Custom | Guarded custom/broader automation; custom integrations; multiple sites/HA/dedicated infrastructure; advanced compliance/retention/reporting; bespoke limits, migration, SLA/support and rollout |

All customers start with Starter ISP. Modules remain independently metered and enforced, including driver add-ons. Security is mandatory in every tier: Enterprise must not be required for baseline isolation, safe approval, or privacy. Bundle contents, limits, and commercial prices remain configurable. Basic human handoff is included even if advanced ticketing is an upgrade.

**NP-COM-02 · Planned · Source S-45**

Provide a versioned MYR price book: setup/monthly fees, allowances, optional usage charges, discounts, taxes, effective dates, and dimensions for tenants/seats/buildings/subscribers/devices/WhatsApp/AI/storage/support. A sales admin assembles a valid package with prerequisites; exports a quotation with inclusions, exclusions, assumptions, validity, one-time cost, and estimated recurring cost; saves revisions; and converts explicit approval into entitlements without re-entry. Final prices, tax rules, and contractual SLAs remain open.

Automatic charging/payment checkout and public self-service ISP signup are excluded pending separate approval.

## 9. Reliability, deployment, and presentation

**NP-OPS-01 · Planned · Source S-42**

Health dashboards distinguish API/web/database/storage/queue/AI/WhatsApp/calendar/VPN/sidecar/device failures. Use redacted correlated logs, finite retries, queue and error metrics, alert ownership/severity/deduplication/maintenance windows, and usage/cost/capacity limits. Accepted inbound messages survive provider outages; unsafe actions fail closed.

**NP-OPS-02 · Planned · Sources S-42, S-43**

Encrypt and retain backups of application data, policy versions, audit, conversation metadata, and permitted configurations. Test integrity and staging restore. Agree recovery-point/recovery-time targets. Keep development, staging, and production identities/data/secrets/storage separate.

**NP-DEP-01 · Planned · Source S-43**

The planned target is a Malaysian VPS with explicit network/security topology, TLS/DNS, supervision, secrets injection/rotation, repeatable releases, migration checks/backups, health gates, rollback, monitoring, patching, scaling, and incident access. Do not assume Replit-managed runtime services transfer automatically to that VPS.

**NP-PIL-01 · Planned · Source S-44**

Use synthetic staging, approved test recipients/calendar/hardware, model shadow evaluation, a small staff pilot, one approved building/cohort, and phased rollout. Require safety/quality evidence and owner approval before live expansion. Staff must be able to pause Carol, stop mutations, take over, and recover.

**NP-BRD-01 · Selected name; deck update still planned · Source S-47**

The existing business proposal is a separate ten-slide PPTX/deck asset. Its NetPilot rename is separately planned; do not change the deck, app packages, routes, or visual theme as a side effect of implementing this handbook.

