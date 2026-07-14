import { describe, expect, it } from "vitest";

import {
	collectTranslatedDocs,
	EXPECTED_JSON_EXAMPLES,
} from "../../lib/translated-docs";
import { readTranslationManifest } from "../../lib/translation-manifest";

describe("content coverage", () => {
	it("matches manifest record count to translated markdown docs and JSON examples", async () => {
		const projectRoot = process.cwd();
		const manifest = await readTranslationManifest(
			`${projectRoot}/data/translation-manifest.json`,
		);
		const docs = await collectTranslatedDocs(projectRoot);

		expect(manifest.records).toHaveLength(docs.length);
		expect(manifest.records).toHaveLength(89);
		expect(EXPECTED_JSON_EXAMPLES).toHaveLength(3);

		const translationPaths = new Set(docs.map((doc) => doc.relativePath));
		for (const record of manifest.records) {
			expect(translationPaths.has(record.translationPath)).toBe(true);
		}
	});
});
