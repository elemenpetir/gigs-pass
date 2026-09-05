import { test, expect } from "@playwright/test";
import {
  registerViaAPI,
  loginViaAPI,
  loginViaUI,
  createPublishedEvent,
} from "./helpers.js";

// Organizer: Manage ticket categories (tiers)
test("organizer manages ticket categories", async ({ page, request }) => {
  const stamp = Date.now();
  const orgEmail = `org-cat-${stamp}@test.local`;

  // Setup: register organizer, create event, publish
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

  // Login via UI and go to categories page
  await loginViaUI(page, orgEmail, "Password123!");
  await page.goto(`/organizer/events/${event.id}/categories`);

  // Add new tier
  await page.locator("#cat-name").fill("Early Bird");
  await page.locator("#cat-price").fill("250000");
  await page.locator("#cat-quota").fill("100");
  await page.getByTestId("category-form-submit").click();
  await expect(page.getByText("Early Bird")).toBeVisible();
  await expect(page.getByText(/Rp\s*250\.000/)).toBeVisible();

  // Add second tier
  await page.locator("#cat-name").fill("VIP");
  await page.locator("#cat-price").fill("500000");
  await page.locator("#cat-quota").fill("50");
  await page.getByTestId("category-form-submit").click();
  await expect(page.getByText("VIP")).toBeVisible();

  // Edit first tier price
  await page.getByRole("button", { name: /Edit/ }).first().click();
  await page.locator('input[value="250000"]').fill("300000");
  // Save edit - find by dynamic testid
  await page.getByTestId(/category-save-/).first().click();
  await expect(page.getByText(/Rp\s*300\.000/)).toBeVisible();
});