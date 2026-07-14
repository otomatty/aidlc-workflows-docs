import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { SITE_BASE } from "../src/data/site";
import {
	contentIdToRoute,
	sourcePathToContentId,
	withBase,
} from "../src/lib/routes";
import { listMarkdownFiles } from "../src/lib/translated-docs";
import { readTranslationManifest } from "../src/lib/translation-manifest";

interface HtmlPage {
	absolutePath: string;
	publicPath: string;
	html: string;
	ids: Set<string>;
}

interface LinkFailure {
	sourcePath: string;
	href: string;
	reason: string;
	targetPagePath: string;
	type: "missing-fragment" | "missing-target";
}

interface CliOptions {
	allowUntranslated: boolean;
	distPath: string;
	upstreamPath?: string;
}

const HTML_EXTENSION = ".html";
const ROOT_URL = "https://example.test";

function toPosixPath(filePath: string): string {
	return filePath.split(path.sep).join("/");
}

async function collectFiles(targetDirectory: string): Promise<string[]> {
	const entries = await readdir(targetDirectory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const absolutePath = path.join(targetDirectory, entry.name);
			if (entry.isDirectory()) {
				return collectFiles(absolutePath);
			}

			return [absolutePath];
		}),
	);

	return files.flat();
}

function publicPathForHtml(distRoot: string, absolutePath: string): string {
	const relativePath = toPosixPath(path.relative(distRoot, absolutePath));

	if (relativePath === "index.html") {
		return `${SITE_BASE}/`;
	}

	if (relativePath.endsWith("/index.html")) {
		return `${SITE_BASE}/${relativePath.slice(0, -"index.html".length)}`;
	}

	return `${SITE_BASE}/${relativePath}`;
}

function extractIds(html: string): Set<string> {
	return new Set(
		[...html.matchAll(/\sid="([^"]+)"/g)]
			.map((match) => match[1])
			.filter((value) => value.length > 0),
	);
}

async function readHtmlPages(distRoot: string): Promise<Map<string, HtmlPage>> {
	const files = await collectFiles(distRoot);
	const htmlFiles = files.filter((file) => file.endsWith(HTML_EXTENSION));
	const pages = await Promise.all(
		htmlFiles.map(async (absolutePath) => {
			const html = await readFile(absolutePath, "utf8");
			const publicPath = publicPathForHtml(distRoot, absolutePath);

			return [
				publicPath,
				{
					absolutePath,
					publicPath,
					html,
					ids: extractIds(html),
				},
			] as const;
		}),
	);

	return new Map(pages);
}

