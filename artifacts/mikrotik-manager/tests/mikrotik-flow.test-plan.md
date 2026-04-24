# MikroTik vendor flow — Playwright e2e test plan

This is a re-usable test plan for the testing skill (`runTest`). It mirrors the
Huawei OLT plan (`huawei-olt-flow.test-plan.md`) for the MikroTik vendor flow,
exercising the four scenarios called out in task #11:

1. Choosing a Transport snaps the Port to that transport's default
   (api-ssl → 8729, api → 8728, rest-tls → 443, ssh → 22).
2. After a (mocked) successful MikroTik connect the sidebar shows
   **Interfaces / IP Addresses / Firewall / DHCP Leases / Wireless** and
   none of the OLT items (ONUs / Service Ports / Alarms / OLT Users /
   Snapshots).
3. OLT-only URLs (e.g. `/onts`) redirect to `/dashboard` while connected as
   MikroTik.
4. The chat sends `vendor: "mikrotik"` in the request body to
   `POST /api/chat/stream`.

All backend traffic is mocked via Playwright `context.route()` so the test
does not depend on a real MikroTik device or a live api-server.

## How to run

From the agent / code-execution sandbox:

```js
const result = await runTest({
  testClerkAuth: true,
  defaultScreenWidth: 1280,
  defaultScreenHeight: 800,
  testPlan: require("fs").readFileSync(
    "artifacts/mikrotik-manager/tests/mikrotik-flow.test-plan.md",
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

This test verifies the MikroTik vendor flow in the mikrotik-manager UI. ALL
backend traffic must be mocked using Playwright's `context.route()`. Install
the mocks BEFORE navigating, on the browser context, using glob patterns so
they match regardless of the app's base path:

- `context.route("**/api/mikrotik/connect", route => route.fulfill({status:200,contentType:"application/json",body: JSON.stringify({success:true,identity:"MOCK-RB",routerOs:"7.13",routerBoard:"RB4011"})}))`
- `context.route("**/api/profiles/upsert", route => route.fulfill({status:200,contentType:"application/json",body: JSON.stringify({success:true,profile:{id:999999}})}))`
- `context.route("**/api/conversations**", route => route.fulfill({status:200,contentType:"application/json",body: JSON.stringify({conversations:[]})}))`
- `context.route("**/api/admin/me", route => route.fulfill({status:200,contentType:"application/json",body: JSON.stringify({userId:"test-user",role:"super_admin",isSuper:true,canWrite:true})}))`
- Catch-all for any other MikroTik reads (dashboard, interfaces, etc.):
  `context.route("**/api/mikrotik/**", route => route.fulfill({status:200,contentType:"application/json",body: JSON.stringify({success:true,interfaces:[],addresses:[],leases:[],filters:[],clients:[]})}))`
- For chat: `page.route("**/api/chat/stream", async route => { const body = route.request().postDataJSON(); await page.evaluate(b => { window.__lastChatBody = b; }, body); await route.fulfill({status:200,contentType:"text/event-stream",body:"event: text\ndata: {\"text\":\"ok\"}\n\n"}); })`

### Steps

1. [New Context] Create a new browser context.
2. [Browser] Install ALL the route mocks above on the context (and the chat one on the page once it exists).
3. [Clerk Auth] Sign in as `{ firstName: "Test", lastName: "MT", email: \`mt-test-${Date.now()}@example.com\` }`.
4. [Browser] Navigate to `/` (the connect screen).
5. [Verify] The "Network Device Manager" heading is visible. Two vendor buttons appear: "MikroTik" and "Huawei OLT". The Transport `<select>` is visible (MikroTik is the default vendor).
6. [Browser] Click the "MikroTik" vendor button (no-op if already selected) and pick `api-ssl` from the Transport `<select>`.
7. [Verify] **(scenario 1a)** Port input value is `8729`.
8. [Browser] Switch Transport `<select>` to `api`.
9. [Verify] **(scenario 1b)** Port input value is `8728`.
10. [Browser] Switch Transport `<select>` to `rest-tls`.
11. [Verify] **(scenario 1c)** Port input value is `443`.
12. [Browser] Switch Transport `<select>` to `ssh`.
13. [Verify] **(scenario 1d)** Port input value is `22`.
14. [Browser] Switch Transport back to `api-ssl`. Fill Hostname=`192.168.88.1`, Username=`admin`, Password=`secret123`. Click "Establish Connection".
15. [Verify] **(scenario 2)** URL path is `/dashboard`. Sidebar header reads "MikroTik". Sidebar contains links: "Dashboard", "Interfaces", "IP Addresses", "Firewall", "DHCP Leases", "Wireless", "Terminal". Sidebar does NOT contain "ONUs", "Service Ports", "Alarms", "OLT Users", or "Snapshots".
16. [Browser] Navigate to `/onts`.
17. [Verify] **(scenario 3)** URL path resolves to `/dashboard`. MikroTik sidebar items still visible.
18. [Browser] **(scenario 4)** Open the chat sidebar if not open. Type `hello from mt test` into the chat textarea/input and submit (Enter or send button). Wait up to 5 seconds for `window.__lastChatBody` to be defined (use `page.waitForFunction`).
19. [Verify] Read `window.__lastChatBody`. Assert it is an object whose `.vendor === "mikrotik"` and that it has a `.messages` array.

Report which of the four scenarios pass/fail with screenshots.

---

## Executable spec

The same four scenarios are also covered by an executable Playwright spec at
`tests/mikrotik-flow.spec.ts`. Run it locally with:

```bash
pnpm --filter @workspace/mikrotik-manager test:e2e
```

The spec uses a test-only Vite config (`vite.test.config.ts`) that aliases
`@clerk/react` to `tests/clerk-stub.tsx`, so it does not depend on a real
Clerk session. Production code is untouched.
