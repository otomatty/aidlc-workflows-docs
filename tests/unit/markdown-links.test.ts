import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { remarkGithubAlerts } from "../../src/lib/markdown/remark-github-alerts";
import { remarkMermaid } from "../../src/lib/markdown/remark-mermaid";
import {
	remarkUpstreamLinks,
	rewriteUpstreamHref,
} from "../../src/lib/markdown/remark-upstream-links";

const SOURCE_COMMIT = "3c76878775915b6dc510fa7e1ef0991ba510cd53";
const SOURCE_PATH = "docs/guide/00-introduction.md";

describe("rewriteUpstreamHref", () => {
	it("rewrites docs-relative and upstream-repository links", () => {
		expect(rewriteUpstreamHref("../README.md", SOURCE_PATH, SOURCE_COMMIT)).toBe(
			"/aidlc-workflows-docs/docs/",
		);
		expect(
			rewriteUpstreamHref(
				"../reference/01-architecture.md#planes",
				SOURCE_PATH,
				SOURCE_COMMIT,
			),
		).toBe("/aidlc-workflows-docs/reference/01-architecture/#planes");
		expect(
			rewriteUpstreamHref(
				"../../plugins/test-pro/.aidlc-plugin/plugin.json",
				SOURCE_PATH,
				SOURCE_COMMIT,
			),
		).toBe(
			`https://github.com/awslabs/aidlc-workflows/blob/${SOURCE_COMMIT}/plugins/test-pro/.aidlc-plugin/plugin.json`,
		);
		expect(rewriteUpstreamHref("https://bun.sh", SOURCE_PATH, SOURCE_COMMIT)).toBe(
			"https://bun.sh",
		);
	});

	it("leaves hash-only and mailto links unchanged", () => {
		expect(
			rewriteUpstreamHref("#configuration-layers", SOURCE_PATH, SOURCE_COMMIT),
		).toBe("#configuration-layers");
		expect(
			rewriteUpstreamHref(
				"mailto:docs@example.com",
				SOURCE_PATH,
				SOURCE_COMMIT,
			),
		).toBe("mailto:docs@example.com");
	});
});

describe("remark markdown transforms", () => {
	it("rewrites markdown links through the upstream resolver", async () => {
		const processor = await createMarkdownProcessor({
			remarkPlugins: [remarkUpstreamLinks],
		});
		const result = await processor.render("[README](../README.md)", {
			frontmatter: {
				sourcePath: SOURCE_PATH,
				sourceCommit: SOURCE_COMMIT,
			},
		});

		expect(result.code).toContain(
			'<a href="/aidlc-workflows-docs/docs/">README</a>',
		);
	});

	it("annotates GitHub Alerts with their normalized kind", async () => {
		const processor = await createMarkdownProcessor({
			remarkPlugins: [remarkGithubAlerts],
		});
		const result = await processor.render(
			"> [!WARNING]\n>\n> 翻訳時の注意点です。",
		);

		expect(result.code).toContain('<blockquote data-alert-kind="warning">');
		expect(result.code).not.toContain("[!WARNING]");
		expect(result.code).toContain("<p>翻訳時の注意点です。</p>");
	});

	it("preserves inline children following an alert marker", async () => {
		const processor = await createMarkdownProcessor({
			remarkPlugins: [remarkGithubAlerts],
		});
		const result = await processor.render(
			"> [!NOTE] **重要**な [リンク](https://example.com)",
		);

		expect(result.code).toContain(
			'<p><strong>重要</strong>な <a href="https://example.com">リンク</a></p>',
		);
	});

	it("preserves spacing between plain text and inline alert content", async () => {
		const processor = await createMarkdownProcessor({
			remarkPlugins: [remarkGithubAlerts],
		});

		const result = await processor.render("> [!NOTE] Plain **bold**");

		expect(result.code).toContain("<p>Plain <strong>bold</strong></p>");
	});

	it("marks mermaid fences without evaluating the diagram", async () => {
		const processor = await createMarkdownProcessor({
			remarkPlugins: [remarkMermaid],
		});
		const result = await processor.render(
			"```mermaid\ngraph TD; A-->B;\n```",
		);

		expect(result.code).toContain(
			'<pre data-mermaid="" data-language="mermaid"><code class="language-mermaid">graph TD; A-->B;</code></pre>',
		);
	});

	it("renders transformed HTML with rewritten links and annotations", async () => {
		const processor = await createMarkdownProcessor({
			remarkPlugins: [
				remarkGfm,
				remarkUpstreamLinks,
				remarkGithubAlerts,
				remarkMermaid,
			],
		});
		const markdown = [
			"[external](https://bun.sh)",
			"",
			"[docs](../README.md)",
			"",
			"> [!WARNING]",
			"> 注意です。",
			"",
			"```mermaid",
			"graph TD; A-->B;",
			"```",
		].join("\n");

		const result = await processor.render(markdown, {
			frontmatter: {
				sourcePath: SOURCE_PATH,
				sourceCommit: SOURCE_COMMIT,
			},
		});

		expect(result.code).toContain('<a href="https://bun.sh">external</a>');
		expect(result.code).toContain(
			'<a href="/aidlc-workflows-docs/docs/">docs</a>',
		);
		expect(result.code).toContain('<blockquote data-alert-kind="warning">');
		expect(result.code).toContain("data-mermaid");
	});
});
