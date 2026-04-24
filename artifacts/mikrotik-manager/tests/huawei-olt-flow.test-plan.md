# Huawei OLT vendor flow — Playwright e2e test plan

This is a re-usable test plan for the testing skill (`runTest`). It exercises
the four scenarios called out in task #5:

1. Selecting **Huawei OLT** on the connect screen locks Port to `22` and hides
   the Transport selector.
2. After a (mocked) successful OLT connect the sidebar shows
   **ONUs / Service Ports / Alarms** instead of MikroTik items.
3. Cross-vendor URLs (e.g. `/interfaces` while connected as OLT) redirect to
   `/dashboard`.
4. The chat sends `vendor: "huawei-olt"` in the request body to
   `POST /api/chat/stream`.

All backend traffic is mocked via Playwright `context.route()` so the test
does not depend on a real Huawei OLT or real API server responses.

## How to run

From the agent / code-execution sandbox:

```js
const result = await runTest({
  testClerkAuth: true,
  defaultScreenWidth: 1280,
  defaultScreenHeight: 800,
  testPlan: require("fs").readFileSync(
    "artifacts/mikrotik-manager/tests/huawei-olt-flow.test-plan.md",
    "utf8",
  ),
  relevantTechnicalDocumentation: `
APP: artifacts/mikrotik-manager (React+Vite+wouter), base path "/" in dev. API at "/api".
KEY FILES: src/pages/connection.tsx, src/App.tsx, src/components/layout.tsx, src/lib/chat-context.tsx.
AUTH: Clerk via @clerk/react. Use [Clerk Auth] for programmatic login.
  `,
});
```

The agent may also paste the body of this file directly into the `testPlan`
argument; the prose below is the actual test plan.

---

## Test plan

This test verifies the Huawei OLT vendor flow in the mikrotik-manager UI. ALL
backend traffic must be mocked using Playwright's `context.route()`. Install
the mocks BEFORE navigating, on the browser context, using glob patterns so
they match regardless of the app's base path:

- `context.route("**/api/olt/connect", route => route.fulfill({status:200,contentType:"application/json",body: JSON.stringify({success:true,identity:"MOCK-OLT-EA5801E",routerOs:"MA5800V100R022C00",routerBoard:"EA5801E"})}))`
- `context.route("**/api/profiles/upsert", route => route.fulfill({status:200,contentType:"application/json",body: JSON.stringify({success:true,profile:{id:999999}})}))`
- `context.route("**/api/conversations**", route => route.fulfill({status:200,contentType:"application/json",body: JSON.stringify({conversations:[]})}))`
- `context.route("**/api/admin/me", route => route.fulfill({status:200,contentType:"application/json",body: JSON.stringify({userId:"test-user",role:"super_admin",isSuper:true,canWrite:true})}))`
- `context.route("**/api/olt/dashboard", route => route.fulfill({status:200,contentType:"application/json",body: JSON.stringify({success:true})}))`
- `context.route("**/api/olt/onts", route => route.fulfill({status:200,contentType:"application/json",body: JSON.stringify({success:true,onts:[]})}))`
- `context.route("**/api/olt/service-ports", route => route.fulfill({status:200,contentType:"application/json",body: JSON.stringify({success:true,ports:[]})}))`
- `context.route("**/api/olt/alarms", route => route.fulfill({status:200,contentType:"application/json",body: JSON.stringify({success:true,alarms:[]})}))`
- For chat: `page.route("**/api/chat/stream", async route => { const body = route.request().postDataJSON(); await page.evaluate(b => { window.__lastChatBody = b; }, body); await route.fulfill({status:200,contentType:"text/event-stream",body:"event: text\ndata: {\"text\":\"ok\"}\n\n"}); })`

### Steps

1. [New Context] Create a new browser context.
2. [Browser] Install ALL the route mocks above on the context (and the chat one on the page once it exists).
3. [Clerk Auth] Sign in as `{ firstName: "Test", lastName: "OLT", email: \`olt-test-${Date.now()}@example.com\` }`.
4. [Browser] Navigate to `/` (the connect screen).
5. [Verify] The "Network Device Manager" heading is visible. Two vendor buttons appear: "MikroTik" and "Huawei OLT". The Transport `<select>` is currently visible.
6. [Browser] Click the "Huawei OLT" vendor button.
7. [Verify] **(scenario 1)** The Port input value is `22` AND the input is disabled. The Transport `<select>` element is no longer present in the DOM.
8. [Browser] Fill Hostname=`10.0.0.1`, Username=`root`, Password=`secret123`. Click "Establish Connection".
9. [Verify] **(scenario 2)** URL path is `/dashboard`. Sidebar contains links: "Dashboard", "ONUs", "Service Ports", "Alarms", "OLT Users", "Terminal". Sidebar does NOT contain "Interfaces", "Firewall", "DHCP Leases", or "Wireless". Sidebar header reads "Huawei OLT".
10. [Browser] Navigate to `/interfaces`.
11. [Verify] **(scenario 3)** URL path resolves to `/dashboard`. OLT sidebar items still visible.
12. [Browser] **(scenario 4)** Open the chat sidebar if not open. Type `hello from olt test` into the chat textarea/input and submit (Enter or send button). Wait up to 5 seconds for `window.__lastChatBody` to be defined (use `page.waitForFunction`).
13. [Verify] Read `window.__lastChatBody`. Assert it is an object whose `.vendor === "huawei-olt"` and that it has a `.messages` array.

Report which of the four scenarios pass/fail with screenshots.

---

## Executable spec

The same four scenarios are also covered by an executable Playwright spec at
`tests/huawei-olt-flow.spec.ts`. Run it locally with:

```bash
pnpm --filter @workspace/mikrotik-manager test:e2e
```

The spec uses a test-only Vite config (`vite.test.config.ts`) that aliases
`@clerk/react` to `tests/clerk-stub.tsx`, so it does not depend on a real
Clerk session. Production code is untouched.

## Last verified

- 2026-04-24 — `runTest` returned `status: "success"` with all four scenarios
  passing (subagent `8bb36a09-60d1-40c5-ab26-521986cc4072`).
- 2026-04-24 — `pnpm test:e2e` Playwright spec passed (1/1).
