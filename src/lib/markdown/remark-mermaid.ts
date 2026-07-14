import type { Code, Html, Root } from "mdast";
import type { Plugin, Transformer } from "unified";
import { visit } from "unist-util-visit";

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function toMermaidHtml(codeBlock: Code): Html {
	return {
		type: "html",
		value: `<pre data-mermaid="" data-language="mermaid"><code class="language-mermaid">${escapeHtml(codeBlock.value)}</code></pre>`,
	};
}

const transformMermaidBlocks: Transformer<Root> = (tree): void => {
	visit(tree, "code", (node, index, parent) => {
		const codeBlock = node as Code;

		if (codeBlock.lang !== "mermaid") {
			return;
		}

		if (typeof index !== "number" || !parent) {
			return;
		}

		parent.children[index] = toMermaidHtml(codeBlock);
	});
};

export const remarkMermaid: Plugin<[], Root> = () => transformMermaidBlocks;
