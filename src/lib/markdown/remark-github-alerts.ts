import type { Blockquote, Paragraph, Root, Text } from "mdast";
import type { Plugin, Transformer } from "unified";
import { visit } from "unist-util-visit";

import { assertNever } from "../assert-never";

const ALERT_MARKER_PATTERN = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/;

type GithubAlertMarker =
	| "NOTE"
	| "TIP"
	| "IMPORTANT"
	| "WARNING"
	| "CAUTION";

export type GithubAlertKind =
	| "note"
	| "tip"
	| "important"
	| "warning"
	| "caution";

interface MarkdownDataAttributes {
	hName?: string;
	hProperties?: Record<string, unknown>;
}

function toAlertKind(marker: GithubAlertMarker): GithubAlertKind {
	switch (marker) {
		case "NOTE":
			return "note";
		case "TIP":
			return "tip";
		case "IMPORTANT":
			return "important";
		case "WARNING":
			return "warning";
		case "CAUTION":
			return "caution";
		default:
			return assertNever(marker);
	}
}

function getFirstTextNode(paragraph: Paragraph): Text | undefined {
	const firstChild = paragraph.children[0];

	if (firstChild?.type !== "text") {
		return undefined;
	}

	return firstChild;
}

function getAlertMatch(blockquote: Blockquote): RegExpMatchArray | null {
	const firstChild = blockquote.children[0];

	if (firstChild?.type !== "paragraph") {
		return null;
	}

	const firstTextNode = getFirstTextNode(firstChild);
	return firstTextNode?.value.match(ALERT_MARKER_PATTERN) ?? null;
}

function ensureMarkdownData(node: { data?: unknown }): MarkdownDataAttributes {
	const data = (node.data ?? {}) as MarkdownDataAttributes;
	data.hName ??= "blockquote";
	data.hProperties ??= {};
	node.data = data;
	return data;
}

function rewriteLeadingParagraph(
	blockquote: Blockquote,
	match: RegExpMatchArray,
): void {
	const firstChild = blockquote.children[0];

	if (firstChild?.type !== "paragraph") {
		return;
	}

	const [, , remainder] = match;
	const normalizedRemainder = remainder.trimStart();

	if (normalizedRemainder.length === 0) {
		firstChild.children = firstChild.children.slice(1);

		if (firstChild.children.length === 0) {
			blockquote.children = blockquote.children.slice(1);
		}

		return;
	}

	const firstTextNode = getFirstTextNode(firstChild);

	if (!firstTextNode) {
		return;
	}

	firstTextNode.value = normalizedRemainder;
}

const transformGithubAlerts: Transformer<Root> = (tree): void => {
	visit(tree, "blockquote", (node) => {
		const blockquote = node as Blockquote;
		const match = getAlertMatch(blockquote);

		if (!match) {
			return;
		}

		const marker = match[1] as GithubAlertMarker;
		const data = ensureMarkdownData(blockquote);
		data.hProperties = {
			...data.hProperties,
			"data-alert-kind": toAlertKind(marker),
		};
		rewriteLeadingParagraph(blockquote, match);
	});
};

export const remarkGithubAlerts: Plugin<[], Root> = () => transformGithubAlerts;
