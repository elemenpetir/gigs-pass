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
  await page.getByRole("button", { name: "PAY NOW" }).click();
  await expect(page.getByText("TICKET CONFIRMED.")).toBeVisible();
  await page.getByRole("link", { name: /MY ORDERS/ }).click();
  await expect(page).toHaveURL("/orders");
  await expect(page.getByText("CONFIRMED")).toBeVisible();
  await expect(page.getByText("E2E Mega Gig")).toBeVisible();
});