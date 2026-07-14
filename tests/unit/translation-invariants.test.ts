import { describe, expect, it } from "vitest";

import {
	collectTranslationInvariantErrors,
	extractFenceBlocks,
	extractRawUrls,
	hasJapaneseProse,
} from "../../src/lib/translation-invariants";

describe("translation invariants", () => {
	it("accepts matching non-Mermaid fences, URLs, unique anchors, and Japanese prose", () => {
		const source = [
			"# Title",
			"",
			"See https://example.com/a.",
			"",
			"```bash",
			"echo hi",
			"```",
			"",
			"```mermaid",
			"graph TD",
			"  A --> B",
			"```",
			"",
		].join("\n");
		const translation = [
			"---",
			"title: 題",
			"---",
			"",
			"<a id=\"title\"></a>",
			"# 題",
			"",
			"説明です。 https://example.com/a",
			"",
			"```bash",
			"echo hi",
			"```",
			"",
			"```mermaid",
			"graph TD",
			"  甲 --> 乙",
			"```",
			"",
		].join("\n");

		expect(extractFenceBlocks(source)).toHaveLength(2);
		expect(extractRawUrls(source)).toEqual(["https://example.com/a"]);
		expect(hasJapaneseProse(translation)).toBe(true);
		expect(
			collectTranslationInvariantErrors(
				"docs/x.md",
				source,
				"src/content/docs/x.md",
				translation,
			),
		).toEqual([]);
	});

	it("fails when a non-Mermaid fence changes or Japanese prose is missing", () => {
		const source = "# Title\n\n```bash\necho hi\n```\n";
		const brokenFence = "# 題\n\n説明です。\n\n```bash\necho bye\n```\n";
		const missingJapanese = "# Title\n\n```bash\necho hi\n```\n";

		expect(
			collectTranslationInvariantErrors(
				"docs/x.md",
				source,
				"src/content/docs/x.md",
				brokenFence,
			),
		).toContain(
			"non-Mermaid fence mismatch: src/content/docs/x.md (source docs/x.md)",
		);
		expect(
			collectTranslationInvariantErrors(
				"docs/x.md",
				source,
				"src/content/docs/x.md",
				missingJapanese,
			),
		).toContain(
			"missing Japanese prose outside code fences: src/content/docs/x.md",
		);
	});
});
