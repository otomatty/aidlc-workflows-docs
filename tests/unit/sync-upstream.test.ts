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
import { runSync } from "../../scripts/sync-upstream";
import { validateContent } from "../../scripts/validate-content";
import {
	computeSourceHash,
	type TranslationManifest,
} from "../../src/lib/translation-manifest";

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
	const projectRoot = await createTempDirectory("task7-project-");

	await mkdir(path.join(projectRoot, "src/content/docs"), { recursive: true });
	await mkdir(path.join(projectRoot, "src/data"), { recursive: true });

	return projectRoot;
}

async function writeManifest(
	projectRoot: string,
	manifest: TranslationManifest,
): Promise<string> {
	const manifestPath = path.join(
		projectRoot,
		"src/data/translation-manifest.json",
	);
	await writeFile(
		manifestPath,
		JSON.stringify(manifest, null, "\t"),
		"utf8",
	);
	return manifestPath;
}

async function createUpstreamRoot(): Promise<string> {
	const upstreamRoot = await createTempDirectory("task7-upstream-");
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
			"user.name=Task Seven",
			"-c",
			"user.email=task7@example.com",
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

function createTranslation(
	title: string,
	sourcePath: string,
	sourceCommit: string,
	sourceHash: string,
	translationStatus = "current",
): string {
	return [
		"---",
		`title: ${title}`,
		`description: ${title} translation`,
		"sidebarOrder: 0",
		`sourcePath: ${sourcePath}`,
		`sourceCommit: ${sourceCommit}`,
		`sourceHash: ${sourceHash}`,
		`translationStatus: ${translationStatus}`,
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
			"{\"ok\":true}\n",
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
		temporaryDirectories.splice(0).map((directoryPath) =>
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
			path.join(projectRoot, "src/content/docs/current.md"),
			"# Current translation\n",
		);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "src/content/docs/changed.md"),
			"# Changed translation\n",
		);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "src/content/docs/deleted.md"),
			"# Deleted translation\n",
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
					translationPath: "src/content/docs/current.md",
					sourceCommit: SOURCE_COMMIT,
					sourceHash: await computeSourceHash(currentSource),
				},
				{
					sourcePath: "docs/changed.md",
					translationPath: "src/content/docs/changed.md",
					sourceCommit: SOURCE_COMMIT,
					sourceHash: await computeSourceHash(
						"# Changed\n\nThis fixture used to match before upstream drift.\n",
					),
				},
				{
					sourcePath: "docs/deleted.md",
					translationPath: "src/content/docs/deleted.md",
					sourceCommit: SOURCE_COMMIT,
					sourceHash: await computeSourceHash("# Deleted\n\nRemoved upstream.\n"),
				},
				{
					sourcePath: "docs/added.md",
					translationPath: "src/content/docs/added.md",
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
		expect(
			existsSync(path.join(projectRoot, "src/content/docs/added.md")),
		).toBe(false);
	});

	it("rejects record mode when the upstream docs tree is dirty", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();

		temporaryDirectories.push(projectRoot, upstreamRoot);

		const currentSource = await readFixture("current.md");

		await writeFileEnsuringDirectory(
			path.join(projectRoot, "src/content/docs/current.md"),
			[
				"---",
				"title: Current",
				"description: Current translation",
				"sidebarOrder: 0",
				"sourcePath: docs/current.md",
				`sourceCommit: ${SOURCE_COMMIT}`,
				`sourceHash: ${await computeSourceHash(currentSource)}`,
				"translationStatus: current",
				"---",
				"",
				"# Current translation",
			].join("\n"),
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
					translationPath: "src/content/docs/current.md",
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

	it("atomically records verified translation metadata without changing translation bytes", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();
		temporaryDirectories.push(projectRoot, upstreamRoot);

		const currentSource = await readFixture("current.md");
		const changedSource = await readFixture("changed.md");
		const currentHash = await computeSourceHash(currentSource);
		const changedHash = await computeSourceHash(changedSource);
		const previousChangedHash = await computeSourceHash(
			"# Changed\n\nPrevious source contents.\n",
		);

		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/current.md"),
			currentSource,
		);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/changed.md"),
			changedSource,
		);
		const upstreamHead = initializeGitRepository(upstreamRoot);

		const currentTranslation = createTranslation(
			"Current",
			"docs/current.md",
			SOURCE_COMMIT,
			currentHash,
		);
		const changedTranslation = createTranslation(
			"Changed",
			"docs/changed.md",
			upstreamHead,
			changedHash,
		);
		const currentTranslationPath = path.join(
			projectRoot,
			"src/content/docs/current.md",
		);
		const changedTranslationPath = path.join(
			projectRoot,
			"src/content/docs/changed.md",
		);
		await writeFileEnsuringDirectory(currentTranslationPath, currentTranslation);
		await writeFileEnsuringDirectory(changedTranslationPath, changedTranslation);
		await writeRequiredJsonExamples(projectRoot);

		const manifestPath = await writeManifest(projectRoot, {
			records: [
				{
					sourcePath: "docs/current.md",
					translationPath: "src/content/docs/current.md",
					sourceCommit: SOURCE_COMMIT,
					sourceHash: currentHash,
				},
				{
					sourcePath: "docs/changed.md",
					translationPath: "src/content/docs/changed.md",
					sourceCommit: SOURCE_COMMIT,
					sourceHash: previousChangedHash,
				},
			],
		});
		const bytesBefore = await Promise.all([
			readFile(currentTranslationPath),
			readFile(changedTranslationPath),
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
				sourcePath: "docs/changed.md",
				translationPath: "src/content/docs/changed.md",
				sourceCommit: upstreamHead,
				sourceHash: changedHash,
			},
			{
				sourcePath: "docs/current.md",
				translationPath: "src/content/docs/current.md",
				sourceCommit: SOURCE_COMMIT,
				sourceHash: currentHash,
			},
		]);
		expect(await findManifestTemporaryFiles(manifestPath)).toEqual([]);
		expect(await readFile(currentTranslationPath)).toEqual(bytesBefore[0]);
		expect(await readFile(changedTranslationPath)).toEqual(bytesBefore[1]);

		const validation = await validateContent({
			projectRoot,
			upstreamRoot,
			manifestPath,
		});
		expect(validation).toEqual({ ok: true, errors: [] });
	});

	it("rejects record mode when changed translation metadata does not match upstream", async () => {
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
		const upstreamHead = initializeGitRepository(upstreamRoot);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "src/content/docs/changed.md"),
			createTranslation(
				"Changed",
				"docs/changed.md",
				upstreamHead,
				staleHash,
			),
		);
		const manifestPath = await writeManifest(projectRoot, {
			records: [
				{
					sourcePath: "docs/changed.md",
					translationPath: "src/content/docs/changed.md",
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
		).rejects.toThrow(/source hash does not match current upstream/i);
		expect(await readFile(manifestPath, "utf8")).toBe(manifestBefore);
	});

	it("rejects record mode when a verified translation is marked stale", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();
		temporaryDirectories.push(projectRoot, upstreamRoot);

		const currentSource = await readFixture("current.md");
		const currentHash = await computeSourceHash(currentSource);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/current.md"),
			currentSource,
		);
		const upstreamHead = initializeGitRepository(upstreamRoot);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "src/content/docs/current.md"),
			createTranslation(
				"Current",
				"docs/current.md",
				upstreamHead,
				currentHash,
				"stale",
			),
		);
		const manifestPath = await writeManifest(projectRoot, { records: [] });
		const manifestBefore = await readFile(manifestPath, "utf8");

		await expect(
			runSync({
				upstreamRoot,
				projectRoot,
				manifestPath,
				record: true,
			}),
		).rejects.toThrow(/translationStatus must be current/i);
		expect(await readFile(manifestPath, "utf8")).toBe(manifestBefore);
	});

	it("requires upstream HEAD when historical manifest metadata differs", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();
		temporaryDirectories.push(projectRoot, upstreamRoot);

		const currentSource = await readFixture("current.md");
		const currentHash = await computeSourceHash(currentSource);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/current.md"),
			currentSource,
		);
		const upstreamHead = initializeGitRepository(upstreamRoot);
		expect(upstreamHead).not.toBe(SOURCE_COMMIT);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "src/content/docs/current.md"),
			createTranslation(
				"Current",
				"docs/current.md",
				SOURCE_COMMIT,
				currentHash,
			),
		);
		const manifestPath = await writeManifest(projectRoot, {
			records: [
				{
					sourcePath: "docs/current.md",
					translationPath: "src/content/docs/current.md",
					sourceCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					sourceHash: currentHash,
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
		).rejects.toThrow(/must record upstream HEAD/i);
		expect(await readFile(manifestPath, "utf8")).toBe(manifestBefore);
	});

	it("rejects record mode when a translated source is missing", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();
		temporaryDirectories.push(projectRoot, upstreamRoot);

		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/tracked.md"),
			"# Tracked\n",
		);
		const upstreamHead = initializeGitRepository(upstreamRoot);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "src/content/docs/missing.md"),
			createTranslation(
				"Missing",
				"docs/missing.md",
				upstreamHead,
				await computeSourceHash("# Missing\n"),
			),
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

	it("rejects record mode when sourcePath escapes upstream docs", async () => {
		const projectRoot = await createProjectRoot();
		const upstreamRoot = await createUpstreamRoot();
		temporaryDirectories.push(projectRoot, upstreamRoot);

		const outsideSource = "# Outside docs\n";
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "outside.md"),
			outsideSource,
		);
		await writeFileEnsuringDirectory(
			path.join(upstreamRoot, "docs/tracked.md"),
			"# Tracked\n",
		);
		const upstreamHead = initializeGitRepository(upstreamRoot);
		await writeFileEnsuringDirectory(
			path.join(projectRoot, "src/content/docs/outside.md"),
			createTranslation(
				"Outside",
				"docs/../outside.md",
				upstreamHead,
				await computeSourceHash(outsideSource),
			),
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
