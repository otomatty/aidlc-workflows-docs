import { describe, expect, it } from "vitest";

import {
	contentIdToRoute,
	sourcePathToContentId,
	withBase,
} from "../../src/lib/routes";

describe("routes", () => {
	it("converts source paths to content ids and routes", () => {
		expect(sourcePathToContentId("docs/README.md")).toBe("index");
		expect(sourcePathToContentId("docs/guide/00-introduction.md")).toBe(
			"guide/00-introduction",
		);
		expect(
			sourcePathToContentId(
				"docs/reference/research/Codex Manifest Shape Report.md",
			),
		).toBe("reference/research/codex-manifest-shape-report");
		expect(contentIdToRoute("index")).toBe("/docs/");
		expect(contentIdToRoute("guide/00-introduction")).toBe(
			"/guide/00-introduction/",
		);
		expect(contentIdToRoute("guide/harnesses/README")).toBe(
			"/guide/harnesses/",
		);
		expect(contentIdToRoute("guide/agents/readme")).toBe("/guide/agents/");
		expect(withBase("/guide/00-introduction/")).toBe(
			"/aidlc-workflows-docs/guide/00-introduction/",
		);
	});
});
