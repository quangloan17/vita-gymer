const { test, expect } = require("@playwright/test");
test("responsive dashboard, logging and workout session", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login/");
  await page.locator("[name=username]").fill("demo");
  await page
    .locator("[name=password]")
    .fill(process.env.VITA_DEMO_PASSWORD || "VitaDemo2026!");
  await page.getByRole("button", { name: "Đăng nhập →" }).click();
  await expect(page.locator(".score-card")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  for (const width of [360, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator("#mobile-nav")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  let before = await page.evaluate(() =>
    fetch("/api/dashboard/today/").then((r) => r.json()),
  );
  await page.locator('[data-action="quick-water"]').click();
  await expect(page.locator("#toast")).toContainText("250 ml");
  await page.reload();
  await expect(page.locator(".score-card")).toBeVisible();
  let after = await page.evaluate(() =>
    fetch("/api/dashboard/today/").then((r) => r.json()),
  );
  expect(after.today.water).toBe(before.today.water + 250);
  await page.locator('#main [data-action="weight"]').first().click();
  await page.locator("#f-weight").fill("74.2");
  await page.locator('[data-action="save-weight"]').click();
  await expect(page.locator("#sheet")).not.toBeVisible();
  await page.locator('#main [data-action="meal"]').first().click();
  await page.locator('[data-action="food-plus"]').first().click();
  await page.locator('[data-action="save-meal"]').click();
  await expect(page.locator("#sheet")).not.toBeVisible();
  await page.locator('#main [data-action="workout"]').first().click();
  await page.locator('#sheet [data-action="start"]').first().click();
  await expect(page.locator('[data-action="complete-set"]')).toBeVisible();
  await page.locator('[data-action="complete-set"]').click();
  await expect(page.locator("#rest-box")).toBeVisible();
  await page.locator('[data-action="rest-add"]').click();
  await expect(page.locator("#rest-timer")).toContainText("01:");
  await page.locator('[data-action="rest-skip"]').click();
  await expect(page.locator("#rest-box")).not.toBeVisible();
  await page.locator('[data-action="finish"]').click();
  await expect(page.locator("#sheet-title")).toHaveText("Thêm một bữa ngon");
  await page.locator('[data-action="close"]').click();
  for (const nav of ["food", "workout", "progress", "profile", "home"]) {
    await page.locator(`#mobile-nav [data-nav="${nav}"]`).click();
    await expect(page.locator("#main h1")).toBeVisible();
  }
  await page.locator('#mobile-nav [data-nav="profile"]').click();
  await page.locator('#main [data-action="theme"]').click();
  await expect(page.locator("body")).toHaveClass("dark");
  await page.screenshot({ path: "test-results/dark.png", fullPage: true });
  await page.locator('#main [data-action="theme"]').click();
  expect(errors).toEqual([]);
});
