/* eslint-env node */
import { expect } from "@playwright/test";

export const API_URL =
  process.env.PLAYWRIGHT_API_URL || "http://localhost:5000/api";

export const uniqueEmail = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;

export async function registerViaAPI(
  request,
  { email, password, role, name },
) {
  const res = await request.post(`${API_URL}/auth/register`, {
    data: { email, password, role, name },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

export async function loginViaAPI(request, { email, password }) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.data.token;
}

export async function createPublishedEvent(request, token, overrides = {}) {
  const eventDate = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const createRes = await request.post(`${API_URL}/events`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: "E2E Mega Gig",
      description: "E2E fixture event",
      event_date: eventDate,
      category: "music",
      ...overrides,
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const event = (await createRes.json()).data.event;
  const pubRes = await request.put(
    `${API_URL}/events/${event.id}/publish`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(pubRes.ok()).toBeTruthy();
  return event;
}

export async function createCategory(request, token, eventId, overrides = {}) {
  const res = await request.post(`${API_URL}/events/${eventId}/categories`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: "Reguler", price: 100000, quota: 5, ...overrides },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data.category;
}

export async function loginViaUI(page, email, password) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /EXPLORE EVENTS/ }).click();
  // Tunggu login selesai (mendarat di from default "/") sebelum lanjut,
  // agar token session pasti tersimpan dan tidak balapan dengan goto berikut.
  await page.waitForURL("/");
}

export async function getAdminToken(request) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email: "admin@e2e.local", password: "AdminPass123!" },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.data.token;
}

export async function createEventViaUI(page, { title, category, eventDate, description }) {
  await page.goto("/organizer/events/new");
  await page.locator("#title").fill(title);
  await page.locator("#category").selectOption(category);
  await page.locator("#event-date").fill(eventDate);
  await page.locator("#description").fill(description);
  await page.getByTestId("event-form-submit").click();
  // Wait for redirect to organizer events list
  await page.waitForURL("/organizer/events");
}

export async function loginAsAdminViaUI(page) {
  await page.goto("/login");
  await page.locator("#email").fill("admin@e2e.local");
  await page.locator("#password").fill("AdminPass123!");
  await page.getByRole("button", { name: /EXPLORE EVENTS/ }).click();
  await page.waitForURL("/");
}

// Flow beli tiket penuh via API (jalur asli: join antrean, tunggu granted
// lewat stream yang ditutup server, verifikasi lock, create order, pay).
// Kembalian: order yang sudah pending (lunas).
export async function buyTicketViaAPI(request, buyerToken, categoryId) {
  const joinRes = await request.post(`${API_URL}/queue/${categoryId}/join`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  if (!joinRes.ok()) {
    throw new Error(`join failed: ${joinRes.status()}`);
  }
  // Stream ditutup server saat granted; GET selesai = sudah di-admit.
  const streamRes = await request.get(`${API_URL}/queue/${categoryId}/stream`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
    timeout: 30000,
  });
  if (![200, 408].includes(streamRes.status())) {
    throw new Error(`stream failed: ${streamRes.status()}`);
  }
  const lockRes = await request.post(
    `${API_URL}/checkout/${categoryId}/lock`,
    { headers: { Authorization: `Bearer ${buyerToken}` } },
  );
  if (!lockRes.ok()) {
    throw new Error(`lock verify failed: ${lockRes.status()}`);
  }
  const orderRes = await request.post(`${API_URL}/orders`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
    data: { categoryId },
  });
  if (!orderRes.ok()) {
    throw new Error(`create order failed: ${orderRes.status()}`);
  }
  const order = (await orderRes.json()).data.order;
  const payRes = await request.post(`${API_URL}/orders/${order.id}/pay`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
    data: { success: true },
  });
  if (!payRes.ok()) {
    throw new Error(`pay failed: ${payRes.status()}`);
  }
  return (await payRes.json()).data.order;
}

// Poll daftar order admin sampai order target mencapai status tertentu.
// Dipakai menunggu job orderLifecycle mempromosikan pending ke holding_period.
export async function waitForOrderStatus(
  request,
  adminToken,
  orderId,
  status,
  timeoutMs = 30000,
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await request.get(`${API_URL}/admin/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok()) {
      throw new Error(`admin orders failed: ${res.status()}`);
    }
    const orders = (await res.json()).data.orders || [];
    const found = orders.find((o) => o.id === orderId);
    if (found && found.status === status) {
      return found;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `timeout waiting order ${orderId} -> ${status}`,
      );
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}
