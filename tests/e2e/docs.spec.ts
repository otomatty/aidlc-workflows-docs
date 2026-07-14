import { expect, test } from "@playwright/test";

const BASE = "/aidlc-workflows-docs";
const SOURCE_COMMIT = "3c76878775915b6dc510fa7e1ef0991ba510cd53";

test("renders the docs index with Japanese sidebar navigation", async ({
	page,
}) => {
	const response = await page.goto(`${BASE}/`);

	expect(response?.status()).toBe(200);
	await expect(
		page.getByRole("heading", { level: 1, name: "AI-DLC ドキュメント" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "ユーザーガイド" }).first(),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "開発者リファレンス" }).first(),
	).toBeVisible();
});

test("renders a guide page with the translation source footer", async ({
	page,
}) => {
	const response = await page.goto(`${BASE}/guide/getting-started`);

	expect(response?.status()).toBe(200);
	await expect(
		page.getByRole("heading", { level: 1, name: "はじめに" }),
	).toBeVisible();

	const sourceLink = page.locator(".source-status a");
	await expect(sourceLink).toHaveAttribute(
		"href",
		`https://github.com/awslabs/aidlc-workflows/blob/${SOURCE_COMMIT}/docs/guide/01-getting-started.md`,
	);
});

test("serves the slugged agents chapter and the agents index separately", async ({
	page,
}) => {
	const chapter = await page.goto(`${BASE}/guide/agents-overview`);
	expect(chapter?.status()).toBe(200);
	await expect(
		page.getByRole("heading", { level: 1, name: "エージェント" }).first(),
	).toBeVisible();

	const index = await page.goto(`${BASE}/guide/agents`);
	expect(index?.status()).toBe(200);
});

test("renders Mermaid diagrams as SVG", async ({ page }) => {
	await page.goto(`${BASE}/reference/diagrams`);

	await expect(page.locator("blume-mermaid svg").first()).toBeVisible({
		timeout: 15_000,
	});
});

test("renders callouts converted from GitHub alerts", async ({ page }) => {
	await page.goto(`${BASE}/guide/harnesses/kiro-ide`);

	await expect(
		page.getByText("Kiro IDE では Claude Opus 4.8 で AI-DLC を実行してください。"),
	).toBeVisible();
});

test("returns 404 with a page for missing routes", async ({ page }) => {
	const response = await page.goto(`${BASE}/missing/`);

	expect(response?.status()).toBe(404);
});
