import { describe, expect, it } from "vitest";

import {
	buildNavigation,
	type DocNavInput,
	findPageNeighbors,
} from "../../src/lib/navigation";

const entries: DocNavInput[] = [
	{ id: "reference/research/cross-tool-plugin-comparison", title: "Cross-Tool Plugin Comparison", sidebarOrder: 20 },
	{ id: "guide/agents/product-agent", title: "Product Agent", sidebarOrder: 20 },
	{ id: "guide/13-customization", title: "Customization", sidebarOrder: 13 },
	{ id: "guide/06-agents", title: "Agents", sidebarOrder: 6 },
	{ id: "reference/04-stages/operation", title: "Operation", sidebarOrder: 20 },
	{ id: "harness-engineering/09-porting-to-a-new-harness", title: "Porting to a New Harness", sidebarOrder: 9 },
	{ id: "guide/workshop-mode", title: "Workshop Mode", sidebarOrder: 80 },
	{ id: "guide/harnesses/kiro-ide", title: "Running on Kiro IDE", sidebarOrder: 20 },
	{ id: "guide/00-introduction", title: "Introduction", sidebarOrder: 0 },
	{ id: "reference/00-overview", title: "Overview", sidebarOrder: 0 },
	{ id: "reference/18-plugin-mechanism", title: "Plugin Mechanism", sidebarOrder: 18 },
	{ id: "guide/harnesses/codex-cli", title: "Running on Codex CLI", sidebarOrder: 10 },
	{ id: "reference/04-stage-protocol", title: "Stage Protocol", sidebarOrder: 4 },
	{ id: "reference/examples/test-pro/index", title: "test-pro Example", sidebarOrder: 5 },
	{ id: "guide/agents/README", title: "Agent Deep-Dive Index", sidebarOrder: 0 },
	{ id: "guide/17-skills", title: "Skills", sidebarOrder: 17 },
	{ id: "reference/05-agent-system", title: "Agent System", sidebarOrder: 5 },
	{ id: "guide/04-phases-and-stages", title: "Phases and Stages", sidebarOrder: 4 },
	{ id: "reference/04-stages/initialization", title: "Initialization", sidebarOrder: 10 },
	{ id: "guide/harnesses/readme", title: "Running on Other Harnesses", sidebarOrder: 0 },
	{ id: "guide/agents/architect-agent", title: "Architect Agent", sidebarOrder: 10 },
	{ id: "reference/agents/index", title: "Technical Agent Reference", sidebarOrder: 0 },
	{ id: "reference/agents/design-agent", title: "Design Agent", sidebarOrder: 20 },
	{ id: "guide/glossary", title: "Glossary", sidebarOrder: 90 },
	{ id: "reference/research/codex-manifest-shape-report", title: "Codex Manifest Shape Report", sidebarOrder: 10 },
	{ id: "reference/agents/architect-agent", title: "Architect Agent", sidebarOrder: 10 },
	{ id: "harness-engineering/00-overview", title: "Overview", sidebarOrder: 0 },
];

