import { expect, test, type Page } from "@playwright/test";

// The player journey through the site (R1, R2, R13, R14). Runs against the fake engine by default.

const REAL_ENGINE = process.env.E2E_ENGINE === "real";
let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  page.on("console", (m) => {
    // A signed-out GET /api/engine/me answers 401 by contract; the browser logs it, it is not an error.
    const expected401 = m.text().includes("status of 401") && m.location().url.endsWith("/api/engine/me");
    if (m.type() === "error" && !expected401) consoleErrors.push(m.text());
  });
});

test.afterEach(async ({ page }) => {
  expect(consoleErrors, "console errors").toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow, "horizontal scroll").toBe(false);
});

const uniqueName = () => `p_${Math.random().toString(36).slice(2, 10)}`;
const balance = (page: Page) => page.getByTestId("balance");

async function signIn(page: Page, name = uniqueName()) {
  await page.goto("/");
  await page.getByLabel("Sign the book with your name").fill(name);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page).toHaveURL("/lobby");
  return name;
}

async function deposit(page: Page, amount: string) {
  await page.getByLabel("Add fictional credits").fill(amount);
  await page.getByRole("button", { name: "Deposit" }).click();
}

test("AC-1.3 signed-out players are sent to sign-in", async ({ page }) => {
  for (const path of ["/lobby", "/play", "/history"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/");
  }
});

test("Q2 an invalid username is rejected in the form", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Sign the book with your name").fill("ab");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByText("Use 3 to 20 letters, digits or _")).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("AC-1.1 a new account lands in the lobby with balance 0", async ({ page }) => {
  const name = await signIn(page);
  await expect(page.getByRole("heading", { name: `Welcome, ${name}` })).toBeVisible();
  await expect(balance(page)).toHaveText("0");
});

test("AC-2.1 AC-14.2 a deposit updates the visible balance", async ({ page }) => {
  await signIn(page);
  await deposit(page, "100");
  await expect(balance(page)).toHaveText("100");
  await deposit(page, "25");
  await expect(balance(page)).toHaveText("125");
});

test("AC-2.2 invalid deposits are rejected and change nothing", async ({ page }) => {
  await signIn(page);
  for (const amount of ["0", "-5", "2.5", "abc"]) {
    await deposit(page, amount);
    await expect(page.getByText("Deposit a positive whole number")).toBeVisible();
  }
  await expect(balance(page)).toHaveText("0");
});

test("AC-13.1 history lists the deposit with its balance", async ({ page }) => {
  await signIn(page);
  await deposit(page, "100");
  await expect(balance(page)).toHaveText("100");
  await page.getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL("/history");
  const row = page.getByRole("row").filter({ hasText: "DEPOSIT" });
  await expect(row).toContainText("+100");
  await expect(page.getByText("No finished runs yet.")).toBeVisible();
});

test("AC-14.1 AC-14.2 a full round from the lobby: bet, play, settle, history", async ({ page }) => {
  test.skip(REAL_ENGINE, "No playable table on the real engine until BlackjackTable lands (D-016)");
  await signIn(page);
  await deposit(page, "100");
  await expect(balance(page)).toHaveText("100");
  await page.getByRole("link", { name: "Take a seat at the table" }).click();
  await expect(page).toHaveURL("/play");

  await page.getByLabel("Your bet").fill("10");
  await page.getByRole("button", { name: "Deal" }).click();
  // The deck is random: stand on every hand until the round settles (a natural settles at once).
  const stand = page.getByRole("button", { name: "Stand" });
  const dealAgain = page.getByRole("button", { name: "Deal" });
  await expect(stand.or(dealAgain)).toBeVisible();
  while (await stand.isVisible()) {
    await stand.click();
    await expect(stand.or(dealAgain)).toBeVisible();
  }
  await expect(dealAgain).toBeVisible();
  await expect(page.getByTestId("hand").first()).toContainText(/Win|Blackjack|Push|Loss/);
  await expect(balance(page)).toHaveText(/^(90|100|110)$/);

  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByRole("row").filter({ hasText: "BET" })).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: "PAYOUT" })).toHaveCount(1);
});

test("the session and balance survive a reload", async ({ page }) => {
  await signIn(page);
  await deposit(page, "40");
  await expect(balance(page)).toHaveText("40");
  await page.reload();
  await expect(balance(page)).toHaveText("40");
  await page.goto("/");
  await expect(page).toHaveURL("/lobby");
});

test("signing out returns to sign-in and protects private pages", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Leave" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/lobby");
  await expect(page).toHaveURL("/");
});