function extractCandidateLinks(html: string): string[] {
	const hrefsAndSources = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)]
		.map((match) => match[1])
		.filter((value) => value.length > 0);
	const refreshTargets = [...html.matchAll(/<meta\b[^>]*>/gi)]
		.map((match) => match[0])
		.map((tag) => {
			const attributes = new Map(
				[...tag.matchAll(/([A-Za-z][\w:-]*)\s*=\s*(["'])(.*?)\2/g)].map(
					(match) => [match[1].toLowerCase(), match[3]],
				),
			);
			if (attributes.get("http-equiv")?.toLowerCase() !== "refresh") {
				return undefined;
			}

			const content = attributes.get("content");
			const target = content?.match(
				/^\s*\d+(?:\.\d+)?\s*;\s*url\s*=\s*(?:"([^"]*)"|'([^']*)'|(.+))\s*$/i,
			);
			return target?.slice(1).find((value) => value !== undefined)?.trim();
		})
		.filter((value): value is string => Boolean(value));

	return [...hrefsAndSources, ...refreshTargets];
}

function shouldIgnoreLink(href: string): boolean {
	return (
		href.startsWith("http://") ||
		href.startsWith("https://") ||
		href.startsWith("mailto:") ||
		href.startsWith("tel:") ||
		href.startsWith("javascript:") ||
		href.startsWith("data:")
	);
}

function resolveSiteUrl(currentPublicPath: string, href: string): URL | undefined {
	if (shouldIgnoreLink(href)) {
		return undefined;
	}

	if (href.startsWith("#")) {
		return new URL(`${currentPublicPath}${href}`, ROOT_URL);
	}

	return new URL(href, new URL(currentPublicPath, ROOT_URL));
}

function absoluteFileForAsset(distRoot: string, pathname: string): string {
	const relativePath = pathname.slice(SITE_BASE.length).replace(/^\/+/, "");
	return path.resolve(distRoot, relativePath);
}

function normalizedPagePath(pathname: string): string {
	if (pathname === SITE_BASE || pathname === `${SITE_BASE}/`) {
		return `${SITE_BASE}/`;
	}

	if (pathname.endsWith("/")) {
		return pathname;
	}

	if (pathname.endsWith(HTML_EXTENSION)) {
		return pathname;
	}

	return `${pathname}/`;
}

function fileExistsForInternalAsset(distRoot: string, pathname: string): boolean {
	return existsSync(absoluteFileForAsset(distRoot, pathname));
}

function validatePageLinks(
	distRoot: string,
	pagesByPath: Map<string, HtmlPage>,
): LinkFailure[] {
	const failures: LinkFailure[] = [];

	for (const page of pagesByPath.values()) {
		for (const href of extractCandidateLinks(page.html)) {
			const resolvedUrl = resolveSiteUrl(page.publicPath, href);
			if (!resolvedUrl) {
				continue;
			}

			const { pathname, hash } = resolvedUrl;
			if (!pathname.startsWith(SITE_BASE)) {
				continue;
			}

			const normalizedPath = normalizedPagePath(pathname);
			const targetPage = pagesByPath.get(normalizedPath);

			if (targetPage) {
				const fragmentId =
					hash.length > 1 ? decodeURIComponent(hash.slice(1)) : "";
				if (fragmentId.length > 0 && !targetPage.ids.has(fragmentId)) {
					failures.push({
						sourcePath: page.publicPath,
						href,
						reason: `missing fragment ${hash} in ${normalizedPath}`,
						targetPagePath: normalizedPath,
						type: "missing-fragment",
					});
				}
				continue;
			}

			if (!fileExistsForInternalAsset(distRoot, pathname)) {
				failures.push({
					sourcePath: page.publicPath,
					href,
					reason: `missing internal target ${pathname}`,
					targetPagePath: normalizedPath,
					type: "missing-target",
				});
			}
		}
	}

	return failures;
}

function parseArguments(arguments_: string[]): CliOptions {
	const [distPath, ...options] = arguments_;
	if (!distPath) {
		throw new Error(
			"Usage: bun scripts/check-links.ts <dist-path> [--upstream <path> --allow-untranslated]",
		);
	}

	let allowUntranslated = false;
	let upstreamPath: string | undefined;

	for (let index = 0; index < options.length; index += 1) {
		const option = options[index];
		switch (option) {
			case "--allow-untranslated":
				allowUntranslated = true;
				break;
			case "--upstream": {
				const value = options[index + 1];
				if (!value || value.startsWith("--")) {
					throw new Error("--upstream requires a path.");
				}
				upstreamPath = value;
				index += 1;
				break;
			}
			default:
				throw new Error(`Unknown argument: ${option}`);
		}
	}

	if (allowUntranslated !== Boolean(upstreamPath)) {
		throw new Error(
			"--allow-untranslated and --upstream <path> must be provided together.",
		);
	}

	return {
		allowUntranslated,
		distPath,
		upstreamPath,
	};
}

async function collectUntranslatedRoutes(
	upstreamRoot: string,
): Promise<Set<string>> {
	const manifest = await readTranslationManifest(
		path.resolve(process.cwd(), "src/data/translation-manifest.json"),
	);
	const translatedSourcePaths = new Set(
		manifest.records.map((record) => record.sourcePath),
	);
	const upstreamDocsRoot = path.join(upstreamRoot, "docs");
	const upstreamMarkdownFiles = await listMarkdownFiles(upstreamDocsRoot);
	const untranslatedRoutes = new Set<string>();

	for (const absolutePath of upstreamMarkdownFiles) {
		const sourcePath = toPosixPath(path.relative(upstreamRoot, absolutePath));
		if (translatedSourcePaths.has(sourcePath)) {
			continue;
		}

		untranslatedRoutes.add(
			withBase(contentIdToRoute(sourcePathToContentId(sourcePath))),
		);
	}

	return untranslatedRoutes;
}

async function main(): Promise<void> {
	const options = parseArguments(process.argv.slice(2));
	const distRoot = path.resolve(process.cwd(), options.distPath);
	const pagesByPath = await readHtmlPages(distRoot);
	const failures = validatePageLinks(distRoot, pagesByPath);
	const untranslatedRoutes =
		options.allowUntranslated && options.upstreamPath
			? await collectUntranslatedRoutes(path.resolve(options.upstreamPath))
			: new Set<string>();
	const expectedFailures = failures.filter(
		(failure) =>
			options.allowUntranslated &&
			(failure.type === "missing-target" ||
				failure.type === "missing-fragment") &&
			untranslatedRoutes.has(failure.targetPagePath),
	);
	const unexpectedFailures = failures.filter(
		(failure) => !expectedFailures.includes(failure),
	);

	if (options.allowUntranslated) {
		process.stdout.write(
			`Allowed expected untranslated failure(s): ${expectedFailures.length}; unexpected failure(s): ${unexpectedFailures.length}.\n`,
		);
	}

	if (unexpectedFailures.length > 0) {
		for (const failure of unexpectedFailures) {
			process.stderr.write(
				`${failure.sourcePath}: ${failure.href} (${failure.reason})\n`,
			);
		}
		process.exit(1);
	}

	process.stdout.write(
		`Link check passed for ${pagesByPath.size} HTML page(s).\n`,
	);
}

if (import.meta.main) {
	await main();
}
