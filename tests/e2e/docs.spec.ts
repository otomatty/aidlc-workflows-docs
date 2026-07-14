import { expect, test } from "@playwright/test";

const docsTitle = "AI-DLC ドキュメント";
const fixtureTitle = "Mermaid と検索の検証";
const fixtureRoute =
	"/aidlc-workflows-docs/fixtures/guide/99-mermaid-search-fixture/";
const fixtureSearchTerm = "銀河横断検索確認語";
const mermaidErrorLabel = "Mermaid の描画に失敗しました。";
const sourceCommit =
	"3c76878775915b6dc510fa7e1ef0991ba510cd53";
const sourceHref = `https://github.com/awslabs/aidlc-workflows/blob/${sourceCommit}/docs/README.md`;
const upstreamRepositoryHref = "https://github.com/awslabs/aidlc-workflows";

test("renders Japanese-only landing page chrome", async ({ page }) => {
	await page.goto("/aidlc-workflows-docs/");

	await expect(
		page.getByRole("link", { name: "AI-DLC ドキュメント" }).first(),
	).toBeVisible();
	await expect(page.getByText("Astro ドキュメント UI")).toBeVisible();
	await expect(page.getByText("Astro Documentation UI")).toHaveCount(0);
});

test("renders the migrated landing page summary and guide entry points", async ({
	page,
}) => {
	const response = await page.goto("/aidlc-workflows-docs/");

	expect(response?.status()).toBe(200);
	await expect(
		page.getByText("/aidlc Build a REST API for inventory management"),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "5フェーズ", exact: true }),
	).toBeVisible();
	await expect(page.getByText("Claude Code", { exact: true })).toBeVisible();
	await expect(page.getByText("Kiro IDE", { exact: true })).toBeVisible();
	await expect(page.getByText("Kiro CLI", { exact: true })).toBeVisible();
	await expect(page.getByText("Codex CLI", { exact: true })).toBeVisible();
	await expect(page.getByText("ガイド入口", { exact: true })).toBeVisible();
	await expect(page.getByText("Entry Points", { exact: true })).toHaveCount(0);

	const guideCards = [
		{
			name: "ユーザーガイド",
			href: "/aidlc-workflows-docs/docs/#user-guide",
			anchor: "user-guide",
		},
		{
			name: "ハーネスエンジニアガイド",
			href: "/aidlc-workflows-docs/docs/#harness-engineer-guide",
			anchor: "harness-engineer-guide",
		},
		{
			name: "開発者リファレンス",
			href: "/aidlc-workflows-docs/docs/#developer-reference",
			anchor: "developer-reference",
		},
	] as const;

	for (const guideCard of guideCards) {
		await page.goto("/aidlc-workflows-docs/");
		await expect(
			page.getByRole("link", { name: guideCard.name }).first(),
		).toHaveAttribute("href", guideCard.href);
		const guideResponse = await page.goto(guideCard.href);
		expect(guideResponse?.status()).toBe(200);
		await expect(page.locator(`#${guideCard.anchor}`)).toBeAttached();
	}
});

test("preserves every legacy summary topic on the landing page", async ({
	page,
}) => {
	await page.goto("/aidlc-workflows-docs/");

	const topicHeadings = [
		"Small Mob, Broad Agents",
		"なぜ AI-DLC か",
		"リポジトリ構成",
		"エンジンとコンダクター",
		"型付きディレクティブ",
		"ガード機構",
		"状態と監査",
		"hooks・tools・sensors",
		"プラグイン",
		"consumes / consumes_absent",
		"ライフサイクル全体",
		"Phase 0: Initialization",
		"Phase 1: Ideation",
		"Phase 2: Inception",
		"Phase 3: Construction",
		"Phase 4: Operation",
		"9つのスコープ",
		"自由文からのスコープ検出",
		"アダプティブコンポーザー",
		"深度とテスト戦略",
		"役割とティア",
		"ナレッジと情報の流れ",
	] as const;

	for (const heading of topicHeadings) {
		await expect(
			page.getByRole("heading", { name: heading, exact: true }),
		).toBeVisible();
	}

	const auditCard = page
		.getByRole("heading", { name: "状態と監査", exact: true })
		.locator("..");
	await expect(auditCard).toContainText("71 イベント・19 カテゴリ");
	await expect(auditCard).not.toContainText("68 イベント");

	const constructionCard = page
		.getByRole("heading", { name: "Phase 3: Construction", exact: true })
		.locator("..");
	await expect(constructionCard).toContainText(
		"ステージ 3.1〜3.5 は Bolt ごとに実行します。",
	);
	await expect(constructionCard).toContainText(
		"3.6 Build and Test と 3.7 CI Pipeline は全 Bolt 完了後に 1 回だけ実行します",
	);

	await expect(
		page.getByRole("link", { name: "GitHub" }),
	).toHaveAttribute("href", upstreamRepositoryHref);
});

