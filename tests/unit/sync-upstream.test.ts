import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import {
	computeSourceHash,
	type TranslationManifest,
} from "../../lib/translation-manifest";
import { runSync } from "../../scripts/sync-upstream";
import { validateContent } from "../../scripts/validate-content";

const FIXTURE_DOCS_ROOT = path.resolve(
	process.cwd(),
	"tests/fixtures/upstream/docs",
);

const SOURCE_COMMIT = "1234567890abcdef1234567890abcdef12345678";

async function readFixture(name: string): Promise<string> {
	return readFile(path.join(FIXTURE_DOCS_ROOT, name), "utf8");
}

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

async function createProjectRoot(): Promise<string> {
	const projectRoot = await createTempDirectory("sync-project-");

	await mkdir(path.join(projectRoot, "docs"), { recursive: true });
	await mkdir(path.join(projectRoot, "data"), { recursive: true });

	return projectRoot;
}

async function writeManifest(
	projectRoot: string,
	manifest: TranslationManifest,
): Promise<string> {
	const manifestPath = path.join(projectRoot, "data/translation-manifest.json");
	await writeFile(manifestPath, JSON.stringify(manifest, null, "\t"), "utf8");
	return manifestPath;
}

async function createUpstreamRoot(): Promise<string> {
	const upstreamRoot = await createTempDirectory("sync-upstream-");
	await mkdir(path.join(upstreamRoot, "docs"), { recursive: true });
	return upstreamRoot;
}

function initializeGitRepository(upstreamRoot: string): string {
	execFileSync("git", ["init"], { cwd: upstreamRoot });
	execFileSync("git", ["-c", "core.autocrlf=false", "add", "."], {
		cwd: upstreamRoot,
	});
	execFileSync(
		"git",
		[
			"-c",
			"user.name=Sync Test",
			"-c",
			"user.email=sync@example.com",
			"commit",
			"-m",
			"Initial upstream snapshot",
		],
		{ cwd: upstreamRoot },
	);
	return execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: upstreamRoot,
		encoding: "utf8",
	}).trim();
}

function createTranslation(title: string): string {
	return [
		"---",
		`title: ${title}`,
		`description: ${title} translation`,
		"---",
		"",
		`# ${title} translation`,
		"",
		"これは翻訳本文です。",
		"",
	].join("\n");
}

async function writeRequiredJsonExamples(projectRoot: string): Promise<void> {
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
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findManifestTemporaryFiles(
	manifestPath: string,
): Promise<string[]> {
	const manifestBasename = path.basename(manifestPath);
	const temporaryNamePattern = new RegExp(
		`^${escapeRegExp(manifestBasename)}\\.\\d+\\.[0-9a-f-]{36}\\.tmp$`,
	);
	const directoryEntries = await readdir(path.dirname(manifestPath));
	return directoryEntries.filter((entry) => temporaryNamePattern.test(entry));
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directoryPath) =>
				rm(directoryPath, { recursive: true, force: true }),
			),
	);
});

