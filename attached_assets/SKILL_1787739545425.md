---
name: loop-engineering
description: Builds apps through small, verifiable feedback loops. Use for every new project and whenever implementing, debugging, refactoring, or improving an application.
---

# Loop Engineering

## Purpose

Build software through short, observable cycles rather than attempting a large
implementation in one pass. Every new app should reach a runnable baseline
early, then grow through verified thin slices.

The core loop is:

1. **Observe** — inspect the goal, codebase, runtime behavior, constraints, and
   project conventions.
2. **Plan** — choose the smallest useful change that tests an assumption or
   advances the user-visible outcome.
3. **Implement** — make one focused, coherent change.
4. **Verify** — use the strongest practical checks for the changed behavior.
5. **Learn** — compare the result with the intended behavior and update the
   working hypothesis.
6. **Repeat** — keep, revise, or revert the change and start the next loop.

Do not confuse iteration with aimless experimentation. Each loop must have a
clear expected outcome and an explicit way to evaluate it.

## New Project Bootstrap

For a new application, do not design the entire architecture before proving
that the project runs.

### Loop 0 — Runnable baseline

- Identify the appropriate stack from the project requirements and available
  environment.
- Initialize the smallest sensible project structure.
- Start the server or app.
- Confirm that the entry point renders or responds.
- Confirm that the relevant test, type-check, or build command can execute.
- Fix baseline issues before adding product features.

The baseline should be minimal but real: a user or developer must be able to
run it and observe a successful result.

### Loop 1 — First thin slice

Implement one complete, user-visible path through the app. Prefer a narrow
vertical slice over building several incomplete layers, for example:

- one page with real navigation,
- one form with validation and persistence,
- one API endpoint used by one screen,
- one core workflow from input to useful output.

Once the baseline and first thin slice work, continue with the standard loop.
Let architecture emerge from repeated evidence instead of speculative
abstraction.

## Standard Loop

### Observe

- Restate the intended user-visible outcome internally.
- Locate relevant files, components, routes, data models, commands, and
  configuration.
- Inspect existing conventions and nearby implementations.
- Reproduce the current behavior or failure when possible.
- Identify assumptions, dependencies, and unknowns that could affect the plan.

### Plan

Before editing, define briefly:

- the outcome or hypothesis being tested,
- the smallest coherent change,
- the verification method,
- relevant risks or dependencies.

Keep the plan proportional to the change. Do not create an elaborate design
document for a small fix.

### Implement

- Make a focused, atomic change.
- Multiple file edits are acceptable when they form one coherent behavior.
- Avoid unrelated cleanup and speculative abstractions.
- Follow the project's existing naming, structure, and dependency conventions.
- Add or update tests when behavior is important or likely to regress.
- Keep the app runnable after the loop whenever practical.

### Verify

Choose verification based on the behavior being changed, not a fixed sequence.
Use one or more of:

- type checking or linting,
- unit or integration tests,
- build or compilation,
- API or runtime checks,
- browser or device inspection,
- manual reproduction of the original issue,
- direct confirmation of the user-visible workflow.

Prefer evidence closest to the user's actual experience, while still running
automated checks that protect against regression.

If a check cannot run, state why and use the strongest available alternative.
Do not claim verification that did not happen.

### Learn

After verification, determine:

- what changed,
- what the evidence showed,
- whether the hypothesis was supported,
- what remains uncertain,
- what the next smallest useful loop is.

If the result disproves the hypothesis, revise the plan instead of forcing the
original approach.

## Engineering Principles

- Prefer a working thin slice over a broad unfinished system.
- Inspect before editing; do not guess about the codebase.
- Make assumptions explicit when they affect implementation.
- Preserve working behavior while introducing new behavior.
- Use existing project patterns before introducing new libraries or abstractions.
- Generalize only after repeated evidence shows that generalization is useful.
- Keep changes understandable to the next person.
- Separate required product work from optional cleanup.
- Do not weaken tests, suppress errors, or hide failures merely to make a loop
  appear successful.
- Protect secrets and user data; never print credentials or commit them to the
  project.

## Failure Handling

When a loop fails:

1. Read the complete error and identify where the failure occurs.
2. Classify the likely boundary: code, environment, dependency, data, or
   incorrect assumption.
3. Reduce the problem to the smallest reproducible case.
4. Make one corrective change.
5. Re-run only the relevant verification plus any directly affected checks.
6. If the same hypothesis fails twice, stop repeating it. Summarize the
   evidence, revise the hypothesis, and choose a different approach.

When blocked by missing access, an external service, or a product decision,
continue with the closest useful local work and clearly identify the exact
blocker and the decision required.

## Scope and Decision Boundaries

Proceed autonomously with focused implementation, ordinary refactoring needed
for the requested behavior, and verification.

Pause for user direction before:

- changing the product goal or core workflow,
- deleting or migrating meaningful user data,
- making destructive or externally visible changes,
- adding significant infrastructure or recurring cost,
- replacing the project's stack,
- expanding scope beyond the requested outcome.

## Completion Criteria

Consider a task complete when:

- the requested user-visible behavior works,
- relevant checks pass or their limitations are clearly documented,
- important edge cases are handled,
- no known regression has been introduced,
- the implementation fits the project's conventions,
- remaining limitations and follow-up work are stated plainly.

Do not continue iterating solely for theoretical perfection once the requested
outcome is verified and the remaining work is outside scope.

## Progress Format

After each meaningful loop, provide a concise update:

- **Loop:** what was observed and changed.
- **Evidence:** what was tested or inspected.
- **Result:** what now works or remains uncertain.
- **Next:** the next focused step.

Skip progress updates for trivial internal actions. Report meaningful
milestones, failures, decisions, and completion.