test("renders the migrated changelog entries", async ({ page }) => {
	const response = await page.goto("/aidlc-workflows-docs/changelog/");

	expect(response?.status()).toBe(200);
	await expect(page.getByRole("heading", { level: 1, name: "変更履歴" })).toBeVisible();
	await expect(
		page.getByRole("heading", { level: 2, name: "2.3.3", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { level: 2, name: "2.2.0", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { level: 2, name: "2.0.0", exact: true }),
	).toBeVisible();
});

test("serves static redirects for legacy html routes", async ({ request }) => {
	const redirectCases = [
		{
			legacyPath: "/aidlc-workflows-docs/architecture.html",
			targetPath: "/aidlc-workflows-docs/#architecture",
			fallbackLabel: "新しいアーキテクチャ概要へ移動",
		},
		{
			legacyPath: "/aidlc-workflows-docs/workflow.html",
			targetPath: "/aidlc-workflows-docs/#workflow",
			fallbackLabel: "新しいワークフロー概要へ移動",
		},
		{
			legacyPath: "/aidlc-workflows-docs/agents.html",
			targetPath: "/aidlc-workflows-docs/#agents",
			fallbackLabel: "新しいエージェント概要へ移動",
		},
		{
			legacyPath: "/aidlc-workflows-docs/changelog.html",
			targetPath: "/aidlc-workflows-docs/changelog/",
			fallbackLabel: "新しい変更履歴ページへ移動",
		},
	] as const;

	for (const redirectCase of redirectCases) {
		const response = await request.get(redirectCase.legacyPath);
		const body = await response.text();

		expect(response.status()).toBe(200);
		expect(body).toContain(
			`<link rel="canonical" href="${redirectCase.targetPath}" />`,
		);
		expect(body).toContain(
			`<meta http-equiv="refresh" content="0; url=${redirectCase.targetPath}" />`,
		);
		expect(body).toContain(
			`<a href="${redirectCase.targetPath}">${redirectCase.fallbackLabel}</a>`,
		);
	}
});

test("renders the docs landing page with guide navigation and source metadata", async ({
	page,
}) => {
	const response = await page.goto("/aidlc-workflows-docs/docs/");
	const sidebar = page.locator(".docs-sidebar");

	expect(response?.status()).toBe(200);
	await expect(
		page.getByRole("heading", { level: 1, name: docsTitle }),
	).toBeVisible();
	await expect(
		sidebar.getByRole("heading", { name: "ユーザーガイド", exact: true }),
	).toBeVisible();
	await expect(
		sidebar.getByRole("heading", {
			name: "ハーネスエンジニアガイド",
			exact: true,
		}),
	).toBeVisible();
	await expect(
		sidebar.getByRole("heading", { name: "開発者リファレンス", exact: true }),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "AI-DLC ドキュメント" }).first()).toBeVisible();
	await expect(
		page.getByRole("link", { name: /ソース/ }),
	).toHaveAttribute("href", sourceHref);
});

test("opens and closes the mobile navigation menu", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/aidlc-workflows-docs/docs/");

	const menuButton = page.getByRole("button", {
		name: "ナビゲーションを開く",
	});
	await expect(menuButton).toHaveAttribute("aria-expanded", "false");

	await menuButton.click();

	await expect(menuButton).toHaveAttribute("aria-expanded", "true");
	await expect(page.getByRole("dialog", { name: "モバイルナビゲーション" })).toBeVisible();

	await page.keyboard.press("Escape");
	await expect(menuButton).toHaveAttribute("aria-expanded", "false");
	await expect(menuButton).toBeFocused();
});

test("closes the mobile navigation after selecting a route link", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/aidlc-workflows-docs/docs/");

	const menuButton = page.getByRole("button", {
		name: "ナビゲーションを開く",
	});
	await menuButton.click();

	const mobileDialog = page.getByRole("dialog", {
		name: "モバイルナビゲーション",
	});
	const currentUrl = page.url();

	await page.evaluate(() => {
		document.addEventListener(
			"click",
			(event) => {
				const target = event.target;
				if (
					target instanceof Element &&
					target.closest("[data-mobile-nav] a[href]")
				) {
					event.preventDefault();
				}
			},
			{ once: true },
		);
	});

	await mobileDialog
		.getByRole("link", { name: "AI-DLC ドキュメント" })
		.click();

	expect(page.url()).toBe(currentUrl);
	await expect(mobileDialog).toBeHidden();
	await expect(menuButton).toHaveAttribute("aria-expanded", "false");
	await expect(menuButton).toBeFocused();
});

