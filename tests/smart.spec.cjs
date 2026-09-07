const { test, expect } = require("@playwright/test");
test("natural logging, undo, drafts and offline sync", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login/");
  await page.locator("[name=username]").fill("demo");
  await page
    .locator("[name=password]")
    .fill(process.env.VITA_DEMO_PASSWORD || "VitaDemo2026!");
  await page.getByRole("button", { name: "Đăng nhập →" }).click();
  await expect(page.locator(".smart-panel")).toBeVisible();
  const snapshot = () =>
    page.evaluate(() => fetch("/api/dashboard/today/").then((r) => r.json()));
  const before = await snapshot();
  await page.locator("[data-action=smart]").click();
  await page.locator("#smart-text").fill("uống 350ml nước; cân 74,6kg");
  await page.locator("[data-action=smart-preview]").click();
  await expect(page.locator("#smart-preview")).toContainText("350 ml");
  expect((await snapshot()).today.water).toBe(before.today.water);
  await page.locator("[data-action=smart-commit]").click();
  await expect(page.locator("#sheet")).not.toBeVisible();
  expect((await snapshot()).today.water).toBe(before.today.water + 350);
  await page.locator("#toast [data-action=undo]").click();
  await expect(page.locator("#toast")).toContainText("Đã hoàn tác");
  expect((await snapshot()).today.water).toBe(before.today.water);
  await page.locator("#main [data-action=meal]").first().click();
  await page.locator("[data-action=food-plus]").first().click();
  await page.locator("[data-action=close]").click();
  await page.reload();
  await expect(page.locator(".smart-panel")).toBeVisible();
  await page.locator("[data-action=resume-meal]").click();
  await expect(page.locator(".selected-food")).toHaveCount(1);
  await page.locator("[data-action=save-meal]").click();
  await expect(page.locator("#sheet")).not.toBeVisible();
  await context.setOffline(true);
  await page.locator("[data-action=quick-water]").click();
  await expect(page.locator("#toast")).toContainText("chờ đồng bộ");
  await expect(page.locator("[data-action=outbox]")).toContainText("1 bản ghi");
  await context.setOffline(false);
  await expect(page.locator("[data-action=outbox]")).toContainText(
    "Đã đồng bộ",
  );
  expect((await snapshot()).today.water).toBe(before.today.water + 250);
  await page.locator("#mobile-nav [data-nav=progress]").click();
  await expect(page.locator("#main")).toContainText("ngày có dữ liệu");
  expect(errors).toEqual([]);
});

test("cold offline entry queues under original account", async ({
  page,
  context,
}) => {
  await page.goto("/login/");
  await page.locator("[name=username]").fill("demo");
  await page
    .locator("[name=password]")
    .fill(process.env.VITA_DEMO_PASSWORD || "VitaDemo2026!");
  await page.getByRole("button", { name: "Đăng nhập →" }).click();
  await expect(page.locator(".smart-panel")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator(".smart-panel")).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vẫn ghi được khi mất mạng" }),
  ).toBeVisible();
  await page.locator("#value").fill("250");
  await page.getByRole("button", { name: "Giữ trên thiết bị" }).click();
  await expect(page.locator("#offline-status")).toContainText("1 bản ghi");
  await context.setOffline(false);
  await page.goto("/");
  await expect(page.locator(".smart-panel")).toBeVisible();
  await page.locator("[data-action=outbox]").click();
  await page.locator("[data-action=sync]").click();
  await expect(page.locator("#sheet")).not.toBeVisible();
  await expect(page.locator("[data-action=outbox]")).toContainText(
    "Đã đồng bộ",
  );
});

test("lost commit response can be retried without a duplicate", async ({
  page,
}) => {
  await page.goto("/login/");
  await page.locator("[name=username]").fill("demo");
  await page
    .locator("[name=password]")
    .fill(process.env.VITA_DEMO_PASSWORD || "VitaDemo2026!");
  await page.getByRole("button", { name: "Đăng nhập →" }).click();
  await expect(page.locator(".smart-panel")).toBeVisible();
  const before = await page.evaluate(() =>
    fetch("/api/dashboard/today/").then((r) => r.json()),
  );
  await page.locator("[data-action=smart]").click();
  await page.locator("#smart-text").fill("uống 350ml");
  await page.locator("[data-action=smart-preview]").click();
  await expect(page.locator("[data-action=smart-commit]")).toBeVisible();
  let drop = true;
  await page.route("**/api/smart/commit/", async (route) => {
    if (drop) {
      drop = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.locator("[data-action=smart-commit]").click();
  await expect(page.locator("#sheet-error")).not.toBeEmpty();
  await page.locator("[data-action=smart-commit]").click();
  await expect(page.locator("#sheet")).not.toBeVisible();
  const after = await page.evaluate(() =>
    fetch("/api/dashboard/today/").then((r) => r.json()),
  );
  expect(after.today.water).toBe(before.today.water + 350);
});
