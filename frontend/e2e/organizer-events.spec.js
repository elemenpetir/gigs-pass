import { test, expect } from "@playwright/test";
import {
  registerViaAPI,
  loginViaAPI,
  loginViaUI,
  createEventViaUI,
  API_URL,
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

  // Ambil id event via API (lebih deterministik daripada klik EDIT
  // untuk membaca id dari URL).
  const orgToken = await loginViaAPI(request, {
    email: orgEmail,
    password: "Password123!",
  });
  const mineRes = await request.get(`${API_URL}/events/mine`, {
    headers: { Authorization: `Bearer ${orgToken}` },
  });
  if (!mineRes.ok()) {
    throw new Error(`events mine failed: ${mineRes.status()}`);
  }
  const mine = (await mineRes.json()).data.events || [];
  const created = mine.find((e) => e.title === eventTitle);
  if (!created) {
    throw new Error("created event missing from /events/mine");
  }
  const eventId = created.id;

  // Edit event title
  await page.goto(`/organizer/events/${eventId}/edit`);

  // Edit event title
  await page.locator("#title").fill(`${eventTitle} - Updated`);
  await page.getByTestId("event-form-submit").click();
  await expect(page).toHaveURL("/organizer/events");
  await expect(page.getByText(`${eventTitle} - Updated`)).toBeVisible();

  // Publish event
  await page.getByTestId(`event-publish-${eventId}`).click();
  await expect(page.getByText("PUBLISHED")).toBeVisible();

  // Cancel event (confirm dialog disetujui, badge jadi CANCELLED)
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId(`event-cancel-${eventId}`).click();
  await expect(page.getByText("CANCELLED")).toBeVisible();
});