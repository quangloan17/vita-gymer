const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60000,
  use: { baseURL: process.env.VITA_TEST_URL || "http://127.0.0.1:8000", headless: true },
  workers: 1,
  reporter: "list",
});
