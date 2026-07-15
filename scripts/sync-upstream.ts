import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { sourcePathForTranslation } from "../lib/routes";
import { collectTranslatedDocs } from "../lib/translated-docs";
import {
	compareUpstream,
	computeSourceHash,
	formatSyncStatus,
	MANIFEST_RELATIVE_PATH,
	normalizeLineEndings,
	readTranslationManifest,
	type SyncDiffStat,
	type SyncReport,
	serializeTranslationManifest,
	type TranslationManifest,
	type TranslationRecord,
} from "../lib/translation-manifest";

/** 差分パッチモードを推奨する churn 率の上限(これ以上は全文再翻訳を推奨) */
const RETRANSLATE_CHURN_THRESHOLD = 0.5;

type OutputFormat = "text" | "json";

export interface RunSyncOptions {
	upstreamRoot: string;
	projectRoot?: string;
	manifestPath?: string;
	record?: boolean;
	/**
	 * 上流 HEAD で再記録(re-bless)する翻訳パス(例: `docs/guide/01-getting-started.mdx`)。
	 * パスを明示しない `--record` は新規翻訳のレコード追加のみを行い、既存レコードが
	 * 上流と一致しない場合は失敗する — 更新された原文が黙って「翻訳済み」に
	 * ならないようにするためのガード。
	 */
	recordPaths?: string[];
	format?: OutputFormat;
}

export interface RunSyncResult {
	report: SyncReport;
	output: string;
	manifestUpdated: boolean;
}

function getManifestPath(projectRoot: string, manifestPath?: string): string {
	return manifestPath ?? path.join(projectRoot, MANIFEST_RELATIVE_PATH);
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

function countLines(content: string): number {
	const normalized = normalizeLineEndings(content);
	const lineCount = normalized.split("\n").length;
	return normalized.endsWith("\n") ? lineCount - 1 : lineCount;
}

/**
 * 記録済み sourceCommit と現在の原文(作業ツリー)の diff から変更規模を算出する。
 * 上流が git リポジトリでない・sourceCommit が clone に存在しない等の場合は
 * undefined を返し、同期レポート自体は成立させる。
 */
async function computeDiffStat(
	upstreamRoot: string,
	sourceCommit: string,
	sourcePath: string,
): Promise<SyncDiffStat | undefined> {
	try {
		const numstatOutput = runGit(upstreamRoot, [
			"diff",
			sourceCommit,
			"--numstat",
			"--",
			sourcePath,
		]);
		const numstatMatch = numstatOutput.match(/^(\d+)\t(\d+)\t/);
		const addedLines = numstatMatch ? Number(numstatMatch[1]) : 0;
		const deletedLines = numstatMatch ? Number(numstatMatch[2]) : 0;
		const sourceLines = countLines(
			await readFile(path.resolve(upstreamRoot, sourcePath), "utf8"),
		);
		const churnRatio = (addedLines + deletedLines) / Math.max(sourceLines, 1);

		return {
			addedLines,
			deletedLines,
			sourceLines,
			churnRatio,
			recommendedMode:
				churnRatio < RETRANSLATE_CHURN_THRESHOLD ? "patch" : "retranslate",
		};
	} catch {
		return undefined;
	}
}

async function buildRecordedManifest(
	projectRoot: string,
	upstreamRoot: string,
	manifest: TranslationManifest,
	headCommit: string,
	recordPaths: string[],
): Promise<TranslationManifest> {
	const docs = await collectTranslatedDocs(projectRoot);
	const requestedPaths = new Set(recordPaths);
	const manifestByTranslationPath = new Map(
		manifest.records.map((record) => [record.translationPath, record]),
	);
	const knownTranslationPaths = new Set(docs.map((doc) => doc.relativePath));
	const errors: string[] = [];
	const records: TranslationRecord[] = [];

	for (const requestedPath of requestedPaths) {
		if (!knownTranslationPaths.has(requestedPath)) {
			errors.push(`no such translation file: ${requestedPath}`);
		}
	}

	for (const doc of docs) {
		if (doc.frontmatterError) {
			errors.push(doc.frontmatterError);
			continue;
		}

		const existingRecord = manifestByTranslationPath.get(doc.relativePath);
		// sourcePath の真実源はマニフェスト(上流ファイル名は翻訳と常にミラーとは
		// 限らない)。構造ミラーによる導出は新規レコードの初期値にのみ使う。
		const sourcePath =
			existingRecord?.sourcePath ?? sourcePathForTranslation(doc.relativePath);
		const sourceAbsolutePath = path.resolve(upstreamRoot, sourcePath);
		const upstreamDocsRoot = path.resolve(upstreamRoot, "docs");
		const relativeToDocs = path.relative(upstreamDocsRoot, sourceAbsolutePath);
		if (
			relativeToDocs.startsWith("..") ||
			path.isAbsolute(relativeToDocs) ||
			!existsSync(sourceAbsolutePath)
		) {
			errors.push(
				`missing upstream source for translated file: ${sourcePath} (${doc.relativePath})`,
			);
			continue;
		}

		const currentHash = await computeSourceHash(
			await readFile(sourceAbsolutePath, "utf8"),
		);

		if (existingRecord && existingRecord.sourceHash === currentHash) {
			records.push(existingRecord);
			continue;
		}

		if (!existingRecord || requestedPaths.has(doc.relativePath)) {
			records.push({
				...existingRecord,
				sourcePath,
				translationPath: doc.relativePath,
				sourceCommit: headCommit,
				sourceHash: currentHash,
			});
			continue;
		}

		errors.push(
			`stale record for ${doc.relativePath}: upstream ${sourcePath} changed since it was recorded. Update the translation, then run --record ${doc.relativePath}`,
		);
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
		await writeFile(
			temporaryPath,
			serializeTranslationManifest(manifest),
			"utf8",
		);
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
		const diffStatSuffix = entry.diffStat
			? ` (churn ${Math.round(entry.diffStat.churnRatio * 100)}%, mode=${entry.diffStat.recommendedMode})`
			: "";
		lines.push(
			`${formatSyncStatus(entry.status)} ${entry.sourcePath}${diffStatSuffix}`,
		);
	}

	return `${lines.join("\n")}\n`;
}

/** changed エントリに変更規模(diffStat)を付与する。算出できないものはそのまま。 */
async function attachDiffStats(
	report: SyncReport,
	upstreamRoot: string,
): Promise<void> {
	for (const entry of report.entries) {
		if (entry.status !== "changed" || !entry.sourceCommit) {
			continue;
		}
		entry.diffStat = await computeDiffStat(
			upstreamRoot,
			entry.sourceCommit,
			entry.sourcePath,
		);
	}
}

export async function runSync(options: RunSyncOptions): Promise<RunSyncResult> {
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
		recordedManifest = await buildRecordedManifest(
			projectRoot,
			upstreamRoot,
			manifest,
			headCommit,
			options.recordPaths ?? [],
		);
	}

	const report = await compareUpstream(
		upstreamRoot,
		recordedManifest ?? manifest,
		{ projectRoot },
	);
	await attachDiffStats(report, upstreamRoot);
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
		recordPaths: [],
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
				if (argument.startsWith("--")) {
					throw new Error(`Unknown argument: ${argument}`);
				}
				options.recordPaths?.push(argument.split(path.sep).join("/"));
		}
	}

	if (!options.upstreamRoot) {
		throw new Error("Missing required --upstream path.");
	}

	if (!options.record && (options.recordPaths?.length ?? 0) > 0) {
		throw new Error("Translation paths are only valid with --record.");
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
