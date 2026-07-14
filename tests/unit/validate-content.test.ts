import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { validateContent } from "../../scripts/validate-content";
import {
	computeSourceHash,
	type TranslationManifest,
} from "../../src/lib/translation-manifest";

const SOURCE_COMMIT = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";
const temporaryDirectories: string[] = [];

async function createTempDirectory(prefix: string): Promise<string> {
	return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function writeFileEnsuringDirectory(
	filePath: string,
	contents: string,
): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, contents, "utf8");
}

async function createValidProject(): Promise<{
	projectRoot: string;
	upstreamRoot: string;
	manifestPath: string;
}> {
	const projectRoot = await createTempDirectory("task7-validate-project-");
	const upstreamRoot = await createTempDirectory("task7-validate-upstream-");

	temporaryDirectories.push(projectRoot, upstreamRoot);

	const readmeSource =
		"# README\n\nSource of the translated index page.\n\nSee https://example.com/readme.\n";
	const guideSource =
		"# Guide\n\nSource of the translated guide page.\n\n```bash\necho hi\n```\n";
	const readmeHash = await computeSourceHash(readmeSource);
	const guideHash = await computeSourceHash(guideSource);

	await writeFileEnsuringDirectory(
		path.join(upstreamRoot, "docs/README.md"),
		readmeSource,
	);
	await writeFileEnsuringDirectory(
		path.join(upstreamRoot, "docs/guide/current.md"),
		guideSource,
	);

	await writeFileEnsuringDirectory(
		path.join(projectRoot, "src/content/docs/index.md"),
		[
			"---",
			"title: Index",
			"description: Index translation",
			"sidebarOrder: 0",
			"sourcePath: docs/README.md",
			`sourceCommit: ${SOURCE_COMMIT}`,
			`sourceHash: ${readmeHash}`,
			"translationStatus: current",
			"---",
			"",
			"# Index",
			"",
			"<a id=\"index-heading\"></a>",
			"## 概要",
			"",
			"See https://example.com/readme.",
			"",
			"[jump](#index-heading)",
		].join("\n"),
	);
	await writeFileEnsuringDirectory(
		path.join(projectRoot, "src/content/docs/guide/current.md"),
		[
			"---",
			"title: Guide",
			"description: Guide translation",
			"sidebarOrder: 1",
			"sourcePath: docs/guide/current.md",
			`sourceCommit: ${SOURCE_COMMIT}`,
			`sourceHash: ${guideHash}`,
			"translationStatus: current",
			"---",
			"",
			"# Guide",
			"",
			"ガイド本文です。",
			"",
			"```bash",
			"echo hi",
			"```",
		].join("\n"),
	);

	const manifest: TranslationManifest = {
		records: [
			{
				sourcePath: "docs/README.md",
				translationPath: "src/content/docs/index.md",
				sourceCommit: SOURCE_COMMIT,
				sourceHash: readmeHash,
			},
			{
				sourcePath: "docs/guide/current.md",
				translationPath: "src/content/docs/guide/current.md",
				sourceCommit: SOURCE_COMMIT,
				sourceHash: guideHash,
			},
		],
	};

	const manifestPath = path.join(
		projectRoot,
		"src/data/translation-manifest.json",
	);
	await writeFileEnsuringDirectory(
		manifestPath,
		JSON.stringify(manifest, null, "\t"),
	);

	for (const exampleName of [
		"aidlc.lock.json",
		"managed-settings.json",
		"marketplace.json",
	]) {
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "public/examples/test-pro", exampleName),
			"{\"ok\":true}\n",
		);
	}

	return { projectRoot, upstreamRoot, manifestPath };
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directoryPath) =>
			rm(directoryPath, { recursive: true, force: true }),
		),
	);
});

