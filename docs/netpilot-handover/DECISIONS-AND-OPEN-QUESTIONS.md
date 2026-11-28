# Decisions, Conflicts, and Open Questions

## Approved or selected direction

These distinguish explicit conversation decisions from saved roadmap direction; neither implies implementation exists.

| Decision | Direction | Basis |
|---|---|---|
| D-01 | Product name is NetPilot | Owner chose name; deck rename remains separate |
| D-02 | Current delivery is handbook only; do not build app | Latest explicit owner instruction |
| D-03 | Carol supports ISP link, speed, provisioning, and ISP-managed equipment only | Explicit clarification covering phones, TVs, laptops and other endpoints |
| D-04 | Admins customize runbooks and policies | Explicit owner request |
| D-05 | Staff hand over a verified subscriber case; Carol initiates compliant private contact | Owner idea, refined in saved Carol plan; identity/compliance gates required |
| D-06 | Historical handset exports are useful reference, separate from live operational messages | Saved Carol plan following owner inquiry; import restrictions are safety design |
| D-07 | Authorized staff can monitor and take over, then return case to Carol | Owner request and updated plan |
| D-08 | Gemini 2.5 Pro primary; Flash routine; DeepSeek optional shadow comparison | Owner accepted recommendation; capability/availability/accuracy still require evidence |
| D-09 | No Telegram channel | Explicitly dropped by owner |
| D-10 | DeepSeek can be the developer without being Carol's runtime LLM | Handover goal; separate technical choices |
| D-11 | Starter ISP includes Carol; Operations Pro and Enterprise / Custom are upgrades | Latest packaging plan and prior user-provided context |
| D-12 | DMA is read-only; no account/billing writes, CoA/PoD, or MikroTik account-authority bypass | Current DMA/L2 plans |
| D-13 | OpenVPN on demand; external site credential/destination lookup; no persistent tunnels or public SSH/API | Specific user decisions recorded in L2 plan |
| D-14 | One-to-one official WhatsApp; existing groups stay human-managed | Current saved channel plan |
| D-15 | Voice notes accepted; written replies only | Saved Carol plan |
| D-16 | Safety enforced outside model prompts; staged testing and explicit production approval | Saved safety harness and authorization/pilot plans |

## Recommendations that are not final product commitments

- Persona & Service Charter admin screen and optional `SOUL.md` export were proposed; exact customization/storage is not owner-approved.
- Exact role decomposition, independent approver combinations, manager transcript visibility and staff assignment scopes need confirmation.
- Logical data model and document milestone breakdown are implementation guidance, not finalized schema or dates.
- No final transcription vendor was selected. Gemini audio may remove that dependency if the chosen API supports the requirement.
- Previous statements that one model is “smartest” or more accurate are recommendations without a NetPilot benchmark.
- Engineered limits, optical/speed thresholds, queue technology, model fallback and cost policies require explicit values.

## Conflicts and decisions required before affected implementation

