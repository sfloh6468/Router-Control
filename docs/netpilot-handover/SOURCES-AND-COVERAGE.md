# Sources, Coverage, and Completeness

## 1. What was available

The author re-read the full descriptions of all 48 project task records, inspected the saved source plans most relevant to NetPilot, reviewed the safety harness, and inspected a bounded set of application files and package manifests. This coverage audit was performed on 28 November 2026.

Sources are dated by content, not guaranteed current vendor facts. Some task text was written months before this handbook. The available conversation includes a compacted earlier summary, not every original message.

### Source identifiers

- `S-24` means the current project task titled **Subscriber & building data foundation**.
- Other numbered sources follow the mapping below. Number references are provenance only; copied handbooks do not require a live task service.
- `S-HARNESS` means the inspected **Router Control Engineering Harness** specification in `docs/router-control-harness.md`.
- `S-CODE` means the code inventory and scoped reads described in the implementation-status chapter.
- `U-...` means explicit available conversation decisions, paraphrased below without private identifiers.

No production data, private credentials, raw customer chat, device configuration dumps, external databases or account secrets were inspected or included to draft this package.

## 2. Core roadmap source mapping

The requirement text is portable in these chapters; source paths are optional traceability for someone who also has the repository. A missing `.local/tasks` directory on GitHub does not make the handbook unusable.

| Source | Source title / available plan | Covered requirement families | Acceptance cases |
|---|---|---|---|
| S-24 | Subscriber & building data foundation; `.local/tasks/isp-data-foundation.md` | NP-DAT-01–04, NP-TEN-01 | AC-02, AC-05–07 |
| S-25 | V-SOL OLT driver (V1600G); `.local/tasks/vsol-olt-driver.md` | NP-VSO-01–02, NP-NET-01 | AC-48, AC-54–55 |
| S-26 | WhatsApp L1 support chatbot; `.local/tasks/whatsapp-l1-chatbot.md` | NP-CAR-01–13, NP-POL-01–03, NP-AI-01–02, NP-HIS-01–03 | AC-11–41 |
| S-27 | L2 automation bridge (RouteManager); `.local/tasks/l2-automation-bridge.md` | NP-L2-01–02, NP-NET-01, NP-DAT-04, NP-AAA-02 | AC-07, AC-53–55, AC-61–62 |
| S-28 | Ticketing, manager reporting & outage alerts; `.local/tasks/ticketing-escalation-outage.md` | NP-TKT-01–02, NP-OUT-01 | AC-58–60 |
| S-29 | WhatsApp subscription & unsubscription flows; `.local/tasks/whatsapp-sales-flows.md` | NP-SAL-01–02 | AC-10 |
| S-30 | FortiGate firewall driver (monitor + config backup); `.local/tasks/fortigate-driver.md` | NP-FGT-01 | AC-49 |
| S-31 | TR-069 subscriber router management (GenieACS); `.local/tasks/tr069-subscriber-router-management.md` | NP-ACS-01–02, NP-COM-03 | AC-50, AC-69 |
| S-32 | DMA Softlab Radius Manager AAA integration; `.local/tasks/freeradius-integration.md` | NP-AAA-01–02 | AC-51–53 |
| S-39 | Deterministic authorization, approval & audit foundation; `.local/tasks/deterministic-authorization-audit.md` | NP-SEC-01–09, NP-L2-02 | AC-02, AC-31, AC-43, AC-60–63 |
| S-40 | Private network connectivity & device sidecar; `.local/tasks/private-network-connectivity-sidecar.md` | NP-NET-01, NP-SEC-06 | AC-54–55 |
| S-41 | Google Calendar appointments; `.local/tasks/google-calendar-appointments.md` | NP-APT-01–02 | AC-56–57 |
| S-42 | Operations, observability, backup & recovery; `.local/tasks/operations-observability-recovery.md` | NP-OPS-01–02, NP-SEC-10 | AC-64–65 |
| S-43 | Malaysian VPS production deployment; `.local/tasks/malaysia-production-deployment.md` | NP-DEP-01 | AC-66 |
| S-44 | Integrated staging, pilot & launch; `.local/tasks/integrated-pilot-launch.md` | NP-PIL-01 | AC-67 |
| S-45 | Multi-tenant modular ISP product platform; `.local/tasks/multi-tenant-modular-product-platform.md` | NP-PRO-01–02, NP-TEN-01–03, NP-COM-01–04 | AC-01–04, AC-08–09, AC-68 |
| S-47 | Rename proposal to NetPilot; `.local/tasks/rename-router-control-proposal.md` | NP-BRD-01 | AC-01 |

