import { test, expect } from "@playwright/test";

test("home page renders hero headline", async ({ page }) => {
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("Star Every");
  await expect(heading).toContainText("Ethereum");
  await expect(heading).toContainText("Repo");
});

test("home page shows unauthenticated CTAs", async ({ page }) => {
  await page.goto("/");
  // There are multiple "Connect via GitHub" buttons (header + hero); both should exist.
  await expect(
    page.getByRole("button", { name: "Connect via GitHub" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View Repositories" }),
  ).toBeVisible();
});

test("home page shows all four repo category sections", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ethereum Core" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Consensus Clients" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Execution Clients" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Validator Tooling" }),
  ).toBeVisible();
});

test("home page shows a sample of tracked repos", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("go-ethereum").first()).toBeVisible();
  await expect(page.getByText("lighthouse").first()).toBeVisible();
  await expect(page.getByText("reth").first()).toBeVisible();
  await expect(page.getByText("vouch").first()).toBeVisible();
});

test("home page shows support section", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Support", exact: true }),
  ).toBeVisible();
});

test("skip link targets the repos region and becomes visible on focus", async ({
  page,
}) => {
  await page.goto("/");
  const skip = page.getByRole("link", { name: "Skip to repositories" });
  await expect(skip).toHaveAttribute("href", "#repos");
  // Off-screen until focused.
  const offBox = await skip.boundingBox();
  expect(offBox?.x).toBeLessThan(-1000);
  await skip.focus();
  const onBox = await skip.boundingBox();
  expect(onBox).not.toBeNull();
  expect(onBox!.x).toBeGreaterThanOrEqual(0);
  expect(onBox!.x).toBeLessThan(100);
});

test("marquees expose per-category accessible labels", async ({ page }) => {
  await page.goto("/");
  for (const cat of [
    "Ethereum Core",
    "Consensus Clients",
    "Execution Clients",
    "Validator Tooling",
  ]) {
    await expect(
      page.getByRole("region", {
        name: `Scrolling list of ${cat} repositories`,
      }),
    ).toBeVisible();
  }
});

test("progress bar and star-all button are hidden when unauthenticated", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Starring progress")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Star All/i })).toHaveCount(0);
});
