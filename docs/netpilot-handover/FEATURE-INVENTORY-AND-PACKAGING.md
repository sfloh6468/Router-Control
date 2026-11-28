# Feature Inventory and Package Entitlements

**Purpose:** Make it explicit which capabilities are part of the intended product, which package or add-on can offer them, which are merely present in the existing app, and which decisions still need owner approval.

This is the clearest package-level source in the handbook. The inventory records planned commercial direction, not final price-book SKUs, contractual promises, or implemented behavior. Where a feature is an optional driver, it is **not included in a base package merely because it appears in the platform roadmap**.

## Package terms

- **Starter ISP** is the intended mandatory starting package for an ISP customer. It includes Carol and the Carol Policy Studio, plus the baseline platform and standard MikroTik/Huawei device-manager capabilities.
- **Operations Pro** is an optional upgrade for private connectivity and advanced operational functions.
- **Enterprise / Custom** is an optional extension for approved bespoke integrations, larger deployments, and custom operating controls.
- **Selected driver add-on** means an ISP may choose and be quoted for that driver within the appropriate tier. It does **not** mean the driver is automatically included, has a settled price, or can operate without its prerequisites.
- **Every tier** must retain baseline privacy, tenant isolation, server-side permissions, action approval, and auditing. Commercial tier cannot turn off safety.
- Package names and tier defaults are currently proposed/selected commercial direction; each customer's quote and exact line items must state the actual entitlement. No final prices are approved.

## Product capability and default entitlement matrix

| Capability | Intended package availability | Included by default? | Planned behavior / boundary | Source and status |
|---|---|---|---|---|
| Platform core: ISP tenant, members/roles, buildings, subscribers, settings, baseline audit, imports | Starter ISP | Yes, baseline | Tenant isolation and security are mandatory. Subscriber source is external; exact schema and integration remain open. | NP-TEN-01–03, NP-DAT-01–04; planned |
| Existing MikroTik device manager | Starter ISP | Yes, standard baseline | Retain existing dashboard, interfaces, IP, firewall, DHCP, wireless, terminal, profiles and device support; revalidate functionality and production connectivity. | NP-DEV-01; code present, not revalidated |
| Existing Huawei SmartAX OLT manager | Starter ISP | Yes, standard baseline as scoped in product plan | Preserve existing Huawei paths; device firmware/version compatibility still requires testing. | NP-DEV-02; code present, not revalidated |
| Basic subscriber / AAA visibility | Starter ISP | Yes, when a supported customer data source permits it | Provide basic read-only status; never change billing or use a local router action to bypass authoritative AAA denial. Exact “basic” versus full DMA connector allowance needs a price-book decision. | NP-AAA-01–02; planned and package boundary open |
| Carol AI Customer Service | Starter ISP | Yes | Official one-to-one WhatsApp, English/Malay/Chinese, guided and free-text intake, photos, voice-note understanding, written replies, case history, shadow evaluation and human handoff. | NP-CAR-01–13, NP-AI-01–02; planned |
| Carol Policy Studio (runbooks and policies) | Starter ISP | Yes | Admin-customizable and versioned runbooks/policies; tests, conflicts, publish/disable/rollback; never grants permissions or edits platform safety. | NP-POL-01–03; planned |
| Subscriber plan / installation lead and cancellation requests | Carol subscriber workflows; exact tier boundary tied to appointments | Basic lead/request capture is the proposed baseline; calendar booking may require Operations Pro | Collect an approved plan/building/unit/contact and log a staff-visible lead; record cancellation and approved retention request; no automatic billing/provisioning. Resolve whether a Starter customer can capture a request while calendar booking is an add-on. | NP-SAL-01–02, NP-APT-01; planned; OQ-29 |
| V-SOL V1600G OLT driver | Operations Pro selected device-driver add-on | **No** | V1600G0/G1/G2 status, PON/alarms, ONT discovery, serial mapping and optical Rx/Tx; guarded exact-ONT activate/deactivate/reboot only after validation and authorization. SSH/custom parser plan; verify CLI against the actual model. | NP-VSO-01–02; planned |
| FortiGate driver | Operations Pro selected device-driver add-on | **No** | Read status, HA/CPU/memory/interfaces, policies, session counts and VPN state; on-demand configuration backup. No FortiGate policy/config edits in initial scope. | NP-FGT-01; planned |
| GenieACS / TR-069 subscriber router monitoring | Operations Pro selected device-driver add-on | **No** | Use an existing/user-provided GenieACS installation, not a NetPilot-built ACS. For mapped, registered, supported routers, show last contact, online/stale state, uptime, WAN and Wi‑Fi/host values only when the router reports them. Unregistered/unsupported devices show “not remotely manageable.” | NP-ACS-01; planned |
| GenieACS / guarded router controls | Operations Pro selected device-driver add-on | **No** | Authorized, explicitly approved reboot and supported SSID/password updates, with exact subscriber/device mapping, secret minimization, task reconciliation, pre/post checks and audit. Never expose Wi-Fi passwords in routine chat or dashboards. | NP-ACS-02, NP-SEC-01–09; planned |
| DMA Softlab Radius Manager connector | Subscriber visibility capability, subject to chosen package/add-on boundaries | No separate paid inclusion is established in this draft | Capability probe and read-only subscriber/account/session/usage/authentication views; never call write APIs, write SQL, issue CoA/PoD, or bypass DMA decisions. Exact entitlement needs approval. | NP-AAA-01–02; planned; package boundary open |
| Private VPN / approved device sidecar | Operations Pro | No | Open on demand to allowlisted sites/targets; OpenVPN initial choice; no public management ports or persistent tunnels. Existing secure access must still be provisioned for any supported Starter device route; exact Starter connectivity model is open. | NP-NET-01; planned; OQ-20 |
| Guarded single-target network actions | Operations Pro | No | Eligible exact-target OLT/managed-router/MikroTik-local actions only, if separately implemented and allowed; target-bound server approval, authorization, limits, verification and audit. Never DMA mutations or bulk actions by implication. | NP-L2-01–02, NP-SEC-01–09; planned |
| Ticketing and manager reports | Operations Pro | No | Case-linked tickets, filters, daily digest, exception notices and audit; human handoff remains part of Starter Carol. | NP-TKT-01–02; planned |
| Outage consolidation and proactive notices | Operations Pro | No | Correlate verified building/PON evidence; human-reviewed, capped, template-compliant multi-subscriber notices only. | NP-OUT-01, NP-SEC-02–04; planned |
| Google Calendar appointment management | Operations Pro | No | One selected business calendar, configured resources/hours, confirmed booking/reschedule/cancel, deduplication and recovery from partial failures. | NP-APT-01–02; planned |
| Snapshot browser, restore, and nightly OLT backups | Operations Pro | No; existing manual snapshot paths are code-present and require current verification | Browse/download snapshots; schedules; integrity and version compatibility. Restore/delete separately authorized. | NP-DEV-04, NP-OPS-02; existing code plus planned refinements |
| Security and compliance | Baseline safety in every tier; advanced reporting/export/retention controls may be higher-tier | Baseline: **yes**; advanced feature scope: open | Tenant/user controls, server authorization, privacy, audit, safe logins. Higher tiers do not remove the baseline. | NP-TEN-01–03, NP-SEC-01–10, NP-DEV-03; mixed |
| Operations dashboards, provider monitoring, cost/capacity, recovery tooling | Operations Pro; custom operational guarantees may be Enterprise / Custom | No | Monitor APIs, DB, storage, queues, AI, WhatsApp, VPN, sidecars and adapters; encrypted backups, restore drills, RPO/RTO. | NP-OPS-01–02; planned |
| Malaysian VPS hosting and production release service | Deployment/hosting agreement, not implied by an application feature package | No; environment/provider/price unselected | Isolated environments, TLS, private routing, repeatable releases, migration and rollback. Replit and VPS operation are separate hosting choices. | NP-DEP-01; planned |
| Enterprise / bespoke integrations and wider guarded automation | Enterprise / Custom by explicit approved quote | No | Custom interfaces, multiple-site/HA topology, bespoke limits and support, after separate capability and safety review. Not unrestricted access. | NP-COM-01–02; planned |
| NetPilot SaaS package quotation and entitlements | Internal sales capability in the NetPilot platform | Not an ISP service tier feature | Versioned configurable MYR price book; create/revise/export/approve quotation and provision the matching entitlement. No payment collection or auto-charge. | NP-COM-01–02; planned |