| Open item | Conflict or missing fact | Safe interim rule / owner decision |
|---|---|---|
| OQ-01 · Packaging | Old Carol task calls it optional/independently licensed; newer packaging includes it in mandatory Starter | Treat latest Starter bundle as commercial direction; retain technical entitlement control |
| OQ-02 · Groups | Older shadow paragraph says read/live-enable per group; newer task says private official WhatsApp only | No ordinary group automation; shadow direct/test/imported data only |
| OQ-03 · Retention | “Every message permanently stored” versus configurable retention/deletion | Durable logging mandatory; retention/legal-hold/delete schedule must be approved before real data |
| OQ-04 · Site credentials | Older data plan stores connection info/password vault; later L2 rule forbids local persistence of fetched site destinations/VPN credentials | Use opaque local references and temporary external lookup; confirm treatment of non-VPN device passwords and subscriber WiFi/PPPoE secrets |
| OQ-05 · VPN type | Early language prefers WireGuard; later explicit choice is OpenVPN | OpenVPN initial, WireGuard optional per site; verify RouterOS compatibility and host privileges |
| OQ-06 · Monitoring access | On-demand tunnels/no permanence versus scheduled backups/outage polling | Agree short-lived scheduled tunnel or approved sidecar/telemetry method without permanent tunnel or public management ports |
| OQ-07 · Transport migration | Huawei currently uses Node SSH; plan requests Python Netmiko; V-SOL driver support may have changed | Preserve baseline; validate drivers; agree phased migration rather than unrequested replacement |
| OQ-08 · Speed proof | Owner wants confirmation link/speed OK; available evidence/methodology unspecified | Agree test location, plan tolerance, wired/WiFi assumptions, freshness, load/consent. A working phone alone proves neither full speed nor a perfect service |
| OQ-09 · Escalation | Carol rule says human request/unresolved only; reporting plan says all out-of-scope cases immediate alert | Completed vendor referral should be a boundary outcome; approve whether/when it pages staff and how safety/system incidents differ |
| OQ-10 · Postponement | Calendar plan requires customer confirmation before changes; older Carol plan updates first then notifies | Approve provisional hold/proposed change versus direct staff reschedule; do not silently finalize disputed time |
| OQ-11 · Bulk outage messages | Outage plan proactively notifies affected units; outreach plan prohibits unapproved multi-subscriber sends | Separate reviewed R3 incident workflow with verified recipients/templates/caps; no automatic bulk send from single-case permission |
| OQ-12 · Subscriber verification | Matching condo/unit/phone is not a sufficient specified ownership check | Choose approved challenge/verification and policy for shared phones, move-outs, number changes, prospects and staff requests |
| OQ-13 · Staff identity/roles | Private WhatsApp staff input allowed but number possession cannot authorize | Agree enrollment, reauthentication, directory binding, revocation and high-risk confirmation requirements |
| OQ-14 · Current model availability | Selected models/experimental IDs may retire or differ by gateway/region | Verify official current API capabilities and supported integration at implementation; obtain approval for replacements |
| OQ-15 · AI quality | No measured model comparison, labelled corpus, accuracy threshold or sample size | Agree realistic cases and launch gates with support experts; no unsupported universal ranking |
| OQ-16 · Voice/privacy | Model audio limits, conversion and retention/vendor-processing terms unspecified | Agree supported durations/codecs, transcription fallback, privacy terms, and deletion; written replies only |
| OQ-17 · External source | Subscriber DB engine/schema, refresh mode, change ownership unknown | Need non-secret schema/sample fixture; access details through secure configuration only |
| OQ-18 · DMA | Installed version/license/API/schema/read-only identity unknown | Discover only with approved test access; unknown capabilities stay unavailable, writes stay forbidden |
| OQ-19 · Hardware | V-SOL/FortiOS/RouterOS/ONT/TP-Link versions and test devices not confirmed | Fixtures first; one explicit test device before compatibility claims; unsupported clearly labelled |
| OQ-20 · Entitlement prerequisites | Starter includes basic device management; deeper private connectivity is upgrade | Agree secure access baseline per bundle; never expose management publicly to bypass an unlicensed VPN module |
| OQ-21 · Manager access | Whether management sees full transcripts, summaries only, or scoped selected cases not agreed | Least-privilege assignment model; owner approves final visibility |
| OQ-22 · Policy lifecycle | Active cases during policy rollback/version replacement and publisher separation not specified | Record versions per decision; agree whether cases pin or transition with explicit event |
| OQ-23 · Sales | Final plan catalog/prices/tax/discount/retention offers and quote approval authority missing | Configurable draft price book; no invented prices or automatic billing |
| OQ-24 · Scheduling | Actual calendar/resources/hours/holiday/travel/buffer settings missing | Test calendar only; no personal-calendar write or invented availability |
| OQ-25 · Production | VPS provider/sizing, domains, auth/service accounts, private routing, backup RPO/RTO and costs missing | Document and approve topology before provisioning/deployment |
| OQ-26 · Operational targets | SLA/timeout/rate/retry/incident thresholds, no-response expiry and handover ownership timeouts missing | No arbitrary production promises; bounded safe fixture defaults clearly labelled |
| OQ-27 · Security backlog | Current writer tool lacks deterministic approval; legacy admin typecheck and workflows unverified/failing observations | Baseline verification and safety work precede subscriber automation; no repairs authorized by handbook request |
| OQ-28 · Archived suggestions | Some automatically archived suggestions resemble later approved work | Do not infer rejection from archival; current explicit requirements govern; don't revive unrelated features |
| OQ-29 · Subscriber leads and appointments | Carol's older plan asks to book installation; the product catalog puts Google Calendar appointments in Operations Pro | Decide whether Starter only creates a lead/manual scheduling request while calendar-based booking requires the appointment entitlement |
| OQ-30 · Driver add-ons | The feature roadmap names GenieACS, V-SOL and FortiGate, but does not set exact add-on prices, device counts or what a given Pro contract includes | Show each driver as “optional, select and quote”; enable it only when the approved tenant entitlement names it. Operations Pro alone must not imply every driver |
| OQ-31 · Device-session transcripts | An older live-console proposal wanted raw live/permanent device command transcripts; later explicit user request covered Carol conversations and takeover | Keep redacted action status/evidence. Ask whether raw transcripts are needed; if so, set retention, access roles, secret redaction and operational-risk review |
| OQ-32 · Build estimate | A prior assistant gave a broad 6–9 month / US$8,000–16,500 allowance without measuring actual Replit usage or validating the full integration workload | Treat only as a provisional discussion estimate, not a quote, cap, schedule commitment or feature requirement; revise after a bounded milestone and measured spend |

## Explicit exclusions / no implied permission

- Building the app, fixing existing workflows, adding dependencies, changing providers/secrets, deploying, or contacting subscribers as part of this handbook delivery.
- Telegram or ordinary WhatsApp-group automation.
- Customer-owned endpoint/OS/application troubleshooting.
- Live WhatsApp calling or voice responses.
- DMA mutations, direct billing writes, or account-authority bypass.
- FortiGate policy edits or other new firewall vendors in initial driver.
- New ACS implementation, bulk firmware campaigns, or remote management of unsupported endpoints.
- Public self-service ISP signup, payment collection, automatic sign-up/cancel provisioning.
- All-building launch, unrestricted broad automation, or production access from a developer prompt.
- Automatic learning/publication of policies from old chat history.
- Uploading credentials, production exports, device dumps or real chat histories to GitHub/DeepSeek.

## How to resolve an open item

Record owner decision, affected requirement IDs, rationale, effective date/version, migration implications and acceptance updates. Keep superseded text identifiable. Do not convert an unanswered question into an implicit default merely because an LLM can generate code for it.

