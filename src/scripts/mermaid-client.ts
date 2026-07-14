import mermaid from "mermaid";

const MERMAID_ERROR_LABEL = "Mermaid の描画に失敗しました。";

let mermaidInitialized = false;

interface MermaidRenderResult {
	svg: string;
	bindFunctions?: (element: Element) => void;
}

function ensureMermaidInitialized(): void {
	if (mermaidInitialized) {
		return;
	}

	mermaid.initialize({
		startOnLoad: false,
		securityLevel: "strict",
	});
	mermaidInitialized = true;
}

function getOrCreateDiagramContainer(block: HTMLPreElement): HTMLDivElement {
	const nextElement = block.nextElementSibling;

	if (nextElement instanceof HTMLDivElement && nextElement.hasAttribute("data-mermaid-diagram")) {
		return nextElement;
	}

	const container = document.createElement("div");
	container.className = "docs-mermaid";
	container.setAttribute("data-mermaid-diagram", "");
	block.insertAdjacentElement("afterend", container);
	return container;
}

function ensureErrorLabel(container: HTMLDivElement): void {
	const existingLabel = container.querySelector<HTMLElement>("[data-mermaid-error]");

	if (existingLabel) {
		return;
	}

	const errorLabel = document.createElement("p");
	errorLabel.className = "docs-mermaid__error";
	errorLabel.setAttribute("data-mermaid-error", "");
	errorLabel.textContent = MERMAID_ERROR_LABEL;
	container.append(errorLabel);
}

async function renderMermaidBlocks(): Promise<void> {
	ensureMermaidInitialized();

	const mermaidBlocks = document.querySelectorAll<HTMLPreElement>("pre[data-mermaid]");
	let diagramIndex = 0;

	for (const block of mermaidBlocks) {
		const source =
			block.querySelector("code")?.textContent?.trim() ?? block.textContent?.trim() ?? "";

		if (source.length === 0) {
			continue;
		}

		diagramIndex += 1;
		const container = getOrCreateDiagramContainer(block);

		try {
			const rendered = (await mermaid.render(
				`docs-mermaid-${diagramIndex}`,
				source,
			)) as MermaidRenderResult;
			container.innerHTML = rendered.svg;
			rendered.bindFunctions?.(container);
			block.hidden = true;
		} catch (error) {
			container.replaceChildren();
			ensureErrorLabel(container);
			block.hidden = false;
			console.error("Failed to render Mermaid diagram.", error);
		}
	}
}

void renderMermaidBlocks();
