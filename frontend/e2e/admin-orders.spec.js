import { test, expect } from "@playwright/test";
import {
  registerViaAPI,
  loginViaAPI,
  loginAsAdminViaUI,
  createPublishedEvent,
  createCategory,
  buyTicketViaAPI,
  waitForOrderStatus,
  API_URL,
} from "./helpers.js";

// Admin: Override orders (hold dan refund).
// Dua buyer membeli via flow antrean asli, event_date digeser dekat lewat
// job orderLifecycle (interval 2 detik di workflow E2E) mempromosikan
// pending ke holding_period, lalu admin override via UI.
test("admin overrides orders: hold and refund", async ({ page, request }) => {
  const stamp = Date.now();
  const orgEmail = `org-admin-ord-${stamp}@test.local`;
  const buyerAEmail = `buyer-a-${stamp}@test.local`;
  const buyerBEmail = `buyer-b-${stamp}@test.local`;

  await registerViaAPI(request, {
    email: orgEmail,
    password: "Password123!",
    role: "organizer",
    name: "E2E Organizer",
  });
  await registerViaAPI(request, {
    email: buyerAEmail,
    password: "Password123!",
    role: "buyer",
    name: "Buyer A",
  });
  await registerViaAPI(request, {
    email: buyerBEmail,
    password: "Password123!",
    role: "buyer",
    name: "Buyer B",
  });
  const orgToken = await loginViaAPI(request, {
    email: orgEmail,
    password: "Password123!",
  });
  const buyerAToken = await loginViaAPI(request, {
    email: buyerAEmail,
    password: "Password123!",
  });
  const buyerBToken = await loginViaAPI(request, {
    email: buyerBEmail,
    password: "Password123!",
  });
  const adminLogin = await request.post(`${API_URL}/auth/login`, {
    data: { email: "admin@e2e.local", password: "AdminPass123!" },
  });
  if (!adminLogin.ok()) {
    throw new Error(`admin login failed: ${adminLogin.status()}`);
  }
  const adminToken = (await adminLogin.json()).data.token;

  const event = await createPublishedEvent(request, orgToken);
  const category = await createCategory(request, orgToken, event.id);

  const orderA = await buyTicketViaAPI(request, buyerAToken, category.id);
  const orderB = await buyTicketViaAPI(request, buyerBToken, category.id);

  // Geser event_date ke dekat (3 detik) agar lifecycle mempromosikan ke holding.
  const soon = new Date(Date.now() + 3000).toISOString();
  const dateRes = await request.put(`${API_URL}/events/${event.id}`, {
    headers: { Authorization: `Bearer ${orgToken}` },
    data: { event_date: soon },
  });
  if (!dateRes.ok()) {
    throw new Error(`set event date failed: ${dateRes.status()}`);
  }
  await waitForOrderStatus(request, adminToken, orderA.id, "holding_period");
  await waitForOrderStatus(request, adminToken, orderB.id, "holding_period");

  // Override via UI: order A di-hold, order B di-refund.
  await loginAsAdminViaUI(page);
  await page.goto("/admin/orders");
  await expect(page.getByText("ORDER OVERRIDE")).toBeVisible();

  // Override via UI: order A di-hold, order B di-refund.
  // Respons API ditangkap agar kegagalan backend terlihat di log.
  const holdRespPromise = page.waitForResponse(
    (resp) => resp.url().includes(`/admin/orders/${orderA.id}/override`),
    { timeout: 15000 },
  );
  await page.getByTestId(`admin-hold-${orderA.id}`).click();
  const holdResp = await holdRespPromise;
  console.log(`[E2E] Override hold response: ${holdResp.status()}`);
  if (!holdResp.ok()) {
    throw new Error(`override hold failed: ${holdResp.status()}`);
  }
  await expect(page.getByText("HELD").first()).toBeVisible({ timeout: 15000 });

  const refundRespPromise = page.waitForResponse(
    (resp) => resp.url().includes(`/admin/orders/${orderB.id}/override`),
    { timeout: 15000 },
  );
  await page.getByTestId(`admin-refund-${orderB.id}`).click();
  const refundResp = await refundRespPromise;
  console.log(`[E2E] Override refund response: ${refundResp.status()}`);
  if (!refundResp.ok()) {
    throw new Error(`override refund failed: ${refundResp.status()}`);
  }
  await expect(page.getByText("REFUNDED").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("ADMIN PUTUSAN").first()).toBeVisible();
});
