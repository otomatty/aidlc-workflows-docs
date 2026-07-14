export const SITE_ORIGIN = "https://otomatty.github.io";
export const SITE_BASE = "/aidlc-workflows-docs";
export const SITE_URL = new URL(`${SITE_BASE}/`, SITE_ORIGIN).toString();

export const siteMetadata = {
	title: "AI-DLC ドキュメントサイト",
	description:
		"awslabs/aidlc-workflows の日本語ドキュメントサイト。",
	origin: SITE_ORIGIN,
	base: SITE_BASE,
	siteUrl: SITE_URL,
	repositoryUrl: "https://github.com/otomatty/aidlc-workflows-docs",
	upstreamRepositoryUrl: "https://github.com/awslabs/aidlc-workflows",
	labels: {
		docs: "ドキュメント",
		changelog: "変更履歴",
		github: "GitHub",
	},
} as const;
