import { SITE_BASE } from "../data/site";

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LOADING_LABEL = "検索インデックスを読み込んでいます。";
const SEARCH_IDLE_LABEL = "キーワードを入力してください。";
const SEARCH_ACTIVE_LABEL = "検索中です。";
const SEARCH_EMPTY_LABEL = "該当するページが見つかりませんでした。";

interface SearchResultData {
	url: string;
	meta: {
		title?: string;
	};
	plain_excerpt?: string;
	excerpt?: string;
}

interface SearchResultRecord {
	data(): Promise<SearchResultData>;
}

interface SearchResponse {
	results: SearchResultRecord[];
}

interface PagefindInstance {
	debouncedSearch(
		term: string,
		options?: Record<string, never>,
		debounceTimeoutMs?: number,
	): Promise<SearchResponse | null>;
}

interface PagefindModule {
	createInstance(options: {
		basePath: string;
	}): PagefindInstance;
}

interface SearchElements {
	trigger: HTMLButtonElement;
	dialog: HTMLDialogElement;
	closeButton: HTMLButtonElement;
	input: HTMLInputElement;
	status: HTMLParagraphElement;
	results: HTMLUListElement;
}

let pagefindPromise: Promise<PagefindInstance> | undefined;

function getSearchElements(root: HTMLElement): SearchElements | undefined {
	const trigger = root.querySelector<HTMLButtonElement>("[data-search-open]");
	const dialog = root.querySelector<HTMLDialogElement>("[data-search-dialog]");
	const closeButton = root.querySelector<HTMLButtonElement>("[data-search-close]");
	const input = root.querySelector<HTMLInputElement>("[data-search-input]");
	const status = root.querySelector<HTMLParagraphElement>("[data-search-status]");
	const results = root.querySelector<HTMLUListElement>("[data-search-results]");

	if (!trigger || !dialog || !closeButton || !input || !status || !results) {
		return undefined;
	}

	return {
		trigger,
		dialog,
		closeButton,
		input,
		status,
		results,
	};
}

function normalizeResultUrl(rawUrl: string): string {
	if (/^(https?:)?\/\//.test(rawUrl) || rawUrl.startsWith(SITE_BASE)) {
		return rawUrl;
	}

	const normalizedUrl = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
	return `${SITE_BASE}${normalizedUrl}`;
}

async function ensurePagefind(): Promise<PagefindInstance> {
	if (!pagefindPromise) {
		const pagefindScriptUrl = `${SITE_BASE}/pagefind/pagefind.js`;
		pagefindPromise = (async () => {
			const pagefindModule = (await import(
				/* @vite-ignore */ pagefindScriptUrl
			)) as PagefindModule;
			return pagefindModule.createInstance({
				basePath: `${SITE_BASE}/pagefind/`,
			});
		})().catch((error: unknown) => {
			pagefindPromise = undefined;
			throw error;
		});
	}

	return pagefindPromise;
}

function renderSearchResults(
	resultsElement: HTMLUListElement,
	results: Array<{
		title: string;
		excerpt: string;
		url: string;
	}>,
): void {
	resultsElement.replaceChildren();

	for (const result of results) {
		const item = document.createElement("li");
		item.className = "docs-search__result";

		const link = document.createElement("a");
		link.className = "docs-search__result-link";
		link.href = result.url;
		link.textContent = result.title;

		const excerpt = document.createElement("p");
		excerpt.className = "docs-search__result-excerpt";
		excerpt.textContent = result.excerpt;

		item.append(link, excerpt);
		resultsElement.append(item);
	}
}

async function searchPages(elements: SearchElements): Promise<void> {
	const query = elements.input.value.trim();

	if (query.length === 0) {
		elements.results.replaceChildren();
		elements.status.textContent = SEARCH_IDLE_LABEL;
		return;
	}

	elements.status.textContent = SEARCH_ACTIVE_LABEL;

	const pagefind = await ensurePagefind();
	const response = await pagefind.debouncedSearch(query, {}, SEARCH_DEBOUNCE_MS);

	if (response === null || query !== elements.input.value.trim()) {
		return;
	}

	const resolvedResults = await Promise.all(
		response.results.map(async (result) => {
			const data = await result.data();
			return {
				title: data.meta.title ?? data.url,
				excerpt: data.plain_excerpt ?? data.excerpt ?? "",
				url: normalizeResultUrl(data.url),
			};
		}),
	);

	if (resolvedResults.length === 0) {
		elements.results.replaceChildren();
		elements.status.textContent = SEARCH_EMPTY_LABEL;
		return;
	}

	renderSearchResults(elements.results, resolvedResults);
	elements.status.textContent = `${resolvedResults.length} 件の結果`;
}

function initializeSearch(root: HTMLElement): void {
	const elements = getSearchElements(root);

	if (!elements) {
		return;
	}

	const openDialog = async (): Promise<void> => {
		if (!elements.dialog.open) {
			elements.dialog.showModal();
		}

		elements.trigger.setAttribute("aria-expanded", "true");
		elements.status.textContent = SEARCH_LOADING_LABEL;

		try {
			await ensurePagefind();
			elements.status.textContent =
				elements.input.value.trim().length > 0 ? SEARCH_ACTIVE_LABEL : SEARCH_IDLE_LABEL;
		} catch (error) {
			elements.status.textContent = "検索の読み込みに失敗しました。";
			console.error("Failed to load Pagefind.", error);
		}

		elements.input.focus();
	};

	elements.trigger.addEventListener("click", () => {
		void openDialog();
	});

	elements.closeButton.addEventListener("click", () => {
		elements.dialog.close();
	});

	elements.dialog.addEventListener("close", () => {
		elements.trigger.setAttribute("aria-expanded", "false");
		elements.trigger.focus();
	});

	elements.results.addEventListener("click", (event) => {
		const target = event.target;

		if (target instanceof Element && target.closest("a[href]")) {
			elements.dialog.close();
		}
	});

	elements.input.addEventListener("input", () => {
		void searchPages(elements);
	});
}

const searchRoot = document.querySelector<HTMLElement>("[data-search-root]");

if (searchRoot) {
	initializeSearch(searchRoot);
}
