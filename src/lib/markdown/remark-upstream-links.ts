import path from "node:path";

import type { Link, Root } from "mdast";
import type { Plugin, Transformer } from "unified";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

import { contentIdToRoute, sourcePathToContentId, withBase } from "../routes";

const HASH_PREFIX = "#";
const MAILTO_PREFIX = "mailto:";
const HTTP_PREFIX = "http:";
const HTTPS_PREFIX = "https:";
const MARKDOWN_EXTENSION = ".md";
const UPSTREAM_BLOB_BASE = "https://github.com/awslabs/aidlc-workflows/blob";

export interface RemarkUpstreamLinksOptions {
	sourcePath: string;
	sourceCommit: string;
}

interface SourceFrontmatter {
	sourcePath?: string;
	sourceCommit?: string;
}

function isUntouchedHref(href: string): boolean {
	return (
		href.startsWith(HASH_PREFIX) ||
		href.startsWith(MAILTO_PREFIX) ||
		href.startsWith(HTTP_PREFIX) ||
		href.startsWith(HTTPS_PREFIX)
	);
}

function splitHash(href: string): { pathname: string; hash: string } {
	const hashIndex = href.indexOf(HASH_PREFIX);

	if (hashIndex === -1) {
		return { pathname: href, hash: "" };
	}

	return {
		pathname: href.slice(0, hashIndex),
		hash: href.slice(hashIndex),
	};
}

function resolveSourcePath(sourcePath: string, hrefPathname: string): string {
	return path.posix.normalize(
		path.posix.join(path.posix.dirname(sourcePath), hrefPathname),
	);
}

function isDocsMarkdownPath(resolvedPath: string): boolean {
	return (
		resolvedPath.startsWith("docs/") && resolvedPath.endsWith(MARKDOWN_EXTENSION)
	);
}

function toBlobUrl(resolvedPath: string, sourceCommit: string, hash: string): string {
	return `${UPSTREAM_BLOB_BASE}/${sourceCommit}/${resolvedPath}${hash}`;
}

export function rewriteUpstreamHref(
	href: string,
	sourcePath: string,
	sourceCommit: string,
): string {
	if (isUntouchedHref(href)) {
		return href;
	}

	const { pathname, hash } = splitHash(href);
	const resolvedPath = resolveSourcePath(sourcePath, pathname);

	if (!isDocsMarkdownPath(resolvedPath)) {
		return toBlobUrl(resolvedPath, sourceCommit, hash);
	}

	const contentId = sourcePathToContentId(resolvedPath);
	const route = contentIdToRoute(contentId);
	return `${withBase(route)}${hash}`;
}

const rewriteLinkNode = (
	link: Link,
	options: RemarkUpstreamLinksOptions,
): void => {
	link.url = rewriteUpstreamHref(
		link.url,
		options.sourcePath,
		options.sourceCommit,
	);
};

function resolveOptions(
	explicitOptions: RemarkUpstreamLinksOptions | undefined,
	file: VFile,
): RemarkUpstreamLinksOptions | undefined {
	if (explicitOptions) {
		return explicitOptions;
	}

	const frontmatter = file.data.astro?.frontmatter as SourceFrontmatter | undefined;

	if (!frontmatter?.sourcePath || !frontmatter.sourceCommit) {
		return undefined;
	}

	return {
		sourcePath: frontmatter.sourcePath,
		sourceCommit: frontmatter.sourceCommit,
	};
}

const transformLinks =
	(explicitOptions?: RemarkUpstreamLinksOptions): Transformer<Root> =>
	(tree, file): void => {
		const options = resolveOptions(explicitOptions, file);

		if (!options) {
			return;
		}

		visit(tree, "link", (node) => {
			rewriteLinkNode(node as Link, options);
		});
	};

export const remarkUpstreamLinks: Plugin<
	[RemarkUpstreamLinksOptions?],
	Root
> = (options) => transformLinks(options);
