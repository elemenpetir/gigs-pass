import { test, expect } from "@playwright/test";
import {
  registerViaAPI,
  loginViaUI,
  createEventViaUI,
} from "./helpers.js";

// Organizer: Create, Edit, Publish event
test("organizer full flow: create event, edit, publish", async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  const orgEmail = `org-${stamp}@test.local`;

  // Register organizer
  await registerViaAPI(request, {
    email: orgEmail,
    password: "Password123!",
    role: "organizer",
    name: "E2E Organizer",
  });

  await loginViaUI(page, orgEmail, "Password123!");
  await page.goto("/organizer/events");

  // Create new event
  const eventTitle = `E2E Event ${stamp}`;
  const eventDate = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 16); // datetime-local format

  await createEventViaUI(page, {
    title: eventTitle,
    category: "music",
    eventDate,
    description: "E2E test event description",
  });

  // Verify event appears in list with draft status
  await expect(page.getByText(eventTitle)).toBeVisible();
  await expect(page.getByText("DRAFT")).toBeVisible();

  // Get event ID from URL after creation (via clicking edit)
  await page.getByRole("link", { name: /EDIT/ }).first().click();
  const eventUrl = page.url();
  const eventId = eventUrl.match(/events\/([^/]+)\/edit/)[1];

  // Edit event title
  await page.locator("#title").fill(`${eventTitle} - Updated`);
  await page.getByTestId("event-form-submit").click();
  await expect(page).toHaveURL("/organizer/events");
  await expect(page.getByText(`${eventTitle} - Updated`)).toBeVisible();

  // Publish event
  await page.getByTestId(`event-publish-${eventId}`).click();
  await expect(page.getByText("PUBLISHED")).toBeVisible();
});