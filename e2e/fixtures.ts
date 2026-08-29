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

export async function waitForHydration(page: Page) {
	// This page is server-rendered (TanStack Start): every data-testid is
	// already present in the SSR HTML before React attaches event handlers, so
	// Playwright's actionability checks pass on a click that lands before
	// hydration -- and even a click that beats hydration gets clobbered when
	// the mount effect runs setCart(loadCart()). Waiting for that same effect's
	// localStorage write is a precise client-mount gate, not an incidental
	// implementation detail: coffee-cart-v1 is the SOW's own normative storage
	// key (R8), not a stand-in selector.
	await page.waitForFunction(
		() => window.localStorage.getItem("coffee-cart-v1") !== null,
		undefined,
		{ timeout: 5000 },
	);
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
