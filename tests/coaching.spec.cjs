const { test, expect } = require("@playwright/test");
test("personal coach check-in, meal plan, undo, questions and mobile layout", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup/");
  await page.locator("[name=username]").fill("coach_qa_" + Date.now());
  await page.locator("[name=password1]").fill("Vita-QA-long-pass-2026");
  await page.locator("[name=password2]").fill("Vita-QA-long-pass-2026");
  await page.getByRole("button", { name: "Tạo tài khoản →" }).click();
  await expect(page.locator("#sheet-title")).toContainText("1/5");
  for (let i = 0; i < 5; i++) {
    await expect(page.locator("#sheet-title")).toContainText(`${i + 1}/5`);
    await page.locator("[data-action=journey-save]").click();
  }
  await expect(page.locator("#sheet-title")).toHaveText("Hướng dẫn hôm nay");
  await page.locator("[data-action=close]").click();
  await expect(page.locator("#sheet")).not.toBeVisible();
  const state = () =>
    page.evaluate(() => fetch("/api/dashboard/today/").then((r) => r.json()));
  await page.locator(".coach-banner [data-action=coach-checkin]").click();
  await page.locator("[name=energy]").selectOption("1");
  await page.locator("[name=available_minutes]").fill("15");
  await page.locator("[data-action=coach-save-checkin]").click();
  await expect(page.locator("#sheet-title")).toHaveText("Coach cá nhân");
  await page.locator("[data-section=workout]").click();
  await expect(page.locator(".coach-content")).toContainText("phục hồi");
  await page.locator("[data-section=food]").click();
  const before = (await state()).today.calories;
  await page.locator("[data-action=coach-select]").first().click();
  await page.locator("[data-action=coach-save-plan]").click();
  await expect(page.locator("[data-action=coach-eat]")).toBeVisible();
  expect((await state()).today.calories).toBe(before);
  await page.locator("[data-action=coach-eat]").click();
  await expect(page.locator(".coach-plan")).toContainText("Đã ghi vào nhật ký");
  expect((await state()).today.calories).toBeGreaterThan(before);
  await page.locator("[data-action=close]").click();
  await page.locator("#toast [data-action=undo]").click();
  await expect(page.locator("#toast")).toContainText("Đã hoàn tác");
  expect((await state()).today.calories).toBe(before);
  await page.locator(".coach-banner [data-action=coach]").click();
  await page.locator("[data-section=chat]").click();
  await page.locator("[data-action=coach-question]").first().click();
  await expect(page.locator(".coach-chat")).toContainText("kcal");
  await page.locator("[data-action=coach-settings]").click();
  await page.locator("[name=style]").selectOption("detailed");
  await page.locator("#coach-favorites").check();
  await page.locator("[data-action=coach-save-settings]").click();
  await expect(page.locator("#sheet-title")).toHaveText("Coach cá nhân");
  await page.locator("[data-section=food]").click();
  await expect(page.locator(".coach-content")).toContainText(
    "Chưa có món phù hợp",
  );
  await page.locator("[data-section=trend]").click();
  await expect(page.locator(".coach-content")).toContainText("Chưa đủ dữ liệu");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator("#sheet")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/coach-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