Core tasks were drafts when inspected. Their presence is evidence of planned scope, not evidence of implemented capability.

## 3. Existing baseline and outstanding refinements

| Source | Meaning for handover | Coverage |
|---|---|---|
| S-2–S-7 | Merged Huawei support, OLT user/password management, config capture, browser verification, login view and device verification records | NP-DEV-01–02; source inventory; AC-42–43 |
| S-10–S-14 | Merged permanent login history, MikroTik connect tests, vendor-switch reset, suspicious login alerts and CSV export records | NP-DEV-01–03; AC-42, AC-44–45 |
| S-16–S-18 | Merged JSON/CSV filtering parity, export streaming and export-contract tests | NP-DEV-03; AC-44 |
| S-8 | Draft snapshot browser/download with optional restore/delete | NP-DEV-04; AC-46–47; existing snapshots page means implementation scope needs reinspection |
| S-9 | Draft nightly per-profile backup schedule | NP-DEV-04; AC-46 |
| S-19 | Draft outbound suspicious-login notification | NP-DEV-03; AC-45 |
| S-20 | Draft threshold/window/lookback/business-hours/timezone settings | NP-DEV-03; AC-45 |
| S-21 | Draft acknowledgement attribution/history/deep links | NP-DEV-03; AC-45 |
| S-23 | Draft admin route typecheck repair | Implementation status / OQ-27; no repair performed |
| S-37, S-HARNESS | Merged engineering safety documentation, not runtime authorization | NP-SEC-01–10 and roadmap safety gates |
| S-CODE | Inspected routes, schemas, driver inventory, UI page inventory and scripts | Implementation status; acceptance cases distinguish code presence from verified behavior |

Merged task labels are historical metadata, not fresh proof that those journeys pass. Full descriptions of older merged tasks were not all re-fetched; related source inventory and current code were used for baseline scoping. Do not infer that every old UI detail is exhaustively reconstructed.

## 3. Full task and planning-record audit

The following ledger inventories all 48 project task records available during the 28 November 2026 documentation re-evaluation. “Archived suggestion” describes its task-list state only; it does **not** prove the owner explicitly rejected it. Historical status is provenance, not product entitlement or proof of runtime behavior.

