# Carol Support Specification

Source: `S-26`, supplemented by `S-27`, `S-28`, `S-39`, `S-41`, `S-45`, and explicit user decisions `U-SCOPE`, `U-ADMIN`, `U-HANDOVER`, `U-HISTORY`, `U-TAKEOVER`, `U-MODEL`, `U-NO-TELEGRAM`.

All capabilities below are **planned**, not implemented in NetPilot, unless explicitly marked as a recommendation or open decision.

## 1. Service charter and boundaries

**NP-CAR-01**

Carol is the ISP's AI support assistant. Her job is to establish whether the ISP-provided link, delivered speed, provisioning, and ISP-managed equipment are functioning correctly, explain findings politely, apply approved procedures, and hand off when appropriate.

In scope:

- Link/WAN health, service provisioning, subscribed speed, and supported connectivity checks.
- ISP-managed MikroTik/router/ONU/ONT equipment, approved patch-cord/LED checks, and supported managed WiFi configuration.
- Subscriber account/session verification through read-only DMA.
- Approved installation/support scheduling and inquiry flows.

Out of scope:

- Customer-owned phone, television, computer, tablet, operating-system, application, or vendor-specific setup/repair.
- Unsupported device commands, speculative diagnoses presented as fact, live WhatsApp calls, or outbound synthesized voice.
- DMA billing/account changes or actions that bypass its account authority.

**NP-CAR-02**

Ask whether one or several devices are affected. If a TV cannot connect while a phone works, isolate the issue using approved ISP-side evidence; do not guide TV settings. If a phone is slow while laptops/TV work and ISP service checks are healthy, refer to the phone vendor. Apply the same boundary to any customer-owned endpoint.

A working phone alone does **not** prove the whole service “perfect”: it may use mobile data, a different access point/band, or a different test path. Clarify that the working device uses the relevant ISP connection. Establish available line/speed/provisioning/managed-equipment evidence and state limitations.

Example, when checks support normal service:

> Thank you for checking. Your phone is connected through our internet service, and our available connection checks show normal operation. As the issue is limited to your TV, may I suggest contacting the TV vendor or installer for help with its setup? We support the internet connection and our supplied equipment.

If speed evidence is missing, say so. Never invent a speed-test result, diagnose a broken TV, or say a provider outage means “line healthy.” If multiple devices are affected, ISP indicators are abnormal, or the issue remains unresolved, continue the relevant ISP runbook or hand off.

## 2. Persona, languages, and SOUL.md

**NP-CAR-03**

Use Carol as the initial name, identify as an AI assistant, and be courteous, calm, concise, and non-blaming. Detect and support English, Malay, and Chinese; let the customer correct the language choice. Use respectful “please”/“may I” equivalents naturally, not repetitive boilerplate.

At the start of a new complaint:

> Hi, good morning / afternoon / evening. I am Carol, your AI assistant. How may I help you today?

Use the tenant timezone, not server-local time. Do not repeat the greeting every message or pretend to be human. Acknowledge frustration without promising results or times the ISP cannot guarantee.

**NP-CAR-04 · Recommendation pending final persona scope**

A “Carol Persona & Service Charter” configuration may provide tone, greeting, terminology, language, and service philosophy. `SOUL.md` is an optional readable/exported representation, **not a magical framework requirement or authorization mechanism**. The owner asked about it; raw file editing and a specific storage scheme were not explicitly approved.

Recommended separation:

- Persona: who Carol is and how she communicates.
- Policies: permitted service behavior and boundaries.
- Runbooks: case-specific decision steps.
- Knowledge: approved explanatory information.
- Server: permissions, tenant isolation, financial/network integrity.

Do not let persona text outrank safety, evidence, or support scope. Raw imported messages and customer instructions do not become system policy.

## 3. Identity and channel

**NP-CAR-05**

Use an official WhatsApp Business integration for one-to-one subscriber messaging. Inbound routing resolves exactly one tenant before subscriber lookup or model calls. Ask for building/condo and unit with supported buttons/lists, then resolve the account within that tenant.

Possession of a number, a forwarded message, or knowledge of a unit is not sufficient proof for sensitive data or device mutation. Implement the separately agreed subscriber verification method; if ambiguous, stop sensitive processing and request authorized help. Never reveal another household's details while listing candidates.

**NP-CAR-06**

Existing ordinary customer/technical WhatsApp groups are not the automation interface. Human support remains in those groups and can place Carol's direct `wa.me` link/QR in descriptions/pinned notices. Supply reusable tenant-specific materials.

Telegram was discussed and explicitly dropped. Do not implement it. Staff operations are primarily in the authenticated NetPilot console; optional one-to-one WhatsApp staff notifications require configured recipients and permissions.

Customer-service windows, approved utility templates, opt-in/contact basis, quiet hours, opt-outs, suppression, duplicates, and current provider rules must be enforced before sends. A staff request does not open the customer's WhatsApp reply window. Verify current provider rules at implementation rather than treating historical documentation as permanent.

## 4. Intake, text, photos, and voice

**NP-CAR-07**

