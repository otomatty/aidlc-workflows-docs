import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { describe, expect, it } from "vitest";

import {
	remarkValidateSourceAnchors,
	validateSourceAnchors,
} from "../../src/lib/markdown/source-anchors";

describe("validateSourceAnchors", () => {
	it("accepts explicit source anchors before translated headings", () => {
		const result = validateSourceAnchors(`
<a id="configuration-layers"></a>
## 設定レイヤー

関連リンクは [こちら](#configuration-layers) を参照してください。
`);

		expect(result).toEqual({
			ok: true,
			anchorIds: ["configuration-layers"],
			duplicateIds: [],
			invalidIds: [],
			missingReferences: [],
			misplacedAnchorIds: [],
		});
	});

	it("accepts repeated hyphens from an exact upstream fragment", () => {
		const result = validateSourceAnchors(`
<a id="aidlc---doctor-health-check"></a>
## \`/aidlc --doctor\` — 健全性チェック

関連リンクは [こちら](#aidlc---doctor-health-check) を参照してください。
`);

		expect(result.ok).toBe(true);
		expect(result.anchorIds).toEqual(["aidlc---doctor-health-check"]);
	});

	it("accepts underscores and repeated hyphens from pinned GitHub slugs", () => {
		const result = validateSourceAnchors(`
<a id="judgment-calls-matches-and-default_severity"></a>
## 判断が必要な箇所: \`matches\` と \`default_severity\`

[severity](#judgment-calls-matches-and-default_severity)

<a id="the-driver-seam---aidlc_use_swarm"></a>
## driver seam: \`AIDLC_USE_SWARM\`

[driver](#the-driver-seam---aidlc_use_swarm)
`);

		expect(result.ok).toBe(true);
		expect(result.anchorIds).toEqual([
			"judgment-calls-matches-and-default_severity",
			"the-driver-seam---aidlc_use_swarm",
		]);
	});

	it("reports duplicate anchor ids", () => {
		const result = validateSourceAnchors(`
<a id="configuration-layers"></a>
## 設定レイヤー

<a id="configuration-layers"></a>
## 別の見出し
`);

		expect(result.ok).toBe(false);
		expect(result.duplicateIds).toEqual(["configuration-layers"]);
	});

	it("reports invalid source anchor ids", () => {
		const result = validateSourceAnchors(`
<a id="Configuration Layers"></a>
## 設定レイヤー
`);

		expect(result.ok).toBe(false);
		expect(result.invalidIds).toEqual(["Configuration Layers"]);
	});

	it("reports links to missing source anchors", () => {
		const result = validateSourceAnchors(`
<a id="configuration-layers"></a>
## 設定レイヤー

See [missing](#missing-anchor).
`);

		expect(result.ok).toBe(false);
		expect(result.missingReferences).toEqual(["missing-anchor"]);
	});

	it("rejects a blank line between an anchor and its heading", () => {
		const result = validateSourceAnchors(`
<a id="configuration-layers"></a>

## 設定レイヤー
`);

		expect(result.ok).toBe(false);
		expect(result.misplacedAnchorIds).toEqual(["configuration-layers"]);
	});

	it("rejects an anchor not followed by an ATX heading", () => {
		const result = validateSourceAnchors(`
<a id="configuration-layers"></a>
設定レイヤー
---
`);

		expect(result.ok).toBe(false);
		expect(result.misplacedAnchorIds).toEqual(["configuration-layers"]);
	});
});

describe("remarkValidateSourceAnchors", () => {
	it("fails markdown processing with actionable validation details", async () => {
		const processor = await createMarkdownProcessor({
			remarkPlugins: [remarkValidateSourceAnchors],
		});
		const markdown = [
			'<a id="Configuration Layers"></a>',
			"",
			"## 設定レイヤー",
			"",
			'<a id="duplicate"></a>',
			"## 重複1",
			"",
			'<a id="duplicate"></a>',
			"## 重複2",
			"",
			"[missing](#missing-anchor)",
		].join("\n");

		await expect(
			processor.render(markdown),
		).rejects.toThrow(
			'Invalid source anchors: duplicate IDs: "duplicate"; invalid IDs: "Configuration Layers"; missing local hash targets: "missing-anchor"; anchors not immediately followed by an ATX heading: "Configuration Layers"',
		);
	});
});
