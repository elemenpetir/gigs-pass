import { test, expect } from "@playwright/test";
import {
  registerViaAPI,
  loginViaAPI,
  loginAsAdminViaUI,
  createPublishedEvent,
} from "./helpers.js";

// Admin: Suspend, Unsuspend, Cancel events
test("admin manages events: suspend, unsuspend, cancel", async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  const orgEmail = `org-admin-${stamp}@test.local`;

  // Setup: create organizer, event, publish
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

  // Login as admin, lalu buka halaman kontrol event
  await loginAsAdminViaUI(page);
  await page.goto("/admin/events");

  // Verify event appears in admin list
  await expect(page.getByText("E2E Mega Gig")).toBeVisible();
  await expect(page.getByText("PUBLISHED")).toBeVisible();

  // Suspend event
  const eventId = event.id;
  await page.getByTestId(`admin-suspend-${eventId}`).click();
  await expect(page.getByText("SUSPENDED")).toBeVisible();

  // Unsuspend event
  await page.getByTestId(`admin-unsuspend-${eventId}`).click();
  await expect(page.getByText("PUBLISHED")).toBeVisible();

  // Cancel event (triggers refund)
  await page.getByTestId(`admin-cancel-${eventId}`).click();
  await expect(page.getByText("CANCELLED")).toBeVisible();
});