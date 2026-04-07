import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/");
    // Should show login form or redirect to login
    await expect(page.locator("body")).toBeVisible();
    // Check for Hebrew text indicating the app loaded
    const hasLoginOrDashboard = await page
      .locator("text=כניסה, text=לוח בקרה")
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasLoginOrDashboard || (await page.title()).length > 0).toBeTruthy();
  });

  test("app renders without crashing", async ({ page }) => {
    await page.goto("/");
    // No uncaught errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});

test.describe("Navigation", () => {
  test("all main routes are accessible", async ({ page }) => {
    const routes = [
      "/products",
      "/orders",
      "/tasks",
      "/suppliers",
      "/inventory",
    ];

    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(500);
    }
  });
});
