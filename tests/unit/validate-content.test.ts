import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import {
	computeSourceHash,
	type TranslationManifest,
} from "../../lib/translation-manifest";
import { validateContent } from "../../scripts/validate-content";

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

function createTranslation(title: string, body: string[]): string {
	return [
		"---",
		`title: ${title}`,
		`description: ${title} translation`,
		"---",
		"",
		...body,
		"",
	].join("\n");
}

async function createValidProject(): Promise<{
	projectRoot: string;
	upstreamRoot: string;
	manifestPath: string;
}> {
	const projectRoot = await createTempDirectory("validate-project-");
	const upstreamRoot = await createTempDirectory("validate-upstream-");

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
		path.join(projectRoot, "docs/index.mdx"),
		createTranslation("Index", [
			"# Index",
			"",
			'<a id="index-heading"></a>',
			"## 概要",
			"",
			"See https://example.com/readme.",
			"",
			"[jump](#index-heading)",
		]),
	);
	await writeFileEnsuringDirectory(
		path.join(projectRoot, "docs/guide/current.mdx"),
		createTranslation("Guide", [
			"# Guide",
			"",
			"ガイド本文です。",
			"",
			"```bash",
			"echo hi",
			"```",
		]),
	);

	const manifest: TranslationManifest = {
		records: [
			{
				sourcePath: "docs/README.md",
				translationPath: "docs/index.mdx",
				sourceCommit: SOURCE_COMMIT,
				sourceHash: readmeHash,
			},
			{
				sourcePath: "docs/guide/current.md",
				translationPath: "docs/guide/current.mdx",
				sourceCommit: SOURCE_COMMIT,
				sourceHash: guideHash,
			},
		],
	};

	const manifestPath = path.join(projectRoot, "data/translation-manifest.json");
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
			'{"ok":true}\n',
		);
	}

	return { projectRoot, upstreamRoot, manifestPath };
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directoryPath) =>
				rm(directoryPath, { recursive: true, force: true }),
			),
	);
});

describe("validateContent", () => {
	it("passes for a project whose translations, manifest, anchors, and examples are aligned", async () => {
		const { projectRoot, upstreamRoot, manifestPath } =
			await createValidProject();

		const result = await validateContent({
			projectRoot,
			upstreamRoot,
			manifestPath,
		});

		expect(result.ok).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("reports actionable failures for coverage, routes, anchors, frontmatter, and JSON examples", async () => {
		const { projectRoot, upstreamRoot, manifestPath } =
			await createValidProject();

		await rm(path.join(projectRoot, "docs/guide/current.mdx"));
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/index.mdx"),
			createTranslation("Index", [
				"# Index",
				"",
				'<a id="Bad Anchor"></a>',
				"Paragraph without heading after the anchor.",
			]),
		);
		// Two files whose routes collide after numeric-prefix stripping.
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/guide/01-foo-bar.mdx"),
			createTranslation("Duplicate One", ["# Duplicate One"]),
		);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/guide/foo-bar.mdx"),
			createTranslation("Duplicate Two", ["# Duplicate Two"]),
		);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/guide/invalid-frontmatter.mdx"),
			["---", "title: Invalid Frontmatter", "---", "", "# Invalid"].join("\n"),
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
		expect(combinedErrors).toContain(
			"missing translation for manifest record: docs/guide/current.md",
		);
		expect(combinedErrors).toContain("translation without manifest record");
		expect(combinedErrors).toContain("duplicate public route: /guide/foo-bar");
		expect(combinedErrors).toContain("invalid frontmatter");
		expect(combinedErrors).toContain("Invalid source anchors");
		expect(combinedErrors).toContain("missing JSON example");
	});

	it("requires the manifest route override to match a frontmatter slug", async () => {
		const { projectRoot, manifestPath } = await createValidProject();
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/guide/current.mdx"),
			[
				"---",
				"title: Guide",
				"description: Guide translation",
				"slug: guide/current-overview",
				"---",
				"",
				"# Guide",
				"",
				"ガイド本文です。",
			].join("\n"),
		);

		const result = await validateContent({ projectRoot, manifestPath });

		expect(result.ok).toBe(false);
		expect(result.errors.join("\n")).toContain(
			"manifest route mismatch: docs/guide/current.mdx renders at /guide/current-overview but the manifest resolves /guide/current",
		);
	});

	it("skips invariants for a record lagging upstream and checks them for a current one", async () => {
		const { projectRoot, upstreamRoot, manifestPath } =
			await createValidProject();
		// Upstream moved on: recorded hash no longer matches, so the fence/URL
		// invariants are skipped for this page and validation still passes.
		await writeFile(
			path.join(upstreamRoot, "docs/guide/current.md"),
			"# Guide\n\nUpstream changed after translation.\n",
			"utf8",
		);

		const stale = await validateContent({
			projectRoot,
			upstreamRoot,
			manifestPath,
		});
		expect(stale).toEqual({ ok: true, errors: [] });

		// A current record whose translation drops a source URL fails invariants.
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/index.mdx"),
			createTranslation("Index", ["# Index", "", "URL を落とした翻訳です。"]),
		);
		const current = await validateContent({
			projectRoot,
			upstreamRoot,
			manifestPath,
		});
		expect(current.ok).toBe(false);
		expect(current.errors.join("\n")).toContain(
			"raw URL set mismatch: docs/index.mdx",
		);
	});

	it("rejects a recorded translation whose upstream source is missing", async () => {
		const { projectRoot, upstreamRoot, manifestPath } =
			await createValidProject();
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
