import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const SITE_BASE = "/aidlc-workflows-docs";
const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(prefix: string): Promise<string> {
	const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
	temporaryDirectories.push(directory);
	return directory;
}

async function createDistFixture(): Promise<string> {
	const fixtureRoot = await createTemporaryDirectory("check-links-");
	await mkdir(path.join(fixtureRoot, "changelog"), { recursive: true });
	await writeFile(
		path.join(fixtureRoot, "index.html"),
		[
			"<!doctype html>",
			'<section id="architecture"></section>',
			'<section id="workflow"></section>',
			'<section id="agents"></section>',
		].join("\n"),
		"utf8",
	);
	await writeFile(
		path.join(fixtureRoot, "changelog", "index.html"),
		"<!doctype html><h1>変更履歴</h1>",
		"utf8",
	);
	return fixtureRoot;
}

function runLinkChecker(
	distRoot: string,
	arguments_: string[] = [],
): SpawnSyncReturns<string> {
	return spawnSync(
		"bun",
		["scripts/check-links.ts", distRoot, ...arguments_],
		{ cwd: PROJECT_ROOT, encoding: "utf8" },
	);
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) =>
			rm(directory, { recursive: true, force: true }),
		),
	);
});

describe("built output link checker", () => {
	it("fails when a meta refresh points to a missing internal target", async () => {
		const distRoot = await createDistFixture();
		await writeFile(
			path.join(distRoot, "broken.html"),
			`<!doctype html><meta http-equiv="refresh" content="0; url=${SITE_BASE}/missing/">`,
			"utf8",
		);

		const result = runLinkChecker(distRoot);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			`${SITE_BASE}/missing/ (missing internal target`,
		);
	});

	it("accepts all four production legacy redirects", async () => {
		const distRoot = await createDistFixture();
		const redirectFiles = [
			"architecture.html",
			"workflow.html",
			"agents.html",
			"changelog.html",
		] as const;

		await Promise.all(
			redirectFiles.map((filename) =>
				copyFile(
					path.join(PROJECT_ROOT, "public", filename),
					path.join(distRoot, filename),
				),
			),
		);

		const result = runLinkChecker(distRoot);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			"Link check passed for 6 HTML page(s).",
		);
	});

	it("classifies only an exact untranslated upstream route", async () => {
		const distRoot = await createDistFixture();
		const upstreamRoot = await createTemporaryDirectory("check-links-upstream-");
		await mkdir(path.join(upstreamRoot, "docs"), { recursive: true });
		await writeFile(
			path.join(upstreamRoot, "docs", "untranslated.md"),
			"# Untranslated\n",
			"utf8",
		);
		await writeFile(
			path.join(distRoot, "untranslated-link.html"),
			`<!doctype html><a href="${SITE_BASE}/untranslated/#future">Future</a>`,
			"utf8",
		);

		const result = runLinkChecker(distRoot, [
			"--upstream",
			upstreamRoot,
			"--allow-untranslated",
		]);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("expected untranslated failure(s): 1");
		expect(result.stdout).toContain("unexpected failure(s): 0");
	});

	it("still fails translated and unknown missing routes in development mode", async () => {
		const distRoot = await createDistFixture();
		const upstreamRoot = await createTemporaryDirectory("check-links-upstream-");
		await mkdir(path.join(upstreamRoot, "docs"), { recursive: true });
		await writeFile(
			path.join(upstreamRoot, "docs", "README.md"),
			"# Translated root\n",
			"utf8",
		);
		await writeFile(
			path.join(distRoot, "unexpected-links.html"),
			[
				"<!doctype html>",
				`<a href="${SITE_BASE}/docs/">Translated</a>`,
				`<a href="${SITE_BASE}/reference/not-in-upstream/">Unknown</a>`,
			].join("\n"),
			"utf8",
		);

		const result = runLinkChecker(distRoot, [
			"--upstream",
			upstreamRoot,
			"--allow-untranslated",
		]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(`${SITE_BASE}/docs/`);
		expect(result.stderr).toContain(
			`${SITE_BASE}/reference/not-in-upstream/`,
		);
		expect(result.stdout).toContain("expected untranslated failure(s): 0");
		expect(result.stdout).toContain("unexpected failure(s): 2");
	});
});
