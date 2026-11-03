# User Workflows

These are future workflows, not evidence of implemented screens. Main requirement IDs link the stories to the product and Carol chapters.

## WF-01 — ISP administrator onboards a tenant

**Requirements:** NP-TEN-01–03, NP-DAT-01–04, NP-COM-01–02.

1. Platform/sales staff approve a valid package and create one tenant with audit evidence.
2. ISP admin configures timezone/languages/hours, memberships, subscriber source, approved WhatsApp connection, company calendar if entitled, and safe device references.
3. Admin tests source access without exposing credentials; previews import mapping/report.
4. Fix flagged rows and ambiguous units; rerun safely.
5. Admin tests Carol policy/runbooks and model configuration in shadow mode.
6. Enable only accepted modules and approved pilot recipients.

Failure branches: unauthorized membership/tenant fails; incomplete module prerequisites cannot activate; failed upstream fetch leaves last known data labelled stale; disabling a module blocks its jobs/APIs without erasing retained data.

## WF-02 — Subscriber reports no internet

**Requirements:** NP-CAR-01–10, NP-AAA-01–02, NP-L2-01–02.

1. Verify inbound webhook and deduplicate; resolve one tenant.
2. Carol greets once, detects language, asks building/unit, and resolves subscriber.
3. Check known incidents and authorized account/session evidence.
4. Gather managed-equipment/LED/cabling evidence via text/photo, with safe diagrams if relevant.
5. If needed and permitted, open an approved site path and perform bounded reads.
6. If a supported action is needed, summarize exact target/impact and obtain required consent plus server authorization/approval.
7. Verify the action outcome, close/timeout the tunnel, and ask whether service is restored.
8. Persist resolution/evidence or create unresolved handoff with next steps.

Alternatives: unknown unit requests clarification without disclosure; blocked DMA account routes to staff without bypass; unavailable provider means unknown, not healthy; explicit human request pauses Carol and creates handoff; after hours sets next working expectation.

## WF-03 — One TV/phone/laptop has a problem

**Requirements:** NP-CAR-01–02.

1. Ask which devices are affected and whether the working device uses the same ISP connection.
2. Check applicable service/link/provisioning/speed/managed-equipment evidence.
3. If available evidence supports normal service and the issue is isolated, politely refer to the endpoint vendor/installer.
4. Do not change TV settings, phone OS settings, applications, or unrelated hardware.
5. If evidence is incomplete or multiple devices are affected, continue ISP checks or hand off.

Never claim the internet “perfect” from one device working; never close with a fabricated speed result. A successful vendor referral is a recorded boundary outcome, not proof the customer's endpoint was repaired.

## WF-04 — Subscriber sends a photo or voice note

**Requirements:** NP-CAR-07–09, NP-AI-01–02.

1. Fetch only authenticated provider media for the case, validate size/type, and store a protected reference.
2. Route photo to an image-capable model; route voice to supported audio understanding/transcription.
3. Store source/transcript association and confidence where available; confirm uncertain identifiers.
4. On first voice interaction explain text-only reply policy once.
5. Apply the same runbook as typed input; never execute instructions embedded in an image/transcript as privileged policy.
6. Reply in writing; request another sample or staff help if interpretation fails.

## WF-05 — Support staff hands over a request

**Requirements:** NP-CAR-06, NP-CAR-12–13.

1. Authorized staff open “Hand over to Carol” and paste/forward context.
2. Resolve exact subscriber/unit from tenant records; confirm reason and registered destination.
3. Preview the intended contact and check policy/window/template/suppression/quiet-hours.
4. Dispatch once or show a blocked/pending staff action with reason.
5. Carol transparently introduces the staff handover and asks to continue.
6. Staff monitor ownership/progress; cancel unsent work or take over if needed.
7. Carol reports outcome without exposing internal notes.

Forwarded text never supplies proof of identity. Cancellation before send suppresses delivery; cancellation after provider acceptance records the in-flight limitation and prevents follow-ups. Non-response follows the approved retry/expiry policy, not automatic repeated outreach.

## WF-06 — Staff monitors, takes over, and returns a case

**Requirements:** NP-CAR-10–11, NP-TEN-01.