| Source | Planning record | Treatment in this handbook |
|---|---|---|
| S-1 | Live agent BGP operator for CCR1072 | One-off live network-operation plan, not an app feature or permission to operate production. Excluded; no BGP browser/operations feature implied. |
| S-2 | Add Huawei OLT (EA5801E) support | Existing Huawei baseline and device-manager UI; preserve and revalidate. NP-DEV-02; AC-42–43. |
| S-3 | Manage Huawei OLT users and password rules | Existing operator/account policy capability; security and admin boundary in NP-DEV-02/SEC. Revalidation required. |
| S-4 | Save and apply OLT config snapshots | Existing/manual snapshot behavior distinguished from planned schedule, browser, restoration, and deletion. NP-DEV-04; AC-46–47. |
| S-5 | Huawei OLT end-to-end tests | Historical baseline verification evidence only; not a current passing result. AC-42; current tests must be run in a later authorized build task. |
| S-6 | Show OLT user login history | Live/historical login and active-session behavior in the existing baseline; force-logout remains a consequential device action. NP-DEV-02–03; AC-43–45. |
| S-7 | Confirm OLT user changes against a real device | Real firmware/device verification need; source does not prove this handbook's current hardware behavior. AC-43. |
| S-8 | Browse and restore archived OLT snapshots | Planned browse/download; restore/delete are optional and separately authorized, firmware-sensitive operations. NP-DEV-04; AC-46–47. |
| S-9 | Schedule automatic nightly OLT backups | Per-profile enablement, hour/timezone, durable scheduler and visible failure. NP-DEV-04; AC-46. |
| S-10 | Keep a permanent record of OLT login history | Login/logout/failure retention and live-versus-stored views; retention and purge permissions remain policy-controlled. NP-DEV-03; AC-44. |
| S-11 | Verify the MikroTik connect flow | Existing baseline tests and vendor-specific forms; status was not freshly tested for this handbook. NP-DEV-01; AC-42. |
| S-12 | Switching vendors resets the connect form | Preserve correct transport/port reset behavior across vendor switch. NP-DEV-01–02; AC-42. |
| S-13 | OLT login alerts when failed sign-ins spike | Suspicious-pattern alerts and acknowledgement. NP-DEV-03; AC-45. |
| S-14 | Export OLT login history to CSV | Filtered audit export with safe CSV handling and no accidental data leakage. NP-DEV-03; AC-44. |
| S-15 | Stabilize parallel connect-screen E2E suite | Historical test-reliability issue, not product functionality; current suite status unverified. IMPLEMENTATION-STATUS. |
| S-16 | Share JSON and CSV history filters | Keep on-screen and exported history aligned. NP-DEV-03; AC-44. |
| S-17 | Stream very large history exports | Bounded memory/backpressure for large audit exports. NP-DEV-03; AC-44. |
| S-18 | Test CSV export contract | Authentication, filter parity, quoting, injection safety, encoding, and filename behavior. NP-DEV-03; AC-44. |
| S-19 | Notify admins of sign-in alerts | Deduplicated configurable recipients; email minimum, other channels contingent on approval/provider. NP-DEV-03; AC-45. |
| S-20 | Configure suspicious sign-in thresholds | Owner/tenant-configurable threshold, rolling window, lookback, hours and timezone; old values are examples only. NP-DEV-03; AC-45. |
| S-21 | Show alert dismissals and acknowledgers | Actor/time/history and link to matching login rows. NP-DEV-03; AC-45. |
| S-22 | Make E2E tests stable across copy edits | Engineering-test robustness, not a user-facing function; current condition unverified. IMPLEMENTATION-STATUS. |
| S-23 | Fix admin user-management compile failure | Known backlog issue requiring baseline verification; not represented as fixed here. IMPLEMENTATION-STATUS; OQ-27. |
| S-24 | Subscriber & building data foundation | External subscriber source, import fallback, building/unit/plan/PPPoE/ONT/router mapping and row-level reports. NP-DAT-01–04; AC-02, AC-05–07. |
| S-25 | V-SOL OLT driver | V1600G versions, PON/ONT/optical reads and guarded exact-ONT actions; actual CLI evidence required. NP-VSO-01–02; AC-48. |
| S-26 | WhatsApp L1 support chatbot | Full Carol direct-channel operations, policies, case history, guided support, handover and human takeover. NP-CAR-01–13, NP-POL-01–03, NP-AI-01–02; AC-11–41. |
| S-27 | L2 automation bridge (RouteManager) | Exact-subscriber ISP diagnostics, private path, permitted device operations and strict DMA authority checks. NP-L2-01–02, NP-NET-01; AC-07, AC-53–55, AC-61–62. |
| S-28 | Ticketing, manager reporting and outage alerts | Tickets, daily digest, exception notices, correlated outage and reviewed proactive notices. NP-TKT-01–02, NP-OUT-01; AC-58–60. |
| S-29 | Subscriber subscription / unsubscription WhatsApp flows | ISP-to-subscriber lead/install/cancellation requests, approved retention prompts and staff follow-up; no billing/provisioning writes. NP-SAL-01–02; AC-10 and NP-COM-04. |
| S-30 | FortiGate monitor and config backup | Read-only health/status/policy/session/VPN monitoring and on-demand backup; no initial config changes. NP-FGT-01; AC-49. |
| S-31 | TR-069 subscriber router management (GenieACS) | Use a user-provided/existing ACS for registered supported routers; monitoring and separately guarded actions. Optional Operations Pro driver add-on, not Starter default. NP-ACS-01–02, NP-COM-03; AC-50, AC-69. |
| S-32 | DMA Softlab Radius Manager AAA integration | Version/capability discovery, bounded read-only account/session/auth data and building aggregates; no DMA mutations. NP-AAA-01–02; AC-51–53. |
| S-33 | Nightly optical health scan and degradation alerts | Archived feature proposal; deliberately not included in the current promised scope. Reconfirm thresholds, monitoring access and schedule before adding. |
| S-34 | Post-resolution satisfaction surveys | Archived feature proposal; not included in current baseline. |
| S-35 | Admin-edited Carol FAQ / pricing / coverage knowledge base | Archived feature proposal, distinct from versioned commercial price book. Carol must not invent pricing; confirm whether a separate subscriber FAQ module is desired. |
| S-36 | Live customer-service console and device sessions | Conversation monitoring/takeover is included because it was later explicitly requested; full raw command/response device-session transcript viewer remains undecided. NP-CAR-11; OQ-31. |
| S-37 | Engineering safety harness | Existing project guidance used to shape risk controls and implementation evidence; does not prove corresponding runtime controls are implemented. NP-SEC-01–10. |
| S-38 | Temporary subscriber service extensions | Archived feature proposal, not approved for implementation. Do not enable under the strict DMA read-only boundary. Any future request requires a separate authoritative-AAA design and explicit owner approval. |
| S-39 | Deterministic authorization, approval and audit | Mandatory safety foundation before live AI/device actions. NP-SEC-01–10; AC-02, AC-31, AC-43, AC-60–63. |
| S-40 | Private connectivity and device sidecar | Allowlisted private access, revocation, health and bounded jobs; no public device endpoints or arbitrary scans. NP-NET-01; AC-54–55. |
| S-41 | Google Calendar appointments | Authorized business calendar, exact confirmed bookings/changes and reconciliation. NP-APT-01–02; AC-56–57. |
| S-42 | Operations, observability, backup and recovery | Provider/queue/device health, redacted evidence, cost monitoring, backup/restore drills and recovery targets. NP-OPS-01–02; AC-64–65. |
| S-43 | Malaysian VPS deployment | Planned independent production environment with isolation, TLS, migrations, supervision and rollback. NP-DEP-01; AC-66. |
| S-44 | Staging, pilot and launch | Test recipients/devices, shadow mode, small approved cohort/building, measured gates and stop/rollback controls. NP-PIL-01; AC-67. |
| S-45 | Multi-tenant modular ISP product platform | Tenants, isolation, 12 modules, Starter/Pro/Enterprise packaging, price book, quotations and entitlement provisioning. NP-PRO-01–02, NP-TEN-01–03, NP-COM-01–04; AC-01–04, AC-08–09, AC-68. |
| S-46 | Online package approval and payment | Archived follow-up proposal; online checkout, subscription billing and payment handling are excluded unless separately approved. |
| S-47 | Rename proposal to NetPilot | Branding choice is recorded, but the separate ten-slide proposal/deck update is not part of this documentation package. NP-BRD-01; AC-01. |
| S-48 | Prepare NetPilot handover for DeepSeek | This documentation scope only; no app construction, repository access grant, deployment or live operation. |

