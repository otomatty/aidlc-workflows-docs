import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";
import { z } from "zod";

const DOC_FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export const CONTENT_ROOT = "docs";

// Content under docs/ that is not a translation of an upstream docs/ file.
export const NON_TRANSLATION_PATHS = new Set([
	"docs/changelog.mdx",
	"docs/watch-prompt.mdx",
	"docs/guide/18-archiving-audit-logs.mdx",
]);
const EXCLUDED_DIRECTORIES = new Set(["superpowers"]);

export const EXPECTED_JSON_EXAMPLES = [
	"aidlc.lock.json",
	"managed-settings.json",
	"marketplace.json",
] as const;

// Blume validates the full frontmatter schema at build; here we only require
// the fields the translation workflow depends on.
export const translationFrontmatterSchema = z.object({
	title: z.string().min(1),
	description: z.string().min(1),
	slug: z.string().optional(),
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

	const frontmatterResult =
		translationFrontmatterSchema.safeParse(parsedFrontmatter);

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

export async function listMarkdownFiles(
	root: string,
	extension = ".md",
): Promise<string[]> {
	const directoryEntries = await readdir(root, { withFileTypes: true });
	const markdownFiles: string[] = [];

	for (const directoryEntry of directoryEntries) {
		const absolutePath = path.join(root, directoryEntry.name);

		if (directoryEntry.isDirectory()) {
			markdownFiles.push(...(await listMarkdownFiles(absolutePath, extension)));
			continue;
		}

		if (directoryEntry.isFile() && directoryEntry.name.endsWith(extension)) {
			markdownFiles.push(absolutePath);
		}
	}

	return markdownFiles.sort((left, right) =>
		toPosixPath(left).localeCompare(toPosixPath(right)),
	);
}

export function isTranslationPath(relativePath: string): boolean {
	if (NON_TRANSLATION_PATHS.has(relativePath)) {
		return false;
	}
	const [, firstSegment] = relativePath.split("/");
	return firstSegment === undefined || !EXCLUDED_DIRECTORIES.has(firstSegment);
}

export async function collectTranslatedDocs(
	projectRoot: string,
): Promise<ParsedTranslationDoc[]> {
	const docsRoot = path.join(projectRoot, CONTENT_ROOT);
	const absolutePaths = await listMarkdownFiles(docsRoot, ".mdx");
	const parsedDocs: ParsedTranslationDoc[] = [];

	for (const absolutePath of absolutePaths) {
		const relativePath = toPosixPath(path.relative(projectRoot, absolutePath));

		if (!isTranslationPath(relativePath)) {
			continue;
		}

		const raw = await readFile(absolutePath, "utf8");
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