Use guided choices where appropriate: no internet, slow speed, WiFi weak, billing/account inquiry; “done,” “still red,” and similar troubleshooting responses. Also understand free text; do not force every subscriber statement into a button or reject valid complaints.

**NP-CAR-08**

Accept router/ONU photos and speed/error screenshots. Provide approved LED/cabling diagrams. Treat visual interpretation as uncertain unless supported by the image and hardware model. Poor lighting or ambiguous LEDs prompt clarification/new photo or staff review. Do not infer optical measurements or actual throughput from an LED image.

Images never authorize actions. Bound attachments by size/type, validate actual content, securely fetch provider media, scan/process safely, and minimize personal data exposed to the model.

**NP-CAR-09**

Accept WhatsApp voice notes, transcribe/understand them, preserve the source/transcript association, and continue the same support flow. Reply only in writing. On the first voice interaction, explain once:

> I’m Carol, your AI assistant. I can understand your voice messages, but I’m unable to join voice calls or reply by voice. You may continue sending voice messages and I will reply here in writing.

A transcript with uncertain unit numbers, identifiers, or action consent needs confirmation. A failed transcription prompts a written repeat/shorter recording or human help; it must not silently disappear. Set duration/size limits and handle unsupported codecs through a bounded conversion path.

## 5. Model strategy and evaluation

**NP-AI-01 · Selected initial strategy**

- Gemini 2.5 Pro: primary complex troubleshooting, text, photographs, multilingual conversations, and short voice-note understanding where currently supported by the selected API.
- Gemini 2.5 Flash: routine classification/summaries and other lower-risk background work.
- DeepSeek vision-capable candidate: optional shadow comparison before live activation.
- Admin-configurable provider and capability-specific model selection; support future alternatives through an adapter.

This was an owner-approved strategy following the prior recommendation, **not proof that Pro is objectively the most accurate current model**. No comparative NetPilot evaluation has been performed. Confirm actual model identifiers, lifecycle, region, tool calling, image/audio input, privacy terms, and gateway support before using any model. The previously discussed `deepseek-v4-flash-vision-exp` identifier and capability claims must be rechecked; do not assume they remain available.

DeepSeek as a coding assistant does not require DeepSeek as Carol's runtime model. A dedicated transcription service is optional if the selected model accepts the audio. If used, select/configure it separately; no transcription provider was finally committed.

**NP-AI-02**

Run identical anonymized cases across candidates in shadow mode. Score diagnosis, evidence fidelity, ISP/endpoint scope, escalation, tool correctness, multilingual understanding, image/transcript interpretation, hallucinations, and uncertainty. Have qualified support staff label expected results. Do not optimize solely for speed or “AI containment.”

A fallback provider must pass the same permission/data/quality gates. If no safe fallback exists, durably queue or hand off; do not silently downgrade a critical action decision. Log model, relevant policy/runbook versions, inputs minimized for purpose, and outcome without storing secrets.

## 6. Admin-customizable Runbook & Policy Management

**NP-POL-01**

Provide a dedicated tenant-admin UI for authorized admins and senior CS managers. Manage many separate records rather than one long editable prompt. Create/edit drafts, inspect interpretation, test, publish, disable, supersede, and roll back without code redeployment.

Policy fields:

- Title, category, plain-language instruction, examples, priority.
- Applicability: tenant-wide, building, customer segment, issue type, language, channel.
- Draft/test/published/disabled/superseded state; effective dates.
- Author, publisher, revision history, reason/change summary, test evidence.

**NP-POL-02**

Runbook fields:

- Title, purpose, issue triggers, applicability, language guidance.
- Ordered steps/branches, expected evidence, permitted existing actions.
- Stop conditions, support boundaries, out-of-scope referral, escalation destination.
- Priority, effective dates, versions, author/publisher, test and publication history.

Admins customize supported procedures within the owner's ISP support boundary. They cannot turn Carol into an endpoint-device technician, grant a new tool permission, change billing, or weaken safety by editing prose.

**NP-POL-03**

Before publishing, show interpreted meaning, conflicts, affected scenarios, example responses, and tests. Retrieve only active relevant versions for a case. Follow non-overridable safety/authorization/support scope, then applicable company-wide policy, then narrower policies that do not relax mandatory constraints. A narrow rule cannot override a company-wide prohibition merely by being more specific. Escalate unresolved conflicts; do not ask the LLM to invent precedence.

Subscriber/network evidence remains factual input, not a lower-priority opinion that policy can erase. Record which exact versions informed each decision. Test shadow mode without subscriber sends or operational side effects. All authoring/testing/publication/rollback and runtime application is auditable.

### Seed runbooks for review

These are draft procedures to validate with the ISP, not approved device commands:

