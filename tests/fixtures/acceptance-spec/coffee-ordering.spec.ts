import { test, expect } from "@playwright/test";
import { addItem, cartLines, expectMoney, exact } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("coffee-cart-v1"));
  await page.reload();
});

test("R1 — Empty cart shows exactly Your cart is empty; checkout disabled", async ({ page }) => {
  await expect(page.getByText(exact.empty, { exact: true })).toBeVisible();
  await expect(page.getByTestId("checkout-submit")).toBeDisabled();
});

test("R2 — Same item, identical options → increments quantity, no second line", async ({ page }) => {
  await addItem(page, "espresso", "Small", "Whole");
  await addItem(page, "espresso", "Small", "Whole");
  await expect(cartLines(page)).toHaveCount(1);
  await expect(cartLines(page).first().getByTestId("line-qty")).toHaveText("2");
});

test("R3 — Same item, different options → separate line", async ({ page }) => {
  await addItem(page, "espresso", "Small", "Whole");
  await addItem(page, "espresso", "Large", "Oat");
  await expect(cartLines(page)).toHaveCount(2);
  await expect(cartLines(page).filter({ hasText: "Small" })).toHaveCount(1);
  await expect(cartLines(page).filter({ hasText: "Large" })).toHaveCount(1);
});

test("R4 — Quantity never below 1; decrementing at quantity 1 removes the line", async ({ page }) => {
  await addItem(page, "espresso");
  const line = cartLines(page).first();
  await expect(line.getByTestId("line-qty")).toHaveText("1");
  await line.getByTestId("decrement").click();
  await expect(cartLines(page)).toHaveCount(0);
  await expect(page.getByText(exact.empty, { exact: true })).toBeVisible();
});

test("R5 — Subtotal, tax, and total computed and displayed per the money rules", async ({ page }) => {
  await addItem(page, "latte", "Small", "Whole");
  await expectMoney(page, "$4.50", "$0.36", "$4.86");
  await expect(cartLines(page).first().getByTestId("line-total")).toHaveText("$4.50");
});

test("R6 — Checkout requires a non-empty name and exactly 10 phone digits; submit disabled until valid", async ({ page }) => {
  await addItem(page, "espresso");
  const submit=page.getByTestId("checkout-submit"), name=page.getByTestId("checkout-name"), phone=page.getByTestId("checkout-phone");
  await expect(submit).toBeDisabled();
  await name.fill("Ada"); await phone.fill("123456789"); await expect(submit).toBeDisabled();
  await phone.fill("12345678901"); await expect(submit).toBeDisabled();
  await phone.fill("1234567890"); await expect(submit).toBeEnabled();
});

test("R7 — On submit, confirmation shows an order number matching /^ORD-\\d{6}$/, an itemized list, and a matching total", async ({ page }) => {
  await addItem(page, "cappuccino", "Medium", "Oat");
  await page.getByTestId("checkout-name").fill("Ada");
  await page.getByTestId("checkout-phone").fill("1234567890");
  const expectedTotal=await page.getByTestId("total-value").textContent();
  await page.getByTestId("checkout-submit").click();
  await expect(page.getByText(exact.confirmed, { exact: true })).toBeVisible();
  await expect(page.getByTestId("order-number")).toHaveText(/^ORD-\d{6}$/);
  await expect(page.getByTestId("order-items")).toContainText("Cappuccino");
  await expect(page.getByTestId("order-total")).toHaveText(expectedTotal ?? "");
});

test("R8 — Cart survives a page reload, including options and quantities", async ({ page }) => {
  await addItem(page, "espresso", "Large", "Oat");
  await addItem(page, "espresso", "Large", "Oat");
  const stored=await page.evaluate(() => localStorage.getItem("coffee-cart-v1"));
  expect(stored).not.toBeNull();
  await page.reload();
  await expect(cartLines(page)).toHaveCount(1);
  await expect(cartLines(page).first()).toContainText("Large");
  await expect(cartLines(page).first()).toContainText("Oat");
  await expect(cartLines(page).first().getByTestId("line-qty")).toHaveText("2");
});
