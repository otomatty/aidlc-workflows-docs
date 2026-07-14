import { defineConfig } from "blume";

export default defineConfig({
	title: "AI-DLC ドキュメント",
	description: "awslabs/aidlc-workflows の日本語ドキュメントサイト。",
	content: {
		exclude: ["**/_*", "**/.*", "superpowers/**"],
	},
	github: {
		owner: "otomatty",
		repo: "aidlc-workflows-docs",
	},
	i18n: {
		defaultLocale: "ja",
		locales: [{ code: "ja", label: "日本語" }],
	},
	// Pagefind: CJK-aware tokenization for Japanese content.
	search: {
		provider: "pagefind",
	},
	deployment: {
		site: "https://otomatty.github.io",
		base: "/aidlc-workflows-docs",
	},
});
