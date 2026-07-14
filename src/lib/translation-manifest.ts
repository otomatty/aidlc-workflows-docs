import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "astro/zod";

import { assertNever } from "./assert-never";
import { listMarkdownFiles } from "./translated-docs";

const translationRecordSchema = z.object({
	sourcePath: z.string().startsWith("docs/"),
	translationPath: z.string().min(1),
	sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
	sourceHash: z.string().regex(/^[0-9a-f]{64}$/),
});

const translationManifestSchema = z.object({
	records: z.array(translationRecordSchema),
});

export const SYNC_STATUSES = [
	"added",
	"changed",
	"deleted",
	"untranslated",
	"current",
] as const;

export type SyncStatus = (typeof SYNC_STATUSES)[number];

export type TranslationRecord = z.infer<typeof translationRecordSchema>;
export type TranslationManifest = z.infer<typeof translationManifestSchema>;

export interface SyncEntry {
	sourcePath: string;
	status: SyncStatus;
	translationPath?: string;
	recordedHash?: string;
	currentHash?: string;
	sourceCommit?: string;
}

export interface SyncReport {
	upstreamRoot: string;
	entries: SyncEntry[];
	summary: Record<SyncStatus, number>;
}

function toPosixPath(filePath: string): string {
	return filePath.split(path.sep).join("/");
}

function createEmptySummary(): Record<SyncStatus, number> {
	return {
		added: 0,
		changed: 0,
		deleted: 0,
		untranslated: 0,
		current: 0,
	};
}

function createEntry(
	sourcePath: string,
	status: SyncStatus,
	record?: TranslationRecord,
	currentHash?: string,
): SyncEntry {
	return {
		sourcePath,
		status,
		translationPath: record?.translationPath,
		recordedHash: record?.sourceHash,
		currentHash,
		sourceCommit: record?.sourceCommit,
	};
}

export function normalizeLineEndings(content: string): string {
	return content.replace(/\r\n/g, "\n");
}

export async function computeSourceHash(content: string): Promise<string> {
	const normalized = normalizeLineEndings(content);
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(normalized),
	);

	return Array.from(new Uint8Array(digest), (value) =>
		value.toString(16).padStart(2, "0"),
	).join("");
}

export function sortTranslationRecords(
	records: TranslationRecord[],
): TranslationRecord[] {
	return [...records].sort((left, right) =>
		left.sourcePath.localeCompare(right.sourcePath),
	);
}

export function serializeTranslationManifest(
	manifest: TranslationManifest,
): string {
	return `${JSON.stringify(
		{ records: sortTranslationRecords(manifest.records) },
		null,
		"\t",
	)}\n`;
}

export async function readTranslationManifest(
	manifestPath: string,
): Promise<TranslationManifest> {
	const raw = await readFile(manifestPath, "utf8");
	const parsed = JSON.parse(raw) as unknown;
	return translationManifestSchema.parse(parsed);
}

export function formatSyncStatus(status: SyncStatus): string {
	const labels: Record<SyncStatus, string> = {
		added: "added",
		changed: "changed",
		deleted: "deleted",
		untranslated: "untranslated",
		current: "current",
	};

	switch (status) {
		case "added":
		case "changed":
		case "deleted":
		case "untranslated":
		case "current":
			return labels[status];
		default:
			return assertNever(status);
	}
}

export async function compareUpstream(
	upstreamRoot: string,
	manifest: TranslationManifest,
	options: { projectRoot?: string } = {},
): Promise<SyncReport> {
	const projectRoot = options.projectRoot ?? process.cwd();
	const upstreamDocsRoot = path.join(upstreamRoot, "docs");
	const manifestBySourcePath = new Map(
		manifest.records.map((record) => [record.sourcePath, record]),
	);
	const entries: SyncEntry[] = [];
	const summary = createEmptySummary();
	const seenSourcePaths = new Set<string>();
	const upstreamMarkdownFiles = await listMarkdownFiles(upstreamDocsRoot);

	for (const absolutePath of upstreamMarkdownFiles) {
		const sourcePath = toPosixPath(path.relative(upstreamRoot, absolutePath));
		const record = manifestBySourcePath.get(sourcePath);
		const currentHash = await computeSourceHash(
			await readFile(absolutePath, "utf8"),
		);
		seenSourcePaths.add(sourcePath);

		if (!record) {
			summary.untranslated += 1;
			entries.push(createEntry(sourcePath, "untranslated", undefined, currentHash));
			continue;
		}

		const translationAbsolutePath = path.join(projectRoot, record.translationPath);
		const translationExists = existsSync(translationAbsolutePath);

		if (!translationExists) {
			summary.added += 1;
			entries.push(createEntry(sourcePath, "added", record, currentHash));
			continue;
		}

		if (record.sourceHash !== currentHash) {
			summary.changed += 1;
			entries.push(createEntry(sourcePath, "changed", record, currentHash));
			continue;
		}

		summary.current += 1;
		entries.push(createEntry(sourcePath, "current", record, currentHash));
	}

	for (const record of sortTranslationRecords(manifest.records)) {
		if (seenSourcePaths.has(record.sourcePath)) {
			continue;
		}

		summary.deleted += 1;
		entries.push(createEntry(record.sourcePath, "deleted", record));
	}

	return {
		upstreamRoot,
		entries: entries.sort((left, right) =>
			left.sourcePath.localeCompare(right.sourcePath),
		),
		summary,
	};
}
