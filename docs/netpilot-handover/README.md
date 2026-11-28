# NetPilot — Product and Developer Handbook

**Re-evaluated draft for owner review · 28 November 2026**

## Read this first

NetPilot is a planned multi-tenant ISP operations product for Malaysian ISPs. Carol is its AI customer-support assistant. This package transfers the available requirements to a DeepSeek-powered developer without requiring access to the original chat or Replit task system.

**This handbook is documentation, not an implementation or permission to start one.** The owner explicitly asked to draft the handbook and not build the app. No application feature, provider configuration, database, workflow, deployment, or live device was changed to prepare it.

Existing MikroTik/Huawei device-manager code and a business proposal are starting assets. They are not the complete NetPilot platform. Planned features are not represented as working features.

### Reading order

1. [Product requirements](PRODUCT-REQUIREMENTS.md) — system goals, roles, modules, and product boundaries.
2. [Functional build specification](FUNCTIONAL-BUILD-SPEC.md) — detailed screens, inputs, rules, state changes, permissions, outcomes, and failure handling by function.
3. [Carol support specification](CAROL-SUPPORT.md) — support boundaries, messaging, media, runbooks, policies, handover and history.
4. [User workflows](WORKFLOWS.md) — subscriber, staff, admin, operator and sales journeys.
5. [Security and safety](SECURITY-AND-SAFETY.md) — privacy, approvals, isolation, private connectivity and recovery.
6. [Acceptance criteria](ACCEPTANCE-CRITERIA.md) — positive, negative and recovery scenarios required for completion.
7. [Implementation status](IMPLEMENTATION-STATUS.md) — inspected source evidence, known limitations and external setup.
8. [Build roadmap](BUILD-ROADMAP.md) — dependencies, gates and safe implementation order.
9. [Decisions and open questions](DECISIONS-AND-OPEN-QUESTIONS.md) — approved choices, unresolved conflicts and deferred ideas.
10. [Feature and package matrix](FEATURE-INVENTORY-AND-PACKAGING.md) — explicit feature-by-feature tier availability and add-on status.
11. [Sources and coverage](SOURCES-AND-COVERAGE.md) — available planning-record ledger, requirements mapping and limitations.
12. [DeepSeek starting prompt](DEEPSEEK-START-HERE.md) — DSH workspace guidance and instructions to paste into the development tool.

The generated single-file HTML edition is for convenient reading. Markdown chapters are the editable source of truth for this draft. A download archive contains all chapters, the HTML edition, checks and an integrity manifest; it does not contain application source code or real subscriber records.

This revision contains 68 requirement identifiers, 56 function-level build entries, 98 acceptance scenarios, and a disposition for each of the 48 available project-task records.

## What the status words mean

- **Selected:** the user explicitly chose it, or the current saved roadmap specifies it. It may still be unimplemented.
- **Planned:** an intended capability described by the project plans; it needs implementation and acceptance.
- **Code present:** related code was found. This does not mean current tests, security, or hardware compatibility pass.
- **Recommendation:** an engineering proposal, not an owner-approved business rule.
- **Open:** the decision or evidence is missing; do not silently invent it.
- **Excluded:** explicitly outside the current scope, or explicitly dropped by the owner.

Requirement identifiers such as `NP-CAR-07` stay stable during development. Acceptance cases use `AC-` identifiers and reference those requirements. Sources `S-...` and conversation decisions `U-...` are explained in the coverage chapter.

## Authority and maintenance

The latest explicit owner instruction takes precedence over older plans. Non-overridable security and privacy controls cannot be weakened by an AI prompt, admin policy, imported chat, or lower-priority document. If source instructions conflict or evidence is missing, record the conflict and ask before implementing the affected behavior.

The handbook was re-audited against the current descriptions of all 48 available project-task records and the available conversation decisions. The existing code inventory reflects a bounded source inspection dated 3 November 2026; it was not freshly re-tested for this documentation revision. This is **not a verbatim export of every original chat message**. Unavailable or compacted history cannot be reconstructed with certainty. No universal claim that a model is “smartest” is established here.

### Package inclusion is explicit

“A feature is in the NetPilot roadmap” does not mean it is included in every customer package. The feature matrix is the draft package-level source of truth. In particular, **GenieACS/TR-069 is planned as an optional Operations Pro driver add-on, not a feature included by default in Starter ISP or automatically in every Operations Pro subscription.** No price or contracted device allowance is set yet.

## Sharing with DeepSeek or GitHub

### If the tool accepts uploads

Upload the handbook HTML or the Markdown chapters. If it cannot unpack ZIP files, extract the archive first. Start a fresh conversation with the DeepSeek starting prompt, then ask the developer to restate the requirements and unresolved decisions before writing code.

### If the tool reads GitHub

Use a private repository. Add the curated handbook in a documentation folder, review the diff, and explicitly grant the development tool access. A repository URL alone does not guarantee the tool can authenticate or read private content.

For an existing repository, add only the reviewed handbook files. **Do not stage the whole workspace indiscriminately.** Existing operational configuration dumps, customer exports, screenshots, or historical Git objects may contain sensitive information even when this handbook does not.

Application source transfer is a separate step. Audit the working tree and Git history for credentials and personal data before sharing code. Do not copy Replit's secrets, real subscriber databases, WhatsApp history, private network inventory, or device configuration archives into GitHub or a chat.

### Before asking the developer to implement

- Review the open decisions and choose a first milestone.
- Confirm the deployment environment and approved test accounts.
- Supply synthetic fixtures rather than production subscriber conversations.
- Arrange secrets through secure environment configuration, never chat or committed files.
- Retain human approval for production access, communications, migrations, and device changes.

DeepSeek as a **development assistant** is independent of the model used by **Carol at runtime**.