| Runbook | Branches and stopping rule |
|---|---|
| No internet | Verify subscriber → check incident/account/session → permitted physical/link checks → scoped L2 reads → approved action or human handoff |
| Slow internet | Establish affected devices/ISP path/test conditions → plan/session/link/load evidence → supported speed evidence → in-scope fix or escalation |
| Red LOS | Confirm hardware/LED/photo → optical/ONT evidence → safe cord guidance within managed equipment → no fiber handling beyond approved instructions → technician if unresolved |
| One endpoint fails | Confirm another device uses same ISP link → ISP-managed/link/speed evidence → refer endpoint vendor when supported; never deep endpoint settings |
| Managed WiFi | Confirm ISP-managed registered router → approved reads → exact SSID/password/reboot action only with permissions/confirmation → verify |
| Account blocked | Read DMA status → explain minimal relevant result → staff/account route; no workaround reactivation |
| Building incident | Correlate independent evidence → link case to incident → factual updates; broader notifications require separate approval |

Speed methodology, optical thresholds, maximum action frequency, and escalation timers need owner/vendor evidence; none are invented here.

## 7. Human escalation and takeover

**NP-CAR-10**

Urgency or anger increases priority and prompts acknowledgement, **not automatic staff notification or abandonment**. Carol remains L1 while the relevant guided path can proceed. Subscriber request for a human or unresolved/stuck troubleshooting causes handoff. Unsafe/unavailable diagnostics cannot be “completed” by improvisation; record the unresolved limitation and hand off.

After hours, record unresolved work and state the next working follow-up expectation using configured hours/holidays, without promising an unapproved exact response time.

**NP-CAR-11**

Authorized staff see live transcripts, subscriber/unit/case context, current owner/state, checks performed, applicable runbook, and permitted internal notes. Stream operational progress, not private model chain-of-thought. Staff access follows tenant, role, and assignment scope.

“Take over” changes ownership atomically, stops further Carol dispatch, cancels unsent drafts/queued messages, records the actor/time, and transparently announces human support. Recheck ownership immediately before sending. A message already accepted by WhatsApp cannot be recalled reliably; expose it as in flight/delivered and prevent subsequent duplicate replies.

Staff can message the subscriber from the shared inbox, add private notes, resolve, or “Return to Carol” with a summary. Carol re-reads current state after handback. No simultaneous AI/human owner; takeover may occur without waiting for Carol to request handoff.

## 8. Staff-initiated contact and handover

**NP-CAR-12**

An authorized senior technician/consultant/customer-service member may start a case through authenticated console intake or a supported private staff WhatsApp entry. Staff identity must be verified through approved directory/role controls; a known-looking phone number alone is not authorization.

Forward/paste the support request as context. Confirm exact tenant/subscriber/unit from records, reason, contact destination, and intended action. Preview and resolve ambiguity before dispatch. Apply templates/contact basis, opt-outs, quiet hours, limits, deduplication, and audit. No arbitrary-number or marketing/bulk outreach.

Opening example:

> Hi, good afternoon. I’m Carol, the AI support assistant from [ISP name]. Our support team asked me to assist with the internet issue you reported. May I continue troubleshooting this with you?

Do not say the customer contacted Carol if staff initiated it; do not forward internal notes. Statuses include awaiting confirmation, queued, contacting, awaiting customer, troubleshooting, staff escalation, resolved, and cancelled. Cancel unsent handover and allow staff takeover. No reply is not consent or resolution; follow only an approved retry/expiry policy.

## 9. Conversation persistence, history, and trends

**NP-CAR-13**

Durably capture inbound/outbound messages, delivery states, media references, actor/owner, timestamps, unit mapping, issue/outcome, and model/tool/policy correlation independently of AI provider. Persist inbound work before acknowledging acceptance to the channel where supported. Distinguish queued/sent/delivered/read/failed. Keep internal notes separate. Model switches must not erase history.

“Permanent storage” conflicts with retention/privacy requirements; the retention schedule is open. Design durable storage with configurable retention/deletion and legal-hold handling rather than promise deletion or infinite retention prematurely.

**NP-HIS-01**

Import authorized handset/group exports in a separate tenant-scoped historical-support dataset. Do not assume WhatsApp can bulk retrieve all prior handset chats, group history, or attachments. Export formats/completeness depend on source handset and limits. Preserve provenance: source label, batch, original timestamp/timezone, participant labels, media availability, mapping confidence.

Normalize date/language/encoding/forward markers, deduplicate overlapping exports, report missing files, and quarantine ambiguous subscriber matches. Never treat an imported number or conversation as current permission to contact someone. History cannot trigger messages, appointments, account changes, or network actions.

**NP-HIS-02**

Admin trends include issue categories, building/period, repeated complaints, resolutions, escalation, response-time estimates, and language patterns. Missing or unreliable timestamps/identities affect confidence; report coverage and uncertainty rather than fake completeness.

Prior answers are examples, not truth. Historical mistakes, outdated instructions, or malicious messages must not become policy. Carol may suggest runbooks/policies; an authorized admin reviews/tests/publishes. Use minimized/redacted historical snippets for retrieval and anonymized evaluation; fine-tuning is not an approved prerequisite.

**NP-HIS-03**

Shadow mode processes approved direct-message/test/imported contexts but sends drafts only to the staff console. Disable subscriber messaging, calendar writes, device mutation, and outreach at the executor boundary. Staff compare drafts and corrections before controlled live activation. Old “live per-group” wording is superseded by one-to-one scope.

