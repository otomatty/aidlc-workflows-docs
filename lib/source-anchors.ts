import GithubSlugger from "github-slugger";

const SOURCE_ANCHOR_PATTERN = /^<a id="([^"]+)"><\/a>$/;
const HASH_REFERENCE_PATTERN = /\]\(#([^)]+)\)/g;
const VALID_SOURCE_ANCHOR_ID_PATTERN = /^[a-z0-9_]+(?:-+[a-z0-9_]+)*$/;
const ATX_HEADING_PATTERN = /^#{1,6}\s+\S/;

export interface AnchorValidationResult {
	ok: boolean;
	anchorIds: string[];
	duplicateIds: string[];
	invalidIds: string[];
	missingReferences: string[];
	misplacedAnchorIds: string[];
}

interface SourceAnchor {
	id: string;
	lineIndex: number;
}

function collectHeadingIds(lines: string[]): string[] {
	const slugger = new GithubSlugger();
	const headingIds: string[] = [];
	let inFence = false;

	for (const line of lines) {
		if (/^\s*```/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) {
			continue;
		}
		const match = line.match(/^(#{1,6})\s+(.+)$/);
		if (!match) {
			continue;
		}
		headingIds.push(slugger.slug(match[2].trim()));
	}

	return headingIds;
}

function collectSourceAnchors(lines: string[]): SourceAnchor[] {
	const sourceAnchors: SourceAnchor[] = [];

	for (const [lineIndex, line] of lines.entries()) {
		const match = line.match(SOURCE_ANCHOR_PATTERN);

		if (match) {
			sourceAnchors.push({ id: match[1], lineIndex });
		}
	}

	return sourceAnchors;
}

function collectDuplicateIds(anchorIds: string[]): string[] {
	const seen = new Set<string>();
	const duplicates = new Set<string>();

	for (const anchorId of anchorIds) {
		if (seen.has(anchorId)) {
			duplicates.add(anchorId);
			continue;
		}

		seen.add(anchorId);
	}

	return Array.from(duplicates);
}

function collectInvalidIds(anchorIds: string[]): string[] {
	return anchorIds.filter(
		(anchorId) => !VALID_SOURCE_ANCHOR_ID_PATTERN.test(anchorId),
	);
}

function collectMissingReferences(
	anchorIds: string[],
	hashReferences: string[],
): string[] {
	const anchorIdSet = new Set(anchorIds);
	const missingReferences = new Set<string>();

	for (const hashReference of hashReferences) {
		if (!anchorIdSet.has(hashReference)) {
			missingReferences.add(hashReference);
		}
	}

	return Array.from(missingReferences);
}

function collectMisplacedAnchorIds(
	sourceAnchors: SourceAnchor[],
	lines: string[],
): string[] {
	return sourceAnchors
		.filter(
			({ lineIndex }) => !ATX_HEADING_PATTERN.test(lines[lineIndex + 1] ?? ""),
		)
		.map(({ id }) => id);
}

export function validateSourceAnchors(
	markdown: string,
): AnchorValidationResult {
	const lines = markdown.split(/\r?\n/);
	const sourceAnchors = collectSourceAnchors(lines);
	const anchorIds = sourceAnchors.map(({ id }) => id);
	const headingIds = collectHeadingIds(lines);
	const hashReferences = Array.from(
		markdown.matchAll(HASH_REFERENCE_PATTERN),
		(match) => match[1],
	);
	const duplicateIds = collectDuplicateIds(anchorIds);
	const invalidIds = collectInvalidIds(anchorIds);
	const missingReferences = collectMissingReferences(
		[...anchorIds, ...headingIds],
		hashReferences,
	);
	const misplacedAnchorIds = collectMisplacedAnchorIds(sourceAnchors, lines);

	return {
		ok:
			duplicateIds.length === 0 &&
			invalidIds.length === 0 &&
			missingReferences.length === 0 &&
			misplacedAnchorIds.length === 0,
		anchorIds,
		duplicateIds,
		invalidIds,
		missingReferences,
		misplacedAnchorIds,
	};
}