### Additional older suggestions

The task list contains archived BGP live-operation, test stabilization/copy robustness, optical-scan, satisfaction survey, FAQ knowledge-base, live console, temporary extension and payment suggestions. Archival alone does not prove the user rejected them.

- Do not automatically reinstate old live BGP operations, surveys, generic FAQ editors, optical campaigns, extension actions or payment checkout.
- Live transcript/takeover is included because the user explicitly requested it later, not because an archived suggestion is assumed active.
- Runtime policy examples about temporary service extensions do not authorize a DMA write or implement an extension feature.
- Confirm genuinely desired additions separately; they are not promised in this handbook.

The explicit Telegram rejection is based on the conversation, not inferred from task status.

## 4. Conversation decision coverage

| Reference | Available user direction | Where preserved |
|---|---|---|
| U-NAME | Selected NetPilot instead of Router Control | NP-PRO-01, NP-BRD-01, D-01 |
| U-SCOPE | Carol makes sure ISP link/speed OK, no cross-discipline endpoint troubleshooting; phone/TV examples | NP-CAR-01–02, WF-03, AC-14–17 |
| U-ADMIN | Admin customization of runbook/policy management | NP-POL-01–03, WF-07, AC-30–32 |
| U-SOUL | Asked about SOUL.md; assistant suggested controlled persona/charter | NP-CAR-04 marked recommendation, not silently approved |
| U-HANDOVER | Staff forward requests; Carol proactively contacts subscribers | NP-CAR-12, WF-05, AC-26–28 |
| U-HISTORY | Asked about old support-handphone WhatsApp history and trends | NP-HIS-01–03, WF-08, AC-37–41 |
| U-TAKEOVER | Wants to see/intercept Carol conversations | NP-CAR-11, WF-06, AC-24–25 |
| U-MODEL | Prioritizes troubleshooting intelligence/accuracy and accepted Pro/Flash recommendation | NP-AI-01–02; D-08; quality claims qualified |
| U-NO-TELEGRAM | Withdrew Telegram idea | NP-CAR-06, D-09, exclusions |
| U-DEEPSEEK | Wants to hand development to DeepSeek, possibly via GitHub | README sharing guide; starting prompt; D-10 |
| U-DSH | Clarified that the chosen development tool is DeepSeek Harness (DSH) | `DEEPSEEK-START-HERE.md` local-workspace instructions and least-privilege warning |
| U-PACKAGE | Asked whether TR-069/GenieACS is part of a package and reported a conflicting Google AI summary | Feature/package matrix distinguishes a planned optional Pro driver add-on from a standard included feature; OQ-30 |
| U-ESTIMATE | Asked for total time and cost to build the complete app | OQ-32 qualifies prior rough estimate as provisional and unmeasured, not a quote or guaranteed cap |
| U-DOCS-ONLY | Asked to draft handbook but not build app | README, roadmap and starting prompt permission boundaries |

