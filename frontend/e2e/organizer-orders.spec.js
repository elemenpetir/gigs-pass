import { test, expect } from "@playwright/test";
import {
  registerViaAPI,
  loginViaAPI,
  loginViaUI,
  createPublishedEvent,
  createCategory,
} from "./helpers.js";

// Organizer: View orders and analytics
test("organizer views orders and analytics", async ({ page, request }) => {
  const stamp = Date.now();
  const orgEmail = `org-ord-${stamp}@test.local`;

  // Setup: register organizer, create event, publish, add category
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

  // Login via UI and go to orders page
  await loginViaUI(page, orgEmail, "Password123!");
  await page.goto(`/organizer/events/${event.id}/orders`);

  // Verify analytics cards render
  await expect(page.getByText("Total Revenue")).toBeVisible();
  await expect(page.getByText("Net Revenue")).toBeVisible();
  await expect(page.getByText("Tickets Sold")).toBeVisible();
  await expect(page.getByText("Available Funds")).toBeVisible();

  // Verify status breakdown
  await expect(page.getByText("Order Breakdown")).toBeVisible();
  await expect(page.getByText("Sold")).toBeVisible();
  await expect(page.getByText("Awaiting")).toBeVisible();

  // Verify charts render
  await expect(page.getByText("Revenue by Category")).toBeVisible();
  await expect(page.getByText("Order Status")).toBeVisible();

  // Verify orders table (empty state initially)
  await expect(page.getByText("No orders yet")).toBeVisible();
});