const { test, expect } = require("@playwright/test");
test("guided intake resumes and creates a daily monthly roadmap", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup/");
  await page.locator("[name=username]").fill("journey_qa_" + Date.now());
  await page.locator("[name=password1]").fill("Vita-QA-long-pass-2026");
  await page.locator("[name=password2]").fill("Vita-QA-long-pass-2026");
  await page.getByRole("button", { name: "Tạo tài khoản →" }).click();
  await expect(page.locator("#sheet-title")).toContainText("1/5");
  await page.locator("[name=name]").fill("Người mới");
  await page.locator("[data-action=journey-save]").click();
  await expect(page.locator("#sheet-title")).toContainText("2/5");
  await page.reload();
  await expect(page.locator("#sheet-title")).toContainText("2/5");
  await page.locator("[name=minutes]").fill("20");
  for (let i = 2; i <= 5; i++) {
    await expect(page.locator("#sheet-title")).toContainText(`${i}/5`);
    await page.locator("[data-action=journey-save]").click();
  }
  await expect(page.locator("#sheet-title")).toHaveText("Hướng dẫn hôm nay");
  await page.locator("#sheet-footer [data-action=journey-calendar]").click();
  await expect(page.locator(".journey-calendar")).toBeVisible();
  expect(
    await page
      .locator("#sheet")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  const state = await page.evaluate(() =>
    fetch("/api/dashboard/today/").then((r) => r.json()),
  );
  expect(state.journey.step).toBe(5);
  expect(state.today.sessions).toBe(0);
  expect(state.today.calories).toBe(0);
  await page.screenshot({
    path: "test-results/journey-calendar-mobile.png",
    fullPage: false,
  });
  await page.locator("[data-action=journey-day]").last().click();
  await expect(page.locator("#sheet-title")).toContainText("Kế hoạch");
  await page.locator("[data-action=close]").click();
  await expect(page.locator(".journey-banner")).toContainText("Check-in");
  await page.locator(".journey-banner [data-action=journey-today]").click();
  await page.locator("[data-action=journey-guide]").click();
  await expect(page.locator("#sheet-body .coach-card")).toHaveCount(7);
  await page.locator("[data-action=journey-glossary]").last().click();
  await expect(page.locator("#sheet-title")).toHaveText("Hiểu các thông số");
  expect(errors).toEqual([]);
});