## 5. Nonfunctional and acceptance coverage

Security, privacy, permissions, missing/ambiguous identity, unknown outcomes, create/edit/delete/cancel/disable/reactivate states, unavailable dependencies, concurrency, and recovery are explicit in the security and acceptance chapters.

The roadmap adds safety dependencies not fully represented by old task dependency metadata. This is documented engineering sequencing, not a silent change to source tasks.

### Coverage limits

- “Comprehensive” means all available major in-scope task descriptions and explicit current conversation decisions, not guaranteed recovery of inaccessible messages.
- Device CLI, DMA schemas, model rankings, prices, provider rules and deployment capabilities were not live-validated for this documentation task.
- No final production performance, tax, SLA, legal, retention, deployment sizing or support-contract terms are invented.
- UI design details absent from source remain implementation choices subject to review.
- The existing proposal's visual theme and PPTX are presentation assets, not a substitute for executable acceptance criteria.

## 6. Package verification

The package is generated only from the curated Markdown chapters and generated readable HTML, plus a file hash manifest and documentation-check report. The documentation checker verifies local links, declared requirement identifiers, source-family coverage, acceptance numbering, and obvious credential patterns. This is not a full repository secret/security audit.

Application tests, deployments and hardware verification are intentionally outside this handbook delivery.

