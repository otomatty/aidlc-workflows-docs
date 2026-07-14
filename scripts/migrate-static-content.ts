import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_INPUT = path.resolve(process.cwd(), "changelog.html");
const DEFAULT_OUTPUT = path.resolve(
	process.cwd(),
	"src/content/site/changelog.md",
);

interface ParsedEntry {
	version: string;
	date: string;
	tags: string[];
	paragraphs: string[];
	listItems: string[];
}

function decodeHtmlEntities(value: string): string {
	return value
		.replaceAll("&amp;", "&")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'");
}

function convertInlineHtmlToMarkdown(value: string): string {
	const codeTokens: string[] = [];
	const withProtectedCode = value.replaceAll(
		/<code>([\s\S]*?)<\/code>/g,
		(_match, code: string) => {
			const token = `@@CODE${codeTokens.length}@@`;
			codeTokens.push(`\`${decodeHtmlEntities(code.trim())}\``);
			return token;
		},
	);

	const stripped = decodeHtmlEntities(
		withProtectedCode
			.replaceAll(
				/<strong>([\s\S]*?)<\/strong>/g,
				(_match, text: string) => `**${decodeHtmlEntities(text.trim())}**`,
			)
			.replaceAll(
				/<em>([\s\S]*?)<\/em>/g,
				(_match, text: string) => `*${decodeHtmlEntities(text.trim())}*`,
			)
			.replaceAll(
				/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
				(_match, href: string, text: string) =>
					`[${decodeHtmlEntities(text.trim())}](${href})`,
			)
			.replaceAll(/<br\s*\/?>/g, "\n")
			.replaceAll(/<\/?(?:span|div|ul|li)>/g, "")
			.replaceAll(/<[^>]+>/g, "")
			.replaceAll(/\r\n/g, "\n"),
	);

	return codeTokens
		.reduce(
			(result, tokenValue, index) =>
				result.replaceAll(`@@CODE${index}@@`, tokenValue),
			stripped,
		)
		.split("\n")
		.map((line) => line.trim())
		.join("\n")
		.replaceAll(/\n{3,}/g, "\n\n")
		.trim();
}

function extractAll(pattern: RegExp, source: string): string[] {
	return [...source.matchAll(pattern)]
		.map((match) => match[1])
		.map((value) => convertInlineHtmlToMarkdown(value))
		.filter((value) => value.length > 0);
}

function parseEntry(entryHtml: string): ParsedEntry {
	const versionMatch = entryHtml.match(
		/<span class="cl-version">([\s\S]*?)<\/span>/,
	);
	const dateMatch = entryHtml.match(/<span class="cl-date">([\s\S]*?)<\/span>/);

	if (!versionMatch || !dateMatch) {
		throw new Error("Failed to parse changelog entry heading metadata.");
	}

	return {
		version: convertInlineHtmlToMarkdown(versionMatch[1]),
		date: convertInlineHtmlToMarkdown(dateMatch[1]),
		tags: extractAll(/<span class="cl-tag [^"]+">([\s\S]*?)<\/span>/g, entryHtml),
		paragraphs: extractAll(/<p>([\s\S]*?)<\/p>/g, entryHtml),
		listItems: extractAll(/<li>([\s\S]*?)<\/li>/g, entryHtml),
	};
}

function parseEntries(html: string): ParsedEntry[] {
	return html
		.split(/(?=<div class="cl-entry\b)/g)
		.map((section) => section.split("<footer>")[0]?.trim() ?? "")
		.filter((section) => section.startsWith('<div class="cl-entry'))
		.map(parseEntry);
}

function entryHeading(entry: ParsedEntry): string {
	if (entry.version === "日次差分") {
		return `## ${entry.version}（${entry.date}）`;
	}

	return `## ${entry.version}`;
}

function formatEntry(entry: ParsedEntry): string {
	const lines = [
		entryHeading(entry),
		`- 日付: ${entry.date}`,
		`- 種別: ${entry.tags.length > 0 ? entry.tags.join("、") : "記録"}`,
	];

	for (const paragraph of entry.paragraphs) {
		lines.push("", paragraph);
	}

	if (entry.listItems.length > 0) {
		lines.push("");
		for (const item of entry.listItems) {
			lines.push(`- ${item}`);
		}
	}

	return lines.join("\n");
}

function buildMarkdown(entries: ParsedEntry[]): string {
	const frontmatter = [
		"---",
		"title: 変更履歴",
		"description: 旧ウォッチサイトから移行した 2.x 系の日本語変更履歴アーカイブです。",
		"sidebarOrder: 0",
		"---",
	];

	const intro = [
		"# 変更履歴",
		"",
		"このページは、旧 5 ページ構成の日本語ウォッチサイトに掲載していた `changelog.html` を Markdown へ移行した履歴アーカイブです。",
		"現在の Astro サイト本体は `awslabs/aidlc-workflows` の翻訳ドキュメントを表示し、この履歴は旧 v2 系サイトの要約記録を保存します。",
	];

	return [...frontmatter, "", ...intro, "", ...entries.map(formatEntry), ""].join(
		"\n",
	);
}

async function main(): Promise<void> {
	const inputPath = path.resolve(process.argv[2] ?? DEFAULT_INPUT);
	const outputPath = path.resolve(process.argv[3] ?? DEFAULT_OUTPUT);
	const html = await readFile(inputPath, "utf8");
	const entries = parseEntries(html);

	if (entries.length === 0) {
		throw new Error("No changelog entries were parsed from the legacy HTML.");
	}

	await writeFile(outputPath, buildMarkdown(entries), "utf8");
	process.stdout.write(
		`Migrated ${entries.length} changelog entries to ${outputPath}\n`,
	);
}

if (import.meta.main) {
	await main();
}