## Specific GenieACS answer

The handover **does include TR-069 / GenieACS monitoring as a planned feature**. It is **not specified as a standard included feature in Starter ISP**. The proposed catalog places it under **Operations Pro as a selected additional device-driver add-on**:

1. Starter ISP does not receive it automatically.
2. An ISP must select and be quoted for it, with its limits and prerequisites stated explicitly.
3. No price, device count, or contractual support entitlement has been finalized.
4. Availability still depends on that ISP providing an authorized GenieACS host and supported routers actually registering to it.
5. Read-only monitoring and guarded router actions are separate behaviors under the same selected driver; action availability still requires authorization and explicit support.

This distinction is also encoded in `NP-COM-03` and acceptance cases `AC-68` and `AC-69`.

## The two different subscription-sales journeys

Do not conflate:

- **ISP-to-subscriber sales:** a person asks about Internet service, submits a lead/installation request, or asks to cancel service. This is the Carol / `S-29` workflow; it does not take payment or automatically provision/disconnect service.
- **NetPilot-to-ISP sales:** an ISP evaluates a NetPilot module package, receives a versioned quotation, approves it, and obtains tenant entitlements. This is the `S-45` internal sales workflow; it does not collect payment in this scope.

The installation calendar is a separate Operations Pro module in the proposed package. Whether Starter Carol can only capture an installation request while actual calendar selection requires Pro needs an owner decision.

## Not included unless separately approved

These records/features were not treated as current promises:

- Automatic customer payment, checkout, subscription billing or invoice/credit changes.
- Nightly proactive fiber degradation scans and historical optical trend charts.
- Subscriber post-resolution satisfaction surveys.
- A general admin-authored FAQ/coverage/pricing knowledge-base module distinct from the approved price-book and configured plan data.
- Broad BGP operation or router changes from a developer agent.
- Automatic temporary service extensions/reactivation; this conflicts with the strict DMA read-only boundary and is not approved.
- Raw command-and-response device transcript replay in the subscriber inbox. Keep approved action metadata and outcome/audit. Decide separately whether staff need redacted operational transcripts.
- Automatic building-wide outage messaging without a separately reviewed, recipient-bounded permission.

The former ideas above are recorded in the task inventory with their source status and disposition. Their appearance in historical plans does not silently add them to the offer.

