const FENCE_PATTERN = /^```([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm;
const RAW_URL_PATTERN = /https?:\/\/[^\s)\]>'"]+/g;
const ANCHOR_PATTERN = /^<a id="([^"]+)"><\/a>$/gm;
const JAPANESE_PATTERN = /[\u3040-\u30ff\u4e00-\u9fff]/;

export interface FenceBlock {
	language: string;
	body: string;
}

export function normalizeNewlines(text: string): string {
	return text.replace(/\r\n/g, "\n");
}

export function stripFrontmatter(text: string): string {
	return normalizeNewlines(text).replace(/^---\n[\s\S]*?\n---\n/, "");
}

export function extractFenceBlocks(text: string): FenceBlock[] {
	const blocks: FenceBlock[] = [];
	const body = stripFrontmatter(text);
	for (const match of body.matchAll(FENCE_PATTERN)) {
		blocks.push({
			language: match[1].trim(),
			body: match[2],
		});
	}
	return blocks;
}

export function extractRawUrls(text: string): string[] {
	const urls = (stripFrontmatter(text).match(RAW_URL_PATTERN) ?? []).map(
		(url) => url.replace(/[.,;:!?)}\]]+$/u, ""),
	);
	return [...new Set(urls)].sort((left, right) => left.localeCompare(right));
}

export function extractAnchorIds(text: string): string[] {
	return [...stripFrontmatter(text).matchAll(ANCHOR_PATTERN)].map(
		(match) => match[1],
	);
}

export function hasJapaneseProse(text: string): boolean {
	const withoutFences = stripFrontmatter(text).replace(FENCE_PATTERN, "");
	return JAPANESE_PATTERN.test(withoutFences);
}

export function collectTranslationInvariantErrors(
	sourcePath: string,
	sourceMarkdown: string,
	translationPath: string,
	translationMarkdown: string,
): string[] {
	const errors: string[] = [];
	const sourceFences = extractFenceBlocks(sourceMarkdown);
	const translationFences = extractFenceBlocks(translationMarkdown);

	const sourceNonMermaid = sourceFences.filter(
		(block) => block.language !== "mermaid",
	);
	const translationNonMermaid = translationFences.filter(
		(block) => block.language !== "mermaid",
	);

	if (
		sourceNonMermaid.length !== translationNonMermaid.length ||
		sourceNonMermaid.some(
			(block, index) =>
				block.language !== translationNonMermaid[index]?.language ||
				block.body !== translationNonMermaid[index]?.body,
		)
	) {
		errors.push(
			`non-Mermaid fence mismatch: ${translationPath} (source ${sourcePath})`,
		);
	}

	const sourceMermaidCount = sourceFences.filter(
		(block) => block.language === "mermaid",
	).length;
	const translationMermaidCount = translationFences.filter(
		(block) => block.language === "mermaid",
	).length;
	if (sourceMermaidCount !== translationMermaidCount) {
		errors.push(
			`Mermaid fence count mismatch: ${translationPath} expected ${sourceMermaidCount}, found ${translationMermaidCount}`,
		);
	}

	const sourceUrls = extractRawUrls(sourceMarkdown);
	const translationUrls = extractRawUrls(translationMarkdown);
	if (sourceUrls.join("\n") !== translationUrls.join("\n")) {
		errors.push(`raw URL set mismatch: ${translationPath} (source ${sourcePath})`);
	}

	const anchorIds = extractAnchorIds(translationMarkdown);
	const uniqueAnchorIds = new Set(anchorIds);
	if (uniqueAnchorIds.size !== anchorIds.length) {
		errors.push(`duplicate source anchors: ${translationPath}`);
	}

	if (!hasJapaneseProse(translationMarkdown)) {
		errors.push(`missing Japanese prose outside code fences: ${translationPath}`);
	}

	return errors;
}
