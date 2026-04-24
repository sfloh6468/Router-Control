import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";

/**
 * End-to-end coverage for the Huawei OLT vendor flow in the mikrotik-manager
 * UI. All backend traffic is mocked at the network layer so the suite does
 * not depend on a real Huawei OLT or a live api-server.
 *
 * Auth: this suite runs against a Vite config (`vite.test.config.ts`) that
 * aliases `@clerk/react` to a local stub which always reports the user as
 * signed-in. No production code is changed; the stub only exists for tests.
 *
 * The four scenarios mirror task #5:
 *   1. Selecting "Huawei OLT" locks Port=22 and hides the Transport selector.
 *   2. After a (mocked) successful OLT connect the sidebar shows
 *      ONUs / Service Ports / Alarms (and not the MikroTik items).
 *   3. Cross-vendor URLs (e.g. /interfaces) redirect to /dashboard while
 *      connected as OLT.
 *   4. The chat sends `vendor: "huawei-olt"` in its POST body.
 */

const json = (body: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function installBackendMocks(context: BrowserContext) {
  await context.route("**/api/olt/connect", (route) =>
    route.fulfill(
      json({
        success: true,
        identity: "MOCK-OLT-EA5801E",
        routerOs: "MA5800V100R022C00",
        routerBoard: "EA5801E",
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
  await context.route("**/api/olt/dashboard", (route) =>
    route.fulfill(json({ success: true })),
  );
  await context.route("**/api/olt/onts", (route) =>
    route.fulfill(json({ success: true, onts: [] })),
  );
  await context.route("**/api/olt/service-ports", (route) =>
    route.fulfill(json({ success: true, ports: [] })),
  );
  await context.route("**/api/olt/alarms", (route) =>
    route.fulfill(json({ success: true, alarms: [] })),
  );
  await context.route("**/api/olt/users", (route) =>
    route.fulfill(json({ success: true, users: [] })),
  );
  await context.route("**/api/mikrotik/**", (route) =>
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

test.describe("Huawei OLT vendor flow", () => {
  test("vendor lock, OLT sidebar, cross-vendor redirect, chat vendor payload", async ({
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

    // Transport selector starts visible (MikroTik default).
    await expect(page.locator('select[name="transport"]')).toBeVisible();

    // --- Scenario 1: vendor lock --------------------------------------------
    await oltBtn.click();
    const portInput = page.locator('input[name="port"]');
    await expect(portInput).toHaveValue("22");
    await expect(portInput).toBeDisabled();
    await expect(page.locator('select[name="transport"]')).toHaveCount(0);

    // --- Connect (mocked) ----------------------------------------------------
    await page.locator('input[name="host"]').fill("10.0.0.1");
    await page.locator('input[name="username"]').fill("root");
    await page.locator('input[name="password"]').fill("secret123");
    await page.getByRole("button", { name: /Establish Connection/i }).click();

    await page.waitForURL("**/dashboard", { timeout: 10_000 });

    // --- Scenario 2: OLT sidebar --------------------------------------------
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toContainText("Huawei OLT");
    for (const item of ["Dashboard", "ONUs", "Service Ports", "Alarms", "OLT Users", "Terminal"]) {
      await expect(sidebar.getByRole("link", { name: item, exact: true })).toBeVisible();
    }
    for (const item of ["Interfaces", "Firewall", "DHCP Leases", "Wireless", "IP Addresses"]) {
      await expect(sidebar.getByRole("link", { name: item, exact: true })).toHaveCount(0);
    }

    // --- Scenario 3: cross-vendor redirect ----------------------------------
    await page.goto("/interfaces");
    await page.waitForURL("**/dashboard", { timeout: 5_000 });
    await expect(sidebar.getByRole("link", { name: "ONUs", exact: true })).toBeVisible();

    // --- Scenario 4: chat sends vendor: "huawei-olt" ------------------------
    const chatInput = page.getByPlaceholder(/Describe what you want to do/i);
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    await chatInput.fill("hello from olt test");
    await chatInput.press("Enter");

    await expect.poll(() => captured.body, { timeout: 10_000 }).toBeTruthy();
    expect(captured.body.vendor).toBe("huawei-olt");
    expect(Array.isArray(captured.body.messages)).toBe(true);
  });
});
