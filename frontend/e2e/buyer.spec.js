import { test, expect } from "@playwright/test";
import {
  registerViaAPI,
  loginViaAPI,
  createPublishedEvent,
  createCategory,
  loginViaUI,
} from "./helpers.js";

// Fixture event dibuat via API (jalur asli: create + publish + kategori
// sehingga init stok Redis ikut teruji). Flow buyer penuh via UI.
test("buyer full flow: join, granted, checkout, pay, history", async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  const orgEmail = `org-${stamp}@test.local`;
  const buyerEmail = `buyer-${stamp}@test.local`;
  await registerViaAPI(request, {
    email: orgEmail,
    password: "Password123!",
    role: "organizer",
    name: "E2E Organizer",
  });
  const orgToken = await loginViaAPI(request, {
    email: orgEmail,
    password: "Password123!",
  });
  const event = await createPublishedEvent(request, orgToken);
  await createCategory(request, orgToken, event.id);
  await registerViaAPI(request, {
    email: buyerEmail,
    password: "Password123!",
    role: "buyer",
    name: "E2E Buyer",
  });

  await loginViaUI(page, buyerEmail, "Password123!");
  await expect(page).toHaveURL("/");
  await page.goto(`/events/${event.id}`);
  await page.getByRole("button", { name: /GET TICKETS/ }).first().click();
  await expect(page).toHaveURL(
    new RegExp(`/events/${event.id}/join/`),
  );
  await expect(page.getByText("SECURING YOUR SPOT")).toBeVisible();
  await expect(page.getByText("GRAB IT")).toBeVisible({ timeout: 30000 });
  await expect(page).toHaveURL(
    new RegExp(`/events/${event.id}/checkout/`),
    { timeout: 15000 },
  );
  await expect(page.getByText("PAY WITHIN")).toBeVisible();

  // Capture pay API response untuk diagnostik
  const payResponsePromise = page.waitForResponse(
    (resp) => resp.url().includes("/orders/") && resp.url().includes("/pay"),
    { timeout: 15000 }
  );
  await page.getByRole("button", { name: "PAY NOW" }).click();
  const payResponse = await payResponsePromise;
  console.log(`[E2E] Pay API response: ${payResponse.status()} ${payResponse.statusText()}`);
  const payBody = await payResponse.json().catch(() => null);
  console.log("[E2E] Pay API body:", JSON.stringify(payBody));
  expect(payResponse.ok(), `Pay API failed: ${payResponse.status()} - ${JSON.stringify(payBody)}`).toBeTruthy();

  // Success state: "TICKET CONFIRMED." mungkin punya <br /> di tengah, pakai regex
  await expect(page.getByText(/TICKET\s+CONFIRMED\./)).toBeVisible({ timeout: 10000 });
  await page.getByRole("link", { name: /MY ORDERS/ }).click();
  await expect(page).toHaveURL("/orders");
  await expect(page.getByText("CONFIRMED")).toBeVisible();
  await expect(page.getByText("E2E Mega Gig")).toBeVisible();
});