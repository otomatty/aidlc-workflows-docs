import { describe, expect, it } from "vitest";

import {
	computeSourceHash,
	formatSyncStatus,
	serializeTranslationManifest,
	type TranslationManifest,
} from "../../src/lib/translation-manifest";

describe("translation manifest helpers", () => {
	it("normalizes CRLF to LF before hashing without trimming other whitespace", async () => {
		const lfHash = await computeSourceHash("alpha\nbeta \n");
		const crlfHash = await computeSourceHash("alpha\r\nbeta \r\n");
		const trimmedHash = await computeSourceHash("alpha\nbeta\n");

		expect(crlfHash).toBe(lfHash);
		expect(trimmedHash).not.toBe(lfHash);
	});

	it("serializes manifest records in deterministic sourcePath order", () => {
		const manifest: TranslationManifest = {
			records: [
				{
					sourcePath: "docs/z-last.md",
					translationPath: "src/content/docs/z-last.md",
					sourceCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
					sourceHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				},
				{
					sourcePath: "docs/a-first.md",
					translationPath: "src/content/docs/a-first.md",
					sourceCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					sourceHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				},
			],
		};

		const serialized = serializeTranslationManifest(manifest);
		const parsed = JSON.parse(serialized) as TranslationManifest;

		expect(parsed.records.map((record) => record.sourcePath)).toEqual([
			"docs/a-first.md",
			"docs/z-last.md",
		]);
		expect(serialized.endsWith("\n")).toBe(true);
	});

	it("formats every sync status with an exhaustive label map", () => {
		expect(formatSyncStatus("added")).toBe("added");
		expect(formatSyncStatus("changed")).toBe("changed");
		expect(formatSyncStatus("deleted")).toBe("deleted");
		expect(formatSyncStatus("untranslated")).toBe("untranslated");
		expect(formatSyncStatus("current")).toBe("current");
	});
});
