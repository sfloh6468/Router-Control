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
 * The five scenarios are:
 *   1. (task #5) Selecting "Huawei OLT" locks Port=22 and hides the Transport
 *      selector.
 *   2. (task #5) After a (mocked) successful OLT connect the sidebar shows
 *      ONUs / Service Ports / Alarms (and not the MikroTik items).
 *   3. (task #5) Cross-vendor URLs (e.g. /interfaces) redirect to /dashboard
 *      while connected as OLT.
 *   4. (task #5) The chat sends `vendor: "huawei-olt"` in its POST body.
 *   5. (task #12) Flipping vendor MikroTik → Huawei OLT → MikroTik on the
 *      connect screen restores Transport=api-ssl and Port=8729 (enabled).
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
  await context.route("**/api/olt/user-logins", (route) =>
    route.fulfill(
      json({
        success: true,
        sessions: [
          {
            id: "live-1",
            username: "root",
            sourceIp: "10.10.0.5",
            channel: "ssh",
            loginAt: "2026-04-23 10:00:00",
            logoutAt: null,
            result: "ok",
            active: true,
            kickHandle: "0",
          },
        ],
        rawOnline: "",
        rawLog: "",
        ingested: 0,
      }),
    ),
  );
  await context.route("**/api/olt/login-history**", (route) => {
    const url = route.request().url();
    if (route.request().method() === "DELETE") {
      route.fulfill(json({ success: true, deleted: 1 }));
      return;
    }
    // CSV export — return a minimal valid CSV with the contract'd headers.
    if (url.includes("/login-history.csv")) {
      route.fulfill({
        status: 200,
        contentType: "text/csv; charset=utf-8",
        headers: {
          "Content-Disposition": 'attachment; filename="olt-login-history__10.0.0.1__earliest_latest.csv"',
        },
        body:
          "\uFEFF" +
          'host,username,source_ip,channel,login_at,logout_at,result,seen_at\r\n' +
          '"10.0.0.1","root","10.10.0.99","ssh","2026-04-22T09:30:00.000Z","2026-04-22T10:00:00.000Z","success","2026-04-22T10:00:05.000Z"\r\n',
      });
      return;
    }
    route.fulfill(
      json({
        success: true,
        events: [
          {
            id: 42,
            ownerUserId: "test-user",
            host: "10.0.0.1",
            username: "root",
            sourceIp: "10.10.0.99",
            channel: "ssh",
            loginAt: "2026-04-22T09:30:00.000Z",
            loginAtRaw: "2026-04-22 09:30:00",
            logoutAt: "2026-04-22T10:00:00.000Z",
            logoutAtRaw: "2026-04-22 10:00:00",
            result: "ok",
            seenAt: "2026-04-22T10:00:05.000Z",
            lastSeenAt: "2026-04-22T10:00:05.000Z",
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      }),
    );
  });
  await context.route("**/api/olt/password-policy", (route) =>
    route.fulfill(json({ success: true, policy: null })),
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

  test("switching vendor MikroTik → Huawei OLT → MikroTik resets transport/port", async ({
    page,
    context,
  }) => {
    await installBackendMocks(context);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Network Device Manager/i })).toBeVisible();

    const mikrotikBtn = page.getByRole("button", { name: "MikroTik" });
    const oltBtn = page.getByRole("button", { name: "Huawei OLT" });
    const portInput = page.locator('input[name="port"]');
    const transportSelect = page.locator('select[name="transport"]');

    // Baseline: MikroTik default.
    await expect(transportSelect).toBeVisible();
    await expect(transportSelect).toHaveValue("api-ssl");
    await expect(portInput).toHaveValue("8729");
    await expect(portInput).toBeEnabled();

    // Flip to Huawei OLT — port locks to 22 and transport selector disappears.
    await oltBtn.click();
    await expect(transportSelect).toHaveCount(0);
    await expect(portInput).toHaveValue("22");
    await expect(portInput).toBeDisabled();

    // Flip back to MikroTik — transport selector returns and the form
    // resets to api-ssl/8729 with the port input re-enabled.
    await mikrotikBtn.click();
    await expect(transportSelect).toBeVisible();
    await expect(transportSelect).toHaveValue("api-ssl");
    await expect(portInput).toHaveValue("8729");
    await expect(portInput).toBeEnabled();
  });

  test("OLT Users page exposes Live ⇄ History toggle and renders DB events", async ({
    page,
    context,
  }) => {
    await installBackendMocks(context);

    // Connect as OLT to seed router context.
    await page.goto("/");
    await page.getByRole("button", { name: "Huawei OLT" }).click();
    await page.locator('input[name="host"]').fill("10.0.0.1");
    await page.locator('input[name="username"]').fill("root");
    await page.locator('input[name="password"]').fill("secret123");
    await page.getByRole("button", { name: /Establish Connection/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 10_000 });

    await page.goto("/olt-users");

    // Both toggle buttons render.
    const liveBtn = page.getByRole("button", { name: /^Live \(device\)$/ });
    const histBtn = page.getByRole("button", { name: /^Historical \(database\)$/ });
    await expect(liveBtn).toBeVisible({ timeout: 10_000 });
    await expect(histBtn).toBeVisible();

    // Live mode is the default and shows the mocked active session.
    await expect(page.getByText("10.10.0.5")).toBeVisible();

    // Switch to historical and verify the DB event row is rendered.
    await histBtn.click();
    const histRow = page.locator('[data-testid="history-row-42"]');
    await expect(histRow).toBeVisible({ timeout: 10_000 });
    await expect(histRow).toContainText("root");
    await expect(histRow).toContainText("10.0.0.1");
    await expect(histRow).toContainText("10.10.0.99");

    // Writer (canWrite=true via /api/admin/me mock) sees a Delete control.
    await expect(histRow.getByRole("button", { name: /Delete/ })).toBeVisible();

    // --- CSV export (Task #14) ---------------------------------------------
    // The Download CSV anchor is visible to all roles, points at the new
    // CSV endpoint with the current filters applied, and triggers a real
    // browser download when clicked.
    // shadcn Button + asChild forwards data-testid onto the rendered <a>.
    const csvAnchor = page.locator('a[data-testid="logins-history-download-csv"]');
    await expect(csvAnchor).toBeVisible();
    const href = await csvAnchor.getAttribute("href");
    expect(href).toContain("/api/olt/login-history.csv");
    expect(href).toContain("host=10.0.0.1");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      csvAnchor.click(),
    ]);
    // The mocked Content-Disposition above sets a stable filename.
    expect(download.suggestedFilename()).toMatch(/^olt-login-history__.*\.csv$/);
  });
});
