const { test, expect } = require("@playwright/test");
test("new account, onboarding, custom meal and private export", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup/");
  await page.locator("[name=username]").fill("qa_" + Date.now());
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
  await expect(page.locator(".score-card .ring strong")).toHaveText("0");
  await page.locator('#main [data-action="meal"]').click();
  await page.locator('[data-action="custom-food"]').click();
  await page.locator("#f-name").fill("Bữa ăn riêng của tôi");
  await page.locator("#f-calories").fill("400");
  await page.locator("#f-protein").fill("30");
  await page.locator('[data-action="save-food"]').click();
  await expect(page.locator(".total-strip")).toContainText("400");
  await page.locator("#save-combo").check();
  await page.locator("#f-combo_name").fill("Combo cá nhân");
  await page.locator('[data-action="save-meal"]').click();
  await expect(page.locator("#sheet")).not.toBeVisible();
  let result = await page.evaluate(() =>
    fetch("/api/export/").then((r) => r.json()),
  );
  expect(result.custom_foods).toHaveLength(1);
  expect(result.meals).toHaveLength(1);
  expect(result.templates[0].name).toBe("Combo cá nhân");
  await page.locator('#mobile-nav [data-nav="food"]').click();
  await page.locator('[data-action="edit-meal"]').click();
  await page.locator('[data-action="food-plus"]').first().click();
  await page.locator('[data-action="save-meal"]').click();
  await expect(page.locator("#sheet")).not.toBeVisible();
  await page.locator(".fab").click();
  await page.locator('#sheet [data-action="sleep"]').click();
  await page.locator('[data-hours="8"]').click();
  await page.locator('[data-action="save-sleep"]').click();
  await expect(page.locator("#sheet")).not.toBeVisible();
  expect(errors).toEqual([]);
});