describe("runSync", () => {
	it("reports all five sync statuses deterministically and never writes translations in report mode", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();

		temporaryDirectories.push(projectRoot, upstreamRoot);

		const currentSource = await readFixture("current.md");
		const changedSource = await readFixture("changed.md");
		const addedSource = await readFixture("added.md");

		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/current.mdx"),
			createTranslation("Current"),
		);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/changed.mdx"),
			createTranslation("Changed"),
		);

		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/current.md"),
			currentSource,
		);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/changed.md"),
			changedSource,
		);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/added.md"),
			addedSource,
		);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/untranslated.md"),
			"# Untranslated\n\nNo manifest record exists for this source.\n",
		);

		const manifest: TranslationManifest = {
			records: [
				{
					sourcePath: "docs/current.md",
					translationPath: "docs/current.mdx",
					sourceCommit: SOURCE_COMMIT,
					sourceHash: await computeSourceHash(currentSource),
				},
				{
					sourcePath: "docs/changed.md",
					translationPath: "docs/changed.mdx",
					sourceCommit: SOURCE_COMMIT,
					sourceHash: await computeSourceHash(
						"# Changed\n\nThis fixture used to match before upstream drift.\n",
					),
				},
				{
					sourcePath: "docs/deleted.md",
					translationPath: "docs/deleted.mdx",
					sourceCommit: SOURCE_COMMIT,
					sourceHash: await computeSourceHash("# Deleted\n\nRemoved upstream.\n"),
				},
				{
					sourcePath: "docs/added.md",
					translationPath: "docs/added.mdx",
					sourceCommit: SOURCE_COMMIT,
					sourceHash: await computeSourceHash(addedSource),
				},
			],
		};

		const manifestPath = await writeManifest(projectRoot, manifest);
		const result = await runSync({
			upstreamRoot,
			projectRoot,
			manifestPath,
			format: "json",
			record: false,
		});

		expect(
			result.report.entries.map((entry) => ({
				sourcePath: entry.sourcePath,
				status: entry.status,
			})),
		).toEqual([
			{ sourcePath: "docs/added.md", status: "added" },
			{ sourcePath: "docs/changed.md", status: "changed" },
			{ sourcePath: "docs/current.md", status: "current" },
			{ sourcePath: "docs/deleted.md", status: "deleted" },
			{ sourcePath: "docs/untranslated.md", status: "untranslated" },
		]);
		expect(existsSync(path.join(projectRoot, "docs/added.mdx"))).toBe(false);
		// 上流が git リポジトリでない場合、changed でも diffStat は付かない。
		const changedEntry = result.report.entries.find(
			(entry) => entry.status === "changed",
		);
		expect(changedEntry?.diffStat).toBeUndefined();
	});

	it("changed エントリに変更規模と推奨モード(patch / retranslate)を付与する", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();
		temporaryDirectories.push(projectRoot, upstreamRoot);

		const originalLines = Array.from(
			{ length: 10 },
			(_, index) => `Line ${index + 1}.`,
		);
		const originalSource = `# Small\n\n${originalLines.join("\n")}\n`;

		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/changed-small.md"),
			originalSource,
		);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/changed-big.md"),
			originalSource,
		);
		const recordedCommit = initializeGitRepository(upstreamRoot);

		// 小さな追記(churn 50% 未満)→ patch、全面書き換え(50% 以上)→ retranslate。
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/changed-small.md"),
			`${originalSource}Appended line.\n`,
		);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/changed-big.md"),
			"# Rewritten\n\nEntirely new content.\n",
		);

		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/changed-small.mdx"),
			createTranslation("Small"),
		);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/changed-big.mdx"),
			createTranslation("Big"),
		);

		const originalHash = await computeSourceHash(originalSource);
		const manifestPath = await writeManifest(projectRoot, {
			records: [
				{
					sourcePath: "docs/changed-small.md",
					translationPath: "docs/changed-small.mdx",
					sourceCommit: recordedCommit,
					sourceHash: originalHash,
				},
				{
					sourcePath: "docs/changed-big.md",
					translationPath: "docs/changed-big.mdx",
					sourceCommit: recordedCommit,
					sourceHash: originalHash,
				},
			],
		});

		const result = await runSync({
			upstreamRoot,
			projectRoot,
			manifestPath,
			format: "text",
		});
		const entriesBySourcePath = new Map(
			result.report.entries.map((entry) => [entry.sourcePath, entry]),
		);

		const smallEntry = entriesBySourcePath.get("docs/changed-small.md");
		expect(smallEntry?.status).toBe("changed");
		expect(smallEntry?.diffStat).toMatchObject({
			addedLines: 1,
			deletedLines: 0,
			sourceLines: 13,
			recommendedMode: "patch",
		});

		const bigEntry = entriesBySourcePath.get("docs/changed-big.md");
		expect(bigEntry?.status).toBe("changed");
		expect(bigEntry?.diffStat?.recommendedMode).toBe("retranslate");
		expect(bigEntry?.diffStat?.churnRatio).toBeGreaterThanOrEqual(0.5);

		expect(result.output).toContain(
			"changed docs/changed-small.md (churn 8%, mode=patch)",
		);
		expect(result.output).toContain("mode=retranslate");
	});

	it("rejects record mode when the upstream docs tree is dirty", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();

		temporaryDirectories.push(projectRoot, upstreamRoot);

		const currentSource = await readFixture("current.md");

		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/current.mdx"),
			createTranslation("Current"),
		);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/current.md"),
			currentSource,
		);

		initializeGitRepository(upstreamRoot);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/current.md"),
			`${currentSource}\nDirty change.\n`,
		);

		const manifestPath = await writeManifest(projectRoot, {
			records: [
				{
					sourcePath: "docs/current.md",
					translationPath: "docs/current.mdx",
					sourceCommit: SOURCE_COMMIT,
					sourceHash: await computeSourceHash(currentSource),
				},
			],
		});

		await expect(
			runSync({
				upstreamRoot,
				projectRoot,
				manifestPath,
				record: true,
				format: "text",
			}),
		).rejects.toThrow(/upstream docs tree must be clean/i);
	});

	it("records new translations at HEAD, keeps matching records, and never rewrites translation bytes", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();
		temporaryDirectories.push(projectRoot, upstreamRoot);

		const currentSource = await readFixture("current.md");
		const addedSource = await readFixture("added.md");
		const currentHash = await computeSourceHash(currentSource);
		const addedHash = await computeSourceHash(addedSource);

		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/current.md"),
			currentSource,
		);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/added.md"),
			addedSource,
		);
		const upstreamHead = initializeGitRepository(upstreamRoot);

		const currentTranslationPath = path.join(projectRoot, "docs/current.mdx");
		const addedTranslationPath = path.join(projectRoot, "docs/added.mdx");
		await writeFileEnsuringDirectory(
			currentTranslationPath,
			createTranslation("Current"),
		);
		await writeFileEnsuringDirectory(
			addedTranslationPath,
			createTranslation("Added"),
		);
		await writeRequiredJsonExamples(projectRoot);

		const manifestPath = await writeManifest(projectRoot, {
			records: [
				{
					sourcePath: "docs/current.md",
					translationPath: "docs/current.mdx",
					sourceCommit: SOURCE_COMMIT,
					sourceHash: currentHash,
				},
			],
		});
		const bytesBefore = await Promise.all([
			readFile(currentTranslationPath),
			readFile(addedTranslationPath),
		]);

		await runSync({
			upstreamRoot,
			projectRoot,
			manifestPath,
			record: true,
			format: "json",
		});

		const recordedManifest = JSON.parse(
			await readFile(manifestPath, "utf8"),
		) as TranslationManifest;
		expect(recordedManifest.records).toEqual([
			{
				sourcePath: "docs/added.md",
				translationPath: "docs/added.mdx",
				sourceCommit: upstreamHead,
				sourceHash: addedHash,
			},
			{
				sourcePath: "docs/current.md",
				translationPath: "docs/current.mdx",
				sourceCommit: SOURCE_COMMIT,
				sourceHash: currentHash,
			},
		]);
		expect(await findManifestTemporaryFiles(manifestPath)).toEqual([]);
		expect(await readFile(currentTranslationPath)).toEqual(bytesBefore[0]);
		expect(await readFile(addedTranslationPath)).toEqual(bytesBefore[1]);

		const validation = await validateContent({
			projectRoot,
			upstreamRoot,
			manifestPath,
		});
		expect(validation).toEqual({ ok: true, errors: [] });
	});

	it("rejects record mode when an existing record lags upstream and was not requested", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();
		temporaryDirectories.push(projectRoot, upstreamRoot);

		const changedSource = await readFixture("changed.md");
		const staleHash = await computeSourceHash(
			"# Changed\n\nPrevious source contents.\n",
		);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/changed.md"),
			changedSource,
		);
		initializeGitRepository(upstreamRoot);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/changed.mdx"),
			createTranslation("Changed"),
		);
		const manifestPath = await writeManifest(projectRoot, {
			records: [
				{
					sourcePath: "docs/changed.md",
					translationPath: "docs/changed.mdx",
					sourceCommit: SOURCE_COMMIT,
					sourceHash: staleHash,
				},
			],
		});
		const manifestBefore = await readFile(manifestPath, "utf8");

		await expect(
			runSync({
				upstreamRoot,
				projectRoot,
				manifestPath,
				record: true,
			}),
		).rejects.toThrow(/stale record for docs\/changed\.mdx/i);
		expect(await readFile(manifestPath, "utf8")).toBe(manifestBefore);
	});

	it("re-blesses an explicitly requested translation at upstream HEAD", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();
		temporaryDirectories.push(projectRoot, upstreamRoot);

		const changedSource = await readFixture("changed.md");
		const changedHash = await computeSourceHash(changedSource);
		const staleHash = await computeSourceHash(
			"# Changed\n\nPrevious source contents.\n",
		);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/changed.md"),
			changedSource,
		);
		const upstreamHead = initializeGitRepository(upstreamRoot);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/changed.mdx"),
			createTranslation("Changed"),
		);
		const manifestPath = await writeManifest(projectRoot, {
			records: [
				{
					sourcePath: "docs/changed.md",
					translationPath: "docs/changed.mdx",
					sourceCommit: SOURCE_COMMIT,
					sourceHash: staleHash,
				},
			],
		});

		await runSync({
			upstreamRoot,
			projectRoot,
			manifestPath,
			record: true,
			recordPaths: ["docs/changed.mdx"],
		});

		const recordedManifest = JSON.parse(
			await readFile(manifestPath, "utf8"),
		) as TranslationManifest;
		expect(recordedManifest.records).toEqual([
			{
				sourcePath: "docs/changed.md",
				translationPath: "docs/changed.mdx",
				sourceCommit: upstreamHead,
				sourceHash: changedHash,
			},
		]);
	});

	it("rejects record mode for an unknown requested translation path", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();
		temporaryDirectories.push(projectRoot, upstreamRoot);

		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/tracked.md"),
			"# Tracked\n",
		);
		initializeGitRepository(upstreamRoot);
		const manifestPath = await writeManifest(projectRoot, { records: [] });

		await expect(
			runSync({
				upstreamRoot,
				projectRoot,
				manifestPath,
				record: true,
				recordPaths: ["docs/nope.mdx"],
			}),
		).rejects.toThrow(/no such translation file: docs\/nope\.mdx/i);
	});

	it("rejects record mode when a translated source is missing upstream", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();
		temporaryDirectories.push(projectRoot, upstreamRoot);

		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/tracked.md"),
			"# Tracked\n",
		);
		initializeGitRepository(upstreamRoot);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "docs/missing.mdx"),
			createTranslation("Missing"),
		);
		const manifestPath = await writeManifest(projectRoot, { records: [] });

		await expect(
			runSync({
				upstreamRoot,
				projectRoot,
				manifestPath,
				record: true,
			}),
		).rejects.toThrow(/missing upstream source for translated file/i);
	});
});
