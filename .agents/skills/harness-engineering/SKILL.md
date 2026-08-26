---
name: harness-engineering
description: Prepares proportionate engineering context, environments, tools, fixtures, feedback, safeguards, rollback, and completion evidence. Use before implementing, debugging, refactoring, or integrating software, especially when changes touch data, AI, external services, infrastructure, or consequential operations.
---

# Harness Engineering

## Purpose

Build the conditions in which software changes can be made safely and verified
honestly. A harness is the surrounding context, constraints, fixtures, tools,
feedback signals, and recovery plan. It is not the product implementation.

Use this skill to prepare the work. Then execute changes with the existing
`loop-engineering` skill. Do not duplicate or replace that cycle.

## Size the Harness to Risk

Classify the proposed change before editing:

- **Low risk** — local, reversible presentation or isolated logic with no
  sensitive data or external side effects.
- **Moderate risk** — API, persistence, authentication, AI behavior, or an
  external dependency with bounded impact.
- **High risk** — production data, infrastructure, privileged access,
  destructive operations, money, broad communications, or physical/network
  control.

Use the lightest harness that can produce credible evidence. Low-risk work may
need a focused test and visual check. High-risk work requires explicit
environment separation, realistic sanitized fixtures, enforced access limits,
failure tests, observability, and a rehearsable rollback path. If uncertainty
could increase impact, classify upward.

## Prepare the Harness

### 1. Map the system

Identify:

- the user-visible outcome and non-goals;
- affected components, owners, and trust boundaries;
- development, test, staging, and production environments;
- data stores, queues, models, APIs, devices, and third-party services;
- which dependencies are local, simulated, recorded, sandboxed, or live;
- side effects, blast radius, and failure propagation paths.

Do not assume two environments have equivalent configuration or data.

### 2. Define operating boundaries

For every tool and integration, state what the work may read, write, create,
send, execute, or delete. Apply least privilege and narrow scope by identity,
tenant, resource, target, quantity, time, and rate.

- Keep authorization and validation in deterministic application or
  infrastructure controls, not prompts or operator convention.
- Separate advisory or generated output from authorization and execution.
- Do not broaden access merely to make testing easier.
- Require explicit approval for destructive, externally visible, costly, or
  high-impact actions.

### 3. Prepare safe inputs

- Prefer minimal synthetic fixtures for ordinary tests.
- Use sanitized recorded responses when protocol or provider realism matters.
- Remove credentials, personal data, identifiers, and confidential payloads.
- Preserve edge cases, ordering, encoding, and error shapes needed by tests.
- Record fixture provenance, schema/version, and sanitization method without
  retaining sensitive source material.
- Never use production records as convenient test data.

### 4. Establish executable feedback

Choose evidence that can disprove the expected outcome:

- static checks, unit tests, contract tests, and builds;
- API and schema compatibility checks;
- database migration and rollback checks in an isolated database;
- browser, mobile-device, or accessibility checks;
- sandbox or recorded-response integration tests;
- failure injection for timeout, retry, partial response, duplicate delivery,
  unavailable dependency, and denied authorization;
- narrowly scoped live verification only when fixtures cannot establish
  compatibility and access is approved.

Write down the expected signal before implementation. Prefer repeatable
commands and assertions over visual confidence or log inspection alone.

### 5. Make failure bounded and observable

Define explicit timeouts, retry limits, backoff, concurrency and rate limits,
payload limits, and cancellation behavior. Add circuit breakers or fail-closed
behavior when repeated failures could amplify impact.

Failures must identify the operation, environment, target category, stage,
correlation identifier, and safe diagnostic detail. Redact secrets and
sensitive data. Do not silently fall back to behavior with different safety or
authorization properties.

### 6. Protect data and secrets

- Keep credentials in the platform's secret or connection facilities.
- Never place secrets in code, fixtures, prompts, logs, screenshots, or error
  messages.
- Isolate test data and databases from production.
- Minimize collection and retention; redact before persistence or display.
- Verify tenant, owner, and target scoping at server-side boundaries.
- Treat generated content and external responses as untrusted input.

### 7. Define recovery before mutation

For any consequential change, identify:

- the safe stop or kill switch;
- the rollback or compensating action;
- backups or snapshots required before execution;
- how restoration will be verified;
- who can authorize rollback;
- irreversible steps and the evidence required before crossing them.

A backup is not rollback evidence until its completeness and restore path are
credible for the risk involved.

## Execute Inside the Harness

Load and apply `loop-engineering` after preparation. Each Observe–Plan–
Implement–Verify–Learn cycle runs within the boundaries above. Update the
harness when a loop reveals a new dependency, failure mode, or risk; do not
weaken it to force a passing result.

## Completion Evidence

Before claiming a loop or task complete, provide explicit evidence:

- what behavior changed and in which environment;
- which checks ran, with their actual outcomes;
- which safety boundaries and failure paths were exercised;
- whether side effects, audit records, and rollback evidence were inspected;
- what was not checked, why it was unavailable, and the strongest substitute;
- remaining uncertainty and whether it blocks release.

Passing unrelated checks is not evidence. A mocked test does not prove live
compatibility. A live check does not replace repeatable automated coverage.
Never claim a check, rollback, backup, or environment verification that did not
occur.

## Harness Readiness Checklist

- Risk and blast radius are classified.
- Environments, dependencies, and trust boundaries are mapped.
- Tools and access are least-privileged and target-bounded.
- Fixtures are representative, sanitized, and versioned.
- Success and failure signals are executable.
- Timeouts, retries, limits, and cancellation are explicit.
- Logs are useful, correlated, and redacted.
- Test data and secrets are isolated from production.
- Rollback or compensating actions are defined where needed.
- Required completion evidence is known before implementation starts.