test("keeps the docs page within the viewport at key widths", async ({ page }) => {
	for (const width of [390, 800, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/aidlc-workflows-docs/docs/");

		const overflow = await page.evaluate(() => ({
			documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
			bodyOverflow: document.body.scrollWidth - window.innerWidth,
		}));

		expect(overflow.documentOverflow).toBeLessThanOrEqual(1);
		expect(overflow.bodyOverflow).toBeLessThanOrEqual(1);
	}
});

test("renders the Japanese 404 page for missing routes", async ({ page }) => {
	const response = await page.goto("/aidlc-workflows-docs/missing/");

	expect(response?.status()).toBe(404);
	await expect(
		page.getByRole("heading", { level: 1, name: "ページが見つかりません" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "ドキュメント一覧へ戻る" }),
	).toBeVisible();
});

test("renders Mermaid SVG and keeps the source when rendering fails", async ({
	page,
}) => {
	await page.goto(fixtureRoute);

	const mermaidSources = page.locator("pre[data-mermaid]");
	const mermaidDiagrams = page.locator("[data-mermaid-diagram]");

	await expect(page.getByRole("heading", { level: 1, name: fixtureTitle })).toBeVisible();
	await expect(mermaidDiagrams.first().locator("svg")).toBeVisible();
	await expect(mermaidSources.first()).toBeHidden();
	await expect(mermaidSources.nth(1)).toBeVisible();
	await expect(page.getByText(mermaidErrorLabel)).toBeVisible();
});

test("lazy-loads search and opens results with the keyboard", async ({
	page,
}) => {
	const pagefindRequests: string[] = [];

	page.on("request", (request) => {
		if (request.url().includes("/pagefind/pagefind.js")) {
			pagefindRequests.push(request.url());
		}
	});

	await page.goto("/aidlc-workflows-docs/docs/");
	expect(pagefindRequests).toHaveLength(0);

	const searchTrigger = page.getByRole("button", { name: "検索を開く" });
	await searchTrigger.focus();
	await page.keyboard.press("Enter");

	const searchDialog = page.getByRole("dialog", { name: "サイト内検索" });
	await expect(searchDialog).toBeVisible();
	await expect.poll(() => pagefindRequests.length).toBe(1);
	expect(pagefindRequests[0]).toContain(
		"/aidlc-workflows-docs/pagefind/pagefind.js",
	);

	await page.keyboard.press("Escape");
	await expect(searchDialog).toBeHidden();
	await expect(searchTrigger).toBeFocused();

	await page.keyboard.press("Enter");
	await expect(searchDialog).toBeVisible();
	await page.waitForTimeout(500);
	expect(pagefindRequests).toHaveLength(1);

	const searchInput = page.getByRole("searchbox", {
		name: "サイト内検索キーワード",
	});
	await searchInput.fill(fixtureSearchTerm);

	const resultLink = searchDialog.getByRole("link", { name: fixtureTitle });
	await expect(resultLink).toHaveAttribute("href", fixtureRoute);

	await resultLink.focus();
	await expect(resultLink).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page).toHaveURL(`http://127.0.0.1:4321${fixtureRoute}`);
});

test("keeps docs content and Mermaid source readable without JavaScript", async ({
	browser,
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();

	await page.goto(fixtureRoute);

	await expect(page.getByRole("heading", { level: 1, name: fixtureTitle })).toBeVisible();
	await expect(page.getByText(fixtureSearchTerm)).toBeVisible();
	await expect(page.getByRole("link", { name: "ドキュメント一覧" })).toHaveAttribute(
		"href",
		"/aidlc-workflows-docs/docs/",
	);
	await expect(page.locator("pre").filter({ hasText: "bun run build" })).toBeVisible();
	await expect(page.getByRole("cell", { name: "JavaScript 無効" })).toBeVisible();
	await expect(page.getByRole("cell", { name: "読み取り可能" })).toBeVisible();
	await expect(page.locator("pre[data-mermaid]").first()).toContainText("flowchart TD");

	await context.close();
});