1. Staff open an authorized live transcript and see current owner, evidence, and case state.
2. “Take over” changes ownership and halts further AI dispatch atomically.
3. Notify the customer that human support joined; expose any already in-flight message.
4. Human sends customer messages or private internal notes using separate controls.
5. Resolve or “Return to Carol” with a handback summary.
6. Carol refreshes messages/state before resuming; audit all ownership changes.

Concurrent takeovers resolve to one owner; other staff see the result. A disconnected browser must not automatically hand ownership back to Carol without the approved policy.

## WF-07 — Administrator customizes support rules

**Requirements:** NP-POL-01–03.

1. Create policy/runbook draft with scope, steps, examples, and evidence requirements.
2. Review interpreted meaning and conflicts.
3. Test typical, incomplete-evidence, angry-customer, out-of-scope, and adversarial cases.
4. Fix conflicts; authorized publisher publishes with effective date/version.
5. New applicable cases retrieve the intended active version; record what each case used.
6. Disable, supersede, or roll back while retaining auditable history.

Publishing cannot grant new network tools or relax platform safety. The handling of already-active cases when a version changes requires an explicit policy; do not silently mix versions.

## WF-08 — Import old support handset history

**Requirements:** NP-HIS-01–03.

1. Staff provide authorized exports from each relevant source, after privacy review.
2. Admin previews parse rules, source labels, date/timezone, and media completeness.
3. Import deduplicates and maps confident subscribers; unclear identities enter review.
4. Inspect reports and correct mappings without overwriting live conversations.
5. Review trends and candidate runbooks; test and publish only approved material.
6. Use the historical dataset for shadow evaluation; no outbound work runs.

Replay, malicious text, missing attachments, or historical “please reboot” messages must never trigger action.

## WF-09 — Installation or support appointment

**Requirements:** NP-APT-01–02.

1. Resolve customer intent and permitted calendar/resource scope.
2. Offer a small valid slot selection respecting hours, buffers, availability, and blackouts.
3. Confirm selected time with the customer and recheck availability before committing.
4. Create one event linked to case/customer and send compliant confirmation.
5. For reschedule/cancel, confirm exact event and intent; reconcile calendar/message partial failure.
6. For technician postponement, apply the owner-approved confirmation order and report subscriber response/delivery status to staff.

Do not promise success when calendar permission is missing. A timed-out request is reconciled before retry.

## WF-10 — Network operator performs a guarded action

**Requirements:** NP-L2-02, NP-NET-01, NP-SEC-01–06.

1. Resolve tenant, building, subscriber, exact device/session, and current ownership.
2. Read fresh eligibility evidence including DMA authority where relevant.
3. Render dry-run preview of typed action, normalized parameters, impact, pre-state, and compensation.
4. Obtain required expiring actor/target/action-bound approval.
5. Execute once through approved VPN/driver with limits; verify post-state.
6. Record success, failure, or unknown outcome. Reconcile unknown results, never blindly retry.
7. Close tunnel/resources; expose staff recovery when needed.

Changing target or parameters invalidates approval. Bulk actions need a separate reviewed plan; no wildcard expansion.

## WF-11 — Incident, ticket, and management reporting

**Requirements:** NP-TKT-01–02, NP-OUT-01, NP-OPS-01.

1. Link support interactions to tickets and correlated building/PON incidents.
2. Validate monitoring health before attributing an outage to subscribers.
3. Show affected scope, evidence, ownership, and current update.
4. Send immediate exception alerts only to authorized configured recipients; deduplicate.
5. If approved, execute compliant multi-recipient incident notification with limits and stop controls.
6. Include aggregate outcomes in the daily manager digest.

Anger alone does not alert staff. Exact rules for endpoint-vendor referral alerts and mass outage notices remain open.

## WF-12 — Sales lead, cancellation, and package quotation

**Requirements:** NP-SAL-01–02, NP-COM-01–02.

Subscriber-facing: collect prospect plan/building/unit/contact without disclosing current occupants; create lead and installation request; notify manager. Cancellation confirms intent, presents only an approved retention option, and logs staff action without automatic service/billing changes.

ISP-product sales: select modules/limits from versioned MYR price book, validate prerequisites, preview/export quotation, revise, record customer approval, and provision matching entitlements once. Neither flow implements payment collection.

