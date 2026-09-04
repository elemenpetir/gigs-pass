import { test, expect } from "@playwright/test";

// Smoke: home renders static hero even with an empty event list.
// Proves the harness (browser + web server) is green before role specs land.
test("home renders hero", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "EXPLORE EVENTS" }),
  ).toBeVisible();
  await expect(
    page.getByText("Concerts, festivals, and unforgettable moments."),
  ).toBeVisible();
});
