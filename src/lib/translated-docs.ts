import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "astro/zod";
import { parse } from "yaml";

const DOC_FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const SOURCE_COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const SOURCE_HASH_PATTERN = /^[0-9a-f]{64}$/;

export const EXPECTED_JSON_EXAMPLES = [
	"aidlc.lock.json",
	"managed-settings.json",
	"marketplace.json",
] as const;

export const translationFrontmatterSchema = z.object({
	title: z.string().min(1),
	description: z.string().min(1),
	sidebarOrder: z.number().int().nonnegative(),
	sourcePath: z.string().startsWith("docs/"),
	sourceCommit: z.string().regex(SOURCE_COMMIT_PATTERN),
	sourceHash: z.string().regex(SOURCE_HASH_PATTERN),
	translationStatus: z.enum(["current", "stale"]),
});

export type TranslationFrontmatter = z.infer<
	typeof translationFrontmatterSchema
>;

export interface ParsedTranslationDoc {
	absolutePath: string;
	relativePath: string;
	raw: string;
	body: string;
	frontmatter?: TranslationFrontmatter;
	frontmatterError?: string;
}

function toPosixPath(filePath: string): string {
	return filePath.split(path.sep).join("/");
}

function formatFrontmatterIssues(
	displayPath: string,
	issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): string {
	const details = issues
		.map((issue) => {
			const field = issue.path.join(".") || "frontmatter";
			return `${field}: ${issue.message}`;
		})
		.join("; ");

	return `invalid frontmatter in ${displayPath}: ${details}`;
}

export function parseTranslationMarkdown(
	markdown: string,
	displayPath: string,
): ParsedTranslationDoc {
	const match = markdown.match(DOC_FRONTMATTER_PATTERN);

	if (!match) {
		return {
			absolutePath: displayPath,
			relativePath: displayPath,
			raw: markdown,
			body: markdown,
			frontmatterError: `invalid frontmatter in ${displayPath}: missing YAML frontmatter block`,
		};
	}

	let parsedFrontmatter: unknown;

	try {
		parsedFrontmatter = parse(match[1]);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			absolutePath: displayPath,
			relativePath: displayPath,
			raw: markdown,
			body: markdown.slice(match[0].length),
			frontmatterError: `invalid frontmatter in ${displayPath}: ${message}`,
		};
	}

	const frontmatterResult = translationFrontmatterSchema.safeParse(
		parsedFrontmatter,
	);

	if (!frontmatterResult.success) {
		return {
			absolutePath: displayPath,
			relativePath: displayPath,
			raw: markdown,
			body: markdown.slice(match[0].length),
			frontmatterError: formatFrontmatterIssues(
				displayPath,
				frontmatterResult.error.issues,
			),
		};
	}

	return {
		absolutePath: displayPath,
		relativePath: displayPath,
		raw: markdown,
		body: markdown.slice(match[0].length),
		frontmatter: frontmatterResult.data,
	};
}

export async function listMarkdownFiles(root: string): Promise<string[]> {
	const directoryEntries = await readdir(root, { withFileTypes: true });
	const markdownFiles: string[] = [];

	for (const directoryEntry of directoryEntries) {
		const absolutePath = path.join(root, directoryEntry.name);

		if (directoryEntry.isDirectory()) {
			markdownFiles.push(...(await listMarkdownFiles(absolutePath)));
			continue;
		}

		if (directoryEntry.isFile() && directoryEntry.name.endsWith(".md")) {
			markdownFiles.push(absolutePath);
		}
	}

	return markdownFiles.sort((left, right) =>
		toPosixPath(left).localeCompare(toPosixPath(right)),
	);
}

export async function collectTranslatedDocs(
	projectRoot: string,
): Promise<ParsedTranslationDoc[]> {
	const docsRoot = path.join(projectRoot, "src/content/docs");
	const absolutePaths = await listMarkdownFiles(docsRoot);
	const parsedDocs: ParsedTranslationDoc[] = [];

	for (const absolutePath of absolutePaths) {
		const raw = await readFile(absolutePath, "utf8");
		const relativePath = toPosixPath(path.relative(projectRoot, absolutePath));
		const parsedDoc = parseTranslationMarkdown(raw, relativePath);

		parsedDocs.push({
			...parsedDoc,
			absolutePath,
			relativePath,
		});
	}

	return parsedDocs.sort((left, right) =>
		left.relativePath.localeCompare(right.relativePath),
	);
}
