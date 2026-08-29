import { type Page, expect } from "@playwright/test";

export const exact = {
	empty: "Your cart is empty",
	subtotal: "Subtotal",
	tax: "Tax",
	total: "Total",
	confirmed: "Order confirmed",
} as const;

export async function configureItem(
	page: Page,
	item: string,
	size = "Small",
	milk = "Whole",
) {
	await page.getByTestId(`size-${item}`).selectOption({ label: size });
	await page.getByTestId(`milk-${item}`).selectOption({ label: milk });
}

export async function addItem(
	page: Page,
	item: string,
	size = "Small",
	milk = "Whole",
) {
	await configureItem(page, item, size, milk);
	await page.getByTestId(`add-${item}`).click();
}

export function cartLines(page: Page) {
	return page.getByTestId("cart-line");
}

export async function expectMoney(
	page: Page,
	subtotal: string,
	tax: string,
	total: string,
) {
	await expect(page.getByText(exact.subtotal, { exact: true })).toBeVisible();
	await expect(page.getByText(exact.tax, { exact: true })).toBeVisible();
	await expect(page.getByText(exact.total, { exact: true })).toBeVisible();
	await expect(page.getByTestId("subtotal-value")).toHaveText(subtotal);
	await expect(page.getByTestId("tax-value")).toHaveText(tax);
	await expect(page.getByTestId("total-value")).toHaveText(total);
}