describe("validateContent", () => {
	it("passes for a project whose translations, manifest, anchors, and examples are aligned", async () => {
		const { projectRoot, upstreamRoot, manifestPath } = await createValidProject();

		const result = await validateContent({
			projectRoot,
			upstreamRoot,
			manifestPath,
		});

		expect(result.ok).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("reports actionable failures for coverage, metadata, routes, anchors, and JSON examples", async () => {
		const { projectRoot, upstreamRoot, manifestPath } = await createValidProject();

		await rm(path.join(projectRoot, "src/content/docs/guide/current.md"));
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "src/content/docs/index.md"),
			[
				"---",
				"title: Index",
				"description: Index translation",
				"sidebarOrder: 0",
				"sourcePath: docs/README.md",
				`sourceCommit: ${SOURCE_COMMIT}`,
				"sourceHash: \"1111111111111111111111111111111111111111111111111111111111111111\"",
				"translationStatus: current",
				"---",
				"",
				"# Index",
				"",
				"<a id=\"Bad Anchor\"></a>",
				"Paragraph without heading after the anchor.",
			].join("\n"),
		);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "src/content/docs/unrecorded-one.md"),
			[
				"---",
				"title: Duplicate One",
				"description: First duplicate route",
				"sidebarOrder: 2",
				"sourcePath: docs/guide/Foo Bar.md",
				`sourceCommit: ${SOURCE_COMMIT}`,
				"sourceHash: \"2222222222222222222222222222222222222222222222222222222222222222\"",
				"translationStatus: current",
				"---",
				"",
				"# Duplicate One",
			].join("\n"),
		);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "src/content/docs/unrecorded-two.md"),
			[
				"---",
				"title: Duplicate Two",
				"description: Second duplicate route",
				"sidebarOrder: 3",
				"sourcePath: docs/guide/foo-bar.md",
				`sourceCommit: ${SOURCE_COMMIT}`,
				"sourceHash: \"3333333333333333333333333333333333333333333333333333333333333333\"",
				"translationStatus: current",
				"---",
				"",
				"# Duplicate Two",
			].join("\n"),
		);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "src/content/docs/invalid-frontmatter.md"),
			[
				"---",
				"title: Invalid Frontmatter",
				"description: Missing source hash",
				"sidebarOrder: 4",
				"sourcePath: docs/guide/invalid.md",
				"sourceCommit: not-a-commit",
				"translationStatus: current",
				"---",
				"",
				"# Invalid Frontmatter",
			].join("\n"),
		);
		await rm(
			path.join(projectRoot, "public/examples/test-pro/marketplace.json"),
		);

		const result = await validateContent({
			projectRoot,
			upstreamRoot,
			manifestPath,
		});
		const combinedErrors = result.errors.join("\n");

		expect(result.ok).toBe(false);
		expect(combinedErrors).toContain("missing translation for manifest record: docs/guide/current.md");
		expect(combinedErrors).toContain("translation without manifest record");
		expect(combinedErrors).toContain("duplicate public route");
		expect(combinedErrors).toContain("invalid frontmatter");
		expect(combinedErrors).toContain("source metadata differs from manifest");
		expect(combinedErrors).toContain("Invalid source anchors");
		expect(combinedErrors).toContain("missing JSON example");
	});

	it("accepts stale status when current upstream differs from recorded source hash", async () => {
		const { projectRoot, upstreamRoot, manifestPath } = await createValidProject();
		const translationPath = path.join(
			projectRoot,
			"src/content/docs/guide/current.md",
		);
		const translation = await readFile(translationPath, "utf8");
		await writeFile(
			translationPath,
			translation.replace(
				"translationStatus: current",
				"translationStatus: stale",
			),
			"utf8",
		);
		await writeFile(
			path.join(upstreamRoot, "docs/guide/current.md"),
			"# Guide\n\nUpstream changed after translation.\n",
			"utf8",
		);

		const result = await validateContent({
			projectRoot,
			upstreamRoot,
			manifestPath,
		});

		expect(result).toEqual({ ok: true, errors: [] });
	});

	it.each([
		{
			name: "current status for changed upstream",
			status: "current",
			changeUpstream: true,
			expectedReality: "stale",
		},
		{
			name: "stale status for matching upstream",
			status: "stale",
			changeUpstream: false,
			expectedReality: "current",
		},
	])(
		"rejects $name",
		async ({ status, changeUpstream, expectedReality }) => {
			const { projectRoot, upstreamRoot, manifestPath } =
				await createValidProject();
			const translationPath = path.join(
				projectRoot,
				"src/content/docs/guide/current.md",
			);
			const translation = await readFile(translationPath, "utf8");
			await writeFile(
				translationPath,
				translation.replace(
					"translationStatus: current",
					`translationStatus: ${status}`,
				),
				"utf8",
			);

			if (changeUpstream) {
				await writeFile(
					path.join(upstreamRoot, "docs/guide/current.md"),
					"# Guide\n\nUpstream changed after translation.\n",
					"utf8",
				);
			}

			const result = await validateContent({
				projectRoot,
				upstreamRoot,
				manifestPath,
			});

			expect(result.ok).toBe(false);
			expect(result.errors.join("\n")).toContain(
				`translationStatus mismatch: src/content/docs/guide/current.md declares ${status} but upstream is ${expectedReality}`,
			);
		},
	);

	it("rejects a recorded translation whose upstream source is missing", async () => {
		const { projectRoot, upstreamRoot, manifestPath } = await createValidProject();
		await rm(path.join(upstreamRoot, "docs/guide/current.md"));

		const result = await validateContent({
			projectRoot,
			upstreamRoot,
			manifestPath,
		});

		expect(result.ok).toBe(false);
		expect(result.errors.join("\n")).toContain(
			"missing upstream source for recorded translation: docs/guide/current.md",
		);
	});
});
