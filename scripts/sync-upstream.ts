import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { collectTranslatedDocs } from "../src/lib/translated-docs";
import {
	compareUpstream,
	computeSourceHash,
	formatSyncStatus,
	readTranslationManifest,
	type SyncReport,
	serializeTranslationManifest,
	type TranslationManifest,
	type TranslationRecord,
} from "../src/lib/translation-manifest";

type OutputFormat = "text" | "json";

export interface RunSyncOptions {
	upstreamRoot: string;
	projectRoot?: string;
	manifestPath?: string;
	record?: boolean;
	format?: OutputFormat;
}

export interface RunSyncResult {
	report: SyncReport;
	output: string;
	manifestUpdated: boolean;
}

function toPosixPath(filePath: string): string {
	return filePath.split(path.sep).join("/");
}

function getManifestPath(projectRoot: string, manifestPath?: string): string {
	return manifestPath ?? path.join(projectRoot, "src/data/translation-manifest.json");
}

function runGit(upstreamRoot: string, args: string[]): string {
	return execFileSync("git", args, {
		cwd: upstreamRoot,
		encoding: "utf8",
	}).trim();
}

function ensureUpstreamIsGitRepository(upstreamRoot: string): void {
	runGit(upstreamRoot, ["rev-parse", "--show-toplevel"]);
}

function ensureCleanUpstreamDocsTree(upstreamRoot: string): void {
	const statusOutput = runGit(upstreamRoot, ["status", "--short", "--", "docs"]);

	if (statusOutput.length > 0) {
		throw new Error("Upstream docs tree must be clean before --record.");
	}
}

async function validateRecordableTranslations(
	projectRoot: string,
	upstreamRoot: string,
	manifest: TranslationManifest,
	headCommit: string,
): Promise<TranslationManifest> {
	const docs = await collectTranslatedDocs(projectRoot);
	const manifestByTranslationPath = new Map(
		manifest.records.map((record) => [
			toPosixPath(record.translationPath),
			record,
		]),
	);
	const errors: string[] = [];
	const records: TranslationRecord[] = [];

	for (const doc of docs) {
		if (doc.frontmatterError) {
			errors.push(doc.frontmatterError);
			continue;
		}

		const frontmatter = doc.frontmatter;
		if (!frontmatter) {
			continue;
		}

		if (frontmatter.translationStatus !== "current") {
			errors.push(
				`TranslationStatus must be current for --record: ${doc.relativePath} declares ${frontmatter.translationStatus}`,
			);
			continue;
		}

		const sourceAbsolutePath = path.resolve(upstreamRoot, frontmatter.sourcePath);
		const upstreamDocsRoot = path.resolve(upstreamRoot, "docs");
		const relativeToDocs = path.relative(upstreamDocsRoot, sourceAbsolutePath);
		if (
			relativeToDocs.startsWith("..") ||
			path.isAbsolute(relativeToDocs) ||
			!existsSync(sourceAbsolutePath)
		) {
			errors.push(
				`Missing upstream source for translated file: ${frontmatter.sourcePath} (${doc.relativePath})`,
			);
			continue;
		}

		const currentHash = await computeSourceHash(
			await readFile(sourceAbsolutePath, "utf8"),
		);
		if (frontmatter.sourceHash !== currentHash) {
			errors.push(
				`Source hash does not match current upstream for ${doc.relativePath}: ${frontmatter.sourcePath} expected ${currentHash}, found ${frontmatter.sourceHash}`,
			);
			continue;
		}

		const previousRecord = manifestByTranslationPath.get(doc.relativePath);
		const matchesPreviousRecord =
			previousRecord?.sourcePath === frontmatter.sourcePath &&
			previousRecord.sourceCommit === frontmatter.sourceCommit &&
			previousRecord.sourceHash === frontmatter.sourceHash;
		if (
			!matchesPreviousRecord &&
			frontmatter.sourceCommit !== headCommit
		) {
			errors.push(
				`Reviewed translation must record upstream HEAD ${headCommit} in ${doc.relativePath}; found ${frontmatter.sourceCommit}`,
			);
		}

		records.push({
			sourcePath: frontmatter.sourcePath,
			translationPath: doc.relativePath,
			sourceCommit: frontmatter.sourceCommit,
			sourceHash: frontmatter.sourceHash,
		});
	}

	if (errors.length > 0) {
		throw new Error(errors.join("\n"));
	}

	return { records };
}

async function writeManifestAtomically(
	manifestPath: string,
	manifest: TranslationManifest,
): Promise<void> {
	const temporaryPath = `${manifestPath}.${process.pid}.${crypto.randomUUID()}.tmp`;

	try {
		await writeFile(temporaryPath, serializeTranslationManifest(manifest), "utf8");
		await rename(temporaryPath, manifestPath);
	} finally {
		await rm(temporaryPath, { force: true });
	}
}

function formatTextReport(report: SyncReport): string {
	const lines = [
		`Upstream: ${report.upstreamRoot}`,
		`Summary: added=${report.summary.added}, changed=${report.summary.changed}, deleted=${report.summary.deleted}, untranslated=${report.summary.untranslated}, current=${report.summary.current}`,
		"",
	];

	for (const entry of report.entries) {
		lines.push(`${formatSyncStatus(entry.status)} ${entry.sourcePath}`);
	}

	return `${lines.join("\n")}\n`;
}

export async function runSync(
	options: RunSyncOptions,
): Promise<RunSyncResult> {
	const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
	const upstreamRoot = path.resolve(options.upstreamRoot);
	const manifestPath = getManifestPath(projectRoot, options.manifestPath);
	const format = options.format ?? "text";
	const manifest = await readTranslationManifest(manifestPath);
	let recordedManifest: TranslationManifest | undefined;

	if (options.record) {
		ensureUpstreamIsGitRepository(upstreamRoot);
		ensureCleanUpstreamDocsTree(upstreamRoot);
		const headCommit = runGit(upstreamRoot, ["rev-parse", "HEAD"]);
		recordedManifest = await validateRecordableTranslations(
			projectRoot,
			upstreamRoot,
			manifest,
			headCommit,
		);
	}

	const report = await compareUpstream(upstreamRoot, manifest, { projectRoot });
	let manifestUpdated = false;

	if (recordedManifest) {
		await writeManifestAtomically(manifestPath, recordedManifest);
		manifestUpdated = true;
	}

	return {
		report,
		output:
			format === "json"
				? `${JSON.stringify(report, null, "\t")}\n`
				: formatTextReport(report),
		manifestUpdated,
	};
}

function parseCliArgs(argv: string[]): RunSyncOptions {
	const options: RunSyncOptions = {
		upstreamRoot: "",
		format: "text",
		record: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];

		switch (argument) {
			case "--upstream": {
				const upstreamRoot = argv[index + 1];
				if (!upstreamRoot) {
					throw new Error("Missing value for --upstream.");
				}
				options.upstreamRoot = upstreamRoot;
				index += 1;
				break;
			}
			case "--format": {
				const format = argv[index + 1];
				if (format !== "text" && format !== "json") {
					throw new Error(`Invalid --format value: ${format ?? ""}`);
				}
				options.format = format;
				index += 1;
				break;
			}
			case "--record":
				options.record = true;
				break;
			default:
				throw new Error(`Unknown argument: ${argument}`);
		}
	}

	if (!options.upstreamRoot) {
		throw new Error("Missing required --upstream path.");
	}

	return options;
}

if (import.meta.main) {
	try {
		const result = await runSync(parseCliArgs(process.argv.slice(2)));
		process.stdout.write(result.output);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`${message}\n`);
		process.exit(1);
	}
}
