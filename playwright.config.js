import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: { command: "node tests/harness/server.mjs", url: "http://localhost:4173/mock/docs", reuseExistingServer: true },
});
