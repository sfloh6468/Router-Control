import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";

/**
 * End-to-end coverage for the MikroTik vendor flow in the mikrotik-manager
 * UI. Mirrors `huawei-olt-flow.spec.ts` so regressions on the original
 * vendor are caught alongside the OLT regressions.
 *
 * All backend traffic is mocked at the network layer so the suite does
 * not depend on a real MikroTik device or a live api-server.
 *
 * Auth: this suite runs against `vite.test.config.ts` which aliases
 * `@clerk/react` to a local stub that always reports the user as
 * signed-in. No production code is changed; the stub only exists for
 * tests.
 *
 * The four scenarios mirror task #11:
 *   1. Picking a Transport snaps the Port input to that transport's
 *      default (api-ssl → 8729, api → 8728, rest-tls → 443, ssh → 22).
 *   2. After a (mocked) successful MikroTik connect the sidebar shows
 *      Interfaces / IP Addresses / Firewall / DHCP Leases / Wireless
 *      (and not the OLT items).
 *   3. OLT-only URLs (e.g. /onts) redirect to /dashboard while
 *      connected as MikroTik.
 *   4. The chat sends `vendor: "mikrotik"` in its POST body.
 */

const json = (body: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function installBackendMocks(context: BrowserContext) {
  await context.route("**/api/mikrotik/connect", (route) =>
    route.fulfill(
      json({
        success: true,
        identity: "MOCK-RB",
        routerOs: "7.13",
        routerBoard: "RB4011",
      }),
    ),
  );
  await context.route("**/api/profiles/upsert", (route) =>
    route.fulfill(json({ success: true, profile: { id: 999_999 } })),
  );
  await context.route("**/api/conversations**", (route) =>
    route.fulfill(json({ conversations: [] })),
  );
  await context.route("**/api/admin/me", (route) =>
    route.fulfill(
      json({ userId: "test-user", role: "super_admin", isSuper: true, canWrite: true }),
    ),
  );
  // Catch-all for any other MikroTik reads (dashboard widgets, etc.).
  // Returns an empty-but-shaped payload so the page renders without
  // throwing.
  await context.route("**/api/mikrotik/**", (route) =>
    route.fulfill(
      json({
        success: true,
        interfaces: [],
        addresses: [],
        leases: [],
        filters: [],
        clients: [],
      }),
    ),
  );
  // OLT endpoints should never be hit on a MikroTik session. If they
  // somehow are, return empty success so the test still surfaces the
  // sidebar/route assertions instead of network errors.
  await context.route("**/api/olt/**", (route) =>
    route.fulfill(json({ success: true })),
  );
}

async function installChatMock(page: Page, captured: { body?: any }) {
  await page.route("**/api/chat/stream", async (route: Route) => {
    captured.body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "event: text\ndata: {\"text\":\"ok\"}\n\n",
    });
  });
}

test.describe("MikroTik vendor flow", () => {
  test("transport→port snap, MikroTik sidebar, cross-vendor redirect, chat vendor payload", async ({
    page,
    context,
  }) => {
    const captured: { body?: any } = {};
    await installBackendMocks(context);
    await installChatMock(page, captured);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Network Device Manager/i })).toBeVisible();

    const mikrotikBtn = page.getByRole("button", { name: "MikroTik" });
    const oltBtn = page.getByRole("button", { name: "Huawei OLT" });
    await expect(mikrotikBtn).toBeVisible();
    await expect(oltBtn).toBeVisible();

    // MikroTik is the default vendor — Transport selector must be visible.
    const transport = page.locator('select[name="transport"]');
    const portInput = page.locator('input[name="port"]');
    await expect(transport).toBeVisible();

    // --- Scenario 1: transport → port snap ----------------------------------
    // The connect form's useEffect runs on every transport change; assert
    // each (transport, expected port) pair.
    for (const [value, expected] of [
      ["api-ssl", "8729"],
      ["api", "8728"],
      ["rest-tls", "443"],
      ["ssh", "22"],
    ] as const) {
      await transport.selectOption(value);
      await expect(portInput).toHaveValue(expected);
      // Port must remain editable for MikroTik (only OLT locks it).
      await expect(portInput).toBeEnabled();
    }

    // --- Connect (mocked) ----------------------------------------------------
    await transport.selectOption("api-ssl");
    await page.locator('input[name="host"]').fill("192.168.88.1");
    await page.locator('input[name="username"]').fill("admin");
    await page.locator('input[name="password"]').fill("secret123");
    await page.getByRole("button", { name: /Establish Connection/i }).click();

    await page.waitForURL("**/dashboard", { timeout: 10_000 });

    // --- Scenario 2: MikroTik sidebar ---------------------------------------
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toContainText("MikroTik");
    for (const item of [
      "Dashboard",
      "Interfaces",
      "IP Addresses",
      "Firewall",
      "DHCP Leases",
      "Wireless",
      "Terminal",
    ]) {
      await expect(sidebar.getByRole("link", { name: item, exact: true })).toBeVisible();
    }
    for (const item of ["ONUs", "Service Ports", "Alarms", "OLT Users", "Snapshots"]) {
      await expect(sidebar.getByRole("link", { name: item, exact: true })).toHaveCount(0);
    }

    // --- Scenario 3: cross-vendor redirect ----------------------------------
    await page.goto("/onts");
    await page.waitForURL("**/dashboard", { timeout: 5_000 });
    await expect(sidebar.getByRole("link", { name: "Interfaces", exact: true })).toBeVisible();

    // --- Scenario 4: chat sends vendor: "mikrotik" --------------------------
    const chatInput = page.getByPlaceholder(/Describe what you want to do/i);
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    await chatInput.fill("hello from mt test");
    await chatInput.press("Enter");

    await expect.poll(() => captured.body, { timeout: 10_000 }).toBeTruthy();
    expect(captured.body.vendor).toBe("mikrotik");
    expect(Array.isArray(captured.body.messages)).toBe(true);
  });
});
