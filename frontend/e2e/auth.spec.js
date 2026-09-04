import { test, expect } from "@playwright/test";
import { uniqueEmail, registerViaAPI } from "./helpers.js";

test("register buyer via UI lands on home", async ({ page }) => {
  const email = uniqueEmail("auth");
  await page.goto("/login");
  await page.getByRole("button", { name: "register", exact: true }).click();
  await page.locator("#name").fill("E2E Buyer");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Password123!");
  await page.getByRole("button", { name: /SIGN UP/ }).click();
  await expect(page).toHaveURL("/");
});

test("login gagal menampilkan error", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill("ghost@test.local");
  await page.locator("#password").fill("WrongPass123!");
  await page.getByRole("button", { name: /EXPLORE EVENTS/ }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
});

test("guard mengarahkan ke login lalu kembali ke halaman tujuan", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("guard");
  await registerViaAPI(request, {
    email,
    password: "Password123!",
    role: "buyer",
    name: "Guard Buyer",
  });
  await page.goto("/orders");
  await expect(page).toHaveURL(/\/login/);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Password123!");
  await page.getByRole("button", { name: /EXPLORE EVENTS/ }).click();
  await expect(page).toHaveURL("/orders");
  await expect(
    page.getByRole("heading", { name: /MY ORDERS/ }),
  ).toBeVisible();
});