describe("navigation", () => {
	it("always returns guide groups in canonical order", () => {
		expect(
			buildNavigation([
				{
					id: "reference/00-overview",
					title: "Overview",
					sidebarOrder: 0,
				},
			]).map((group) => ({
				id: group.id,
				title: group.title,
				sectionCount: group.sections.length,
			})),
		).toEqual([
			{ id: "guide", title: "ユーザーガイド", sectionCount: 0 },
			{
				id: "harness-engineering",
				title: "ハーネスエンジニアガイド",
				sectionCount: 0,
			},
			{ id: "reference", title: "開発者リファレンス", sectionCount: 1 },
		]);
	});

	it("sorts chapters deterministically and nests known child collections", () => {
		const navigation = buildNavigation(entries);

		expect(navigation[0].sections.map((section) => section.title)).toEqual([
			"Introduction",
			"Phases and Stages",
			"Agents",
			"Customization",
			"Skills",
			"Workshop Mode",
			"Glossary",
		]);

		expect(navigation[0].sections[2]).toEqual({
			title: "Agents",
			links: [
				{
					id: "guide/06-agents",
					title: "Agents",
					href: "/aidlc-workflows-docs/guide/06-agents/",
				},
				{
					id: "guide/agents/README",
					title: "Agent Deep-Dive Index",
					href: "/aidlc-workflows-docs/guide/agents/",
				},
				{
					id: "guide/agents/architect-agent",
					title: "Architect Agent",
					href: "/aidlc-workflows-docs/guide/agents/architect-agent/",
				},
				{
					id: "guide/agents/product-agent",
					title: "Product Agent",
					href: "/aidlc-workflows-docs/guide/agents/product-agent/",
				},
			],
		});

		expect(navigation[0].sections[3]).toEqual({
			title: "Customization",
			links: [
				{
					id: "guide/13-customization",
					title: "Customization",
					href: "/aidlc-workflows-docs/guide/13-customization/",
				},
				{
					id: "guide/harnesses/readme",
					title: "Running on Other Harnesses",
					href: "/aidlc-workflows-docs/guide/harnesses/",
				},
				{
					id: "guide/harnesses/codex-cli",
					title: "Running on Codex CLI",
					href: "/aidlc-workflows-docs/guide/harnesses/codex-cli/",
				},
				{
					id: "guide/harnesses/kiro-ide",
					title: "Running on Kiro IDE",
					href: "/aidlc-workflows-docs/guide/harnesses/kiro-ide/",
				},
			],
		});

		expect(navigation[2].sections.map((section) => section.title)).toEqual([
			"Overview",
			"Stage Protocol",
			"Agent System",
			"Plugin Mechanism",
		]);

		expect(navigation[2].sections[1]).toEqual({
			title: "Stage Protocol",
			links: [
				{
					id: "reference/04-stage-protocol",
					title: "Stage Protocol",
					href: "/aidlc-workflows-docs/reference/04-stage-protocol/",
				},
				{
					id: "reference/04-stages/initialization",
					title: "Initialization",
					href: "/aidlc-workflows-docs/reference/04-stages/initialization/",
				},
				{
					id: "reference/04-stages/operation",
					title: "Operation",
					href: "/aidlc-workflows-docs/reference/04-stages/operation/",
				},
			],
		});

		expect(navigation[2].sections[2]).toEqual({
			title: "Agent System",
			links: [
				{
					id: "reference/05-agent-system",
					title: "Agent System",
					href: "/aidlc-workflows-docs/reference/05-agent-system/",
				},
				{
					id: "reference/agents/index",
					title: "Technical Agent Reference",
					href: "/aidlc-workflows-docs/reference/agents/",
				},
				{
					id: "reference/agents/architect-agent",
					title: "Architect Agent",
					href: "/aidlc-workflows-docs/reference/agents/architect-agent/",
				},
				{
					id: "reference/agents/design-agent",
					title: "Design Agent",
					href: "/aidlc-workflows-docs/reference/agents/design-agent/",
				},
			],
		});

		expect(navigation[2].sections[3]).toEqual({
			title: "Plugin Mechanism",
			links: [
				{
					id: "reference/18-plugin-mechanism",
					title: "Plugin Mechanism",
					href: "/aidlc-workflows-docs/reference/18-plugin-mechanism/",
				},
				{
					id: "reference/examples/test-pro/index",
					title: "test-pro Example",
					href: "/aidlc-workflows-docs/reference/examples/test-pro/",
				},
				{
					id: "reference/research/codex-manifest-shape-report",
					title: "Codex Manifest Shape Report",
					href:
						"/aidlc-workflows-docs/reference/research/codex-manifest-shape-report/",
				},
				{
					id: "reference/research/cross-tool-plugin-comparison",
					title: "Cross-Tool Plugin Comparison",
					href:
						"/aidlc-workflows-docs/reference/research/cross-tool-plugin-comparison/",
				},
			],
		});
	});

	it("uses code-point lexical ordering for equal-order non-ASCII titles and ids", () => {
		const navigation = buildNavigation([
			{ id: "guide/追加/éclair", title: "同名", sidebarOrder: 10 },
			{ id: "guide/追加/あいう", title: "同名", sidebarOrder: 10 },
			{ id: "guide/追加/emoji", title: "😀", sidebarOrder: 10 },
			{ id: "guide/追加/kanji", title: "漢字", sidebarOrder: 10 },
			{ id: "guide/追加/accent", title: "Éclair", sidebarOrder: 10 },
			{ id: "guide/追加/hiragana", title: "あいう", sidebarOrder: 10 },
		]);

		expect(navigation[0].sections).toHaveLength(1);
		expect(navigation[0].sections[0].links.map((link) => link.id)).toEqual([
			"guide/追加/accent",
			"guide/追加/hiragana",
			"guide/追加/éclair",
			"guide/追加/あいう",
			"guide/追加/kanji",
			"guide/追加/emoji",
		]);
	});

	it("finds previous and next links without crossing guide boundaries", () => {
		const navigation = buildNavigation(entries);

		expect(findPageNeighbors(navigation, "guide/agents/README")).toEqual({
			previous: {
				id: "guide/06-agents",
				title: "Agents",
				href: "/aidlc-workflows-docs/guide/06-agents/",
			},
			next: {
				id: "guide/agents/architect-agent",
				title: "Architect Agent",
				href: "/aidlc-workflows-docs/guide/agents/architect-agent/",
			},
		});

		expect(findPageNeighbors(navigation, "guide/glossary")).toEqual({
			previous: {
				id: "guide/workshop-mode",
				title: "Workshop Mode",
				href: "/aidlc-workflows-docs/guide/workshop-mode/",
			},
			next: undefined,
		});

		expect(
			findPageNeighbors(navigation, "harness-engineering/00-overview"),
		).toEqual({
			previous: undefined,
			next: {
				id: "harness-engineering/09-porting-to-a-new-harness",
				title: "Porting to a New Harness",
				href:
					"/aidlc-workflows-docs/harness-engineering/09-porting-to-a-new-harness/",
			},
		});
	});
});
