import { assertNever } from "./assert-never";
import { contentIdToRoute, withBase } from "./routes";

export interface DocNavInput {
	id: string;
	title: string;
	sidebarOrder: number;
}

export interface NavLink {
	id: string;
	title: string;
	href: string;
}

export interface NavSection {
	title: string;
	links: NavLink[];
}

export interface GuideNavigation {
	id: "guide" | "harness-engineering" | "reference";
	title: string;
	sections: NavSection[];
}

type GuideId = GuideNavigation["id"];
type NestedCollection = "04-stages" | "agents" | "examples" | "harnesses" | "research";

interface NavigationSection {
	id: string;
	title: string;
	links: NavLink[];
	sortEntry?: DocNavInput;
}

const GUIDE_IDS: readonly GuideId[] = [
	"guide",
	"harness-engineering",
	"reference",
];

function isGuideId(value: string): value is GuideId {
	return GUIDE_IDS.includes(value as GuideId);
}

function getGuideTitle(id: GuideId): string {
	switch (id) {
		case "guide":
			return "ユーザーガイド";
		case "harness-engineering":
			return "ハーネスエンジニアガイド";
		case "reference":
			return "開発者リファレンス";
		default:
			return assertNever(id);
	}
}

function parseGuideId(contentId: string): GuideId | undefined {
	const [maybeGuideId] = contentId.split("/");

	if (!maybeGuideId || !isGuideId(maybeGuideId)) {
		return undefined;
	}

	return maybeGuideId;
}

function isNestedCollection(value: string): value is NestedCollection {
	return (
		value === "04-stages" ||
		value === "agents" ||
		value === "examples" ||
		value === "harnesses" ||
		value === "research"
	);
}

function getNestedParentId(
	guideId: GuideId,
	collection: NestedCollection,
): string | undefined {
	switch (guideId) {
		case "guide":
			switch (collection) {
				case "agents":
					return "guide/06-agents";
				case "harnesses":
					return "guide/13-customization";
				case "04-stages":
				case "examples":
				case "research":
					return undefined;
				default:
					return assertNever(collection);
			}
		case "harness-engineering":
			switch (collection) {
				case "04-stages":
				case "agents":
				case "examples":
				case "harnesses":
				case "research":
					return undefined;
				default:
					return assertNever(collection);
			}
		case "reference":
			switch (collection) {
				case "04-stages":
					return "reference/04-stage-protocol";
				case "agents":
					return "reference/05-agent-system";
				case "examples":
				case "research":
					return "reference/18-plugin-mechanism";
				case "harnesses":
					return undefined;
				default:
					return assertNever(collection);
			}
		default:
			return assertNever(guideId);
	}
}

function getSectionId(entry: DocNavInput, guideId: GuideId): string {
	const segments = entry.id.split("/");
	const [, secondSegment] = segments;

	if (!secondSegment) {
		return entry.id;
	}

	if (segments.length > 2 && isNestedCollection(secondSegment)) {
		return getNestedParentId(guideId, secondSegment) ?? `${guideId}/${secondSegment}`;
	}

	return `${guideId}/${secondSegment}`;
}

function toNavLink(entry: DocNavInput): NavLink {
	return {
		id: entry.id,
		title: entry.title,
		href: withBase(contentIdToRoute(entry.id)),
	};
}

function getSortableSegment(id: string): string {
	const segments = id.split("/");
	return segments[segments.length - 1] ?? id;
}

function getNumericPrefix(id: string): number | undefined {
	const match = getSortableSegment(id).match(/^(\d+)-/);
	return match ? Number(match[1]) : undefined;
}

function compareCodePoints(left: string, right: string): number {
	const leftCodePoints = [...left];
	const rightCodePoints = [...right];
	const sharedLength = Math.min(leftCodePoints.length, rightCodePoints.length);

	for (let index = 0; index < sharedLength; index += 1) {
		const leftCodePoint = leftCodePoints[index]?.codePointAt(0);
		const rightCodePoint = rightCodePoints[index]?.codePointAt(0);

		if (
			leftCodePoint !== undefined &&
			rightCodePoint !== undefined &&
			leftCodePoint !== rightCodePoint
		) {
			return leftCodePoint - rightCodePoint;
		}
	}

	return leftCodePoints.length - rightCodePoints.length;
}

function compareDocNavInputs(left: DocNavInput, right: DocNavInput): number {
	const leftNumber = getNumericPrefix(left.id);
	const rightNumber = getNumericPrefix(right.id);

	if (leftNumber !== undefined && rightNumber !== undefined && leftNumber !== rightNumber) {
		return leftNumber - rightNumber;
	}

	if (leftNumber !== undefined && rightNumber === undefined) {
		return -1;
	}

	if (leftNumber === undefined && rightNumber !== undefined) {
		return 1;
	}

	if (left.sidebarOrder !== right.sidebarOrder) {
		return left.sidebarOrder - right.sidebarOrder;
	}

	if (left.title !== right.title) {
		return compareCodePoints(left.title, right.title);
	}

	return compareCodePoints(left.id, right.id);
}

function sortSectionEntries(sectionId: string, entries: DocNavInput[]): DocNavInput[] {
	return [...entries].sort((left, right) => {
		if (left.id === sectionId && right.id !== sectionId) {
			return -1;
		}

		if (left.id !== sectionId && right.id === sectionId) {
			return 1;
		}

		return compareDocNavInputs(left, right);
	});
}

function humanizeSegment(segment: string): string {
	return segment
		.replace(/-/g, " ")
		.replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildSection(sectionId: string, entries: DocNavInput[]): NavigationSection {
	const sortedEntries = sortSectionEntries(sectionId, entries);
	const sectionRoot = sortedEntries.find((entry) => entry.id === sectionId);
	const sectionTitle = sectionRoot?.title ?? humanizeSegment(getSortableSegment(sectionId));

	return {
		id: sectionId,
		title: sectionTitle,
		links: sortedEntries.map(toNavLink),
		sortEntry: sectionRoot ?? sortedEntries[0],
	};
}

function compareSections(left: NavigationSection, right: NavigationSection): number {
	if (!left.sortEntry && !right.sortEntry) {
		return compareCodePoints(left.id, right.id);
	}

	if (!left.sortEntry) {
		return 1;
	}

	if (!right.sortEntry) {
		return -1;
	}

	return compareDocNavInputs(left.sortEntry, right.sortEntry);
}

function buildGuideNavigation(
	guideId: GuideId,
	entries: DocNavInput[],
): GuideNavigation {
	const sectionEntries = new Map<string, DocNavInput[]>();

	for (const entry of entries) {
		const sectionId = getSectionId(entry, guideId);
		const existingEntries = sectionEntries.get(sectionId) ?? [];
		existingEntries.push(entry);
		sectionEntries.set(sectionId, existingEntries);
	}

	const sections = [...sectionEntries.entries()]
		.map(([sectionId, sectionDocEntries]) => buildSection(sectionId, sectionDocEntries))
		.sort(compareSections)
		.map(({ title, links }) => ({ title, links }));

	return {
		id: guideId,
		title: getGuideTitle(guideId),
		sections,
	};
}

function groupEntriesByGuide(entries: DocNavInput[]): Map<GuideId, DocNavInput[]> {
	const groupedEntries = new Map<GuideId, DocNavInput[]>(
		GUIDE_IDS.map((guideId) => [guideId, []]),
	);

	for (const entry of entries) {
		const guideId = parseGuideId(entry.id);

		if (!guideId) {
			continue;
		}

		groupedEntries.get(guideId)?.push(entry);
	}

	return groupedEntries;
}

function flattenGuideNavigation(guideNavigation: GuideNavigation): NavLink[] {
	return guideNavigation.sections.flatMap((section) => section.links);
}

export function buildNavigation(entries: DocNavInput[]): GuideNavigation[] {
	const groupedEntries = groupEntriesByGuide(entries);

	return GUIDE_IDS.map((guideId) =>
		buildGuideNavigation(guideId, groupedEntries.get(guideId) ?? []),
	);
}

export function findPageNeighbors(
	navigation: GuideNavigation[],
	contentId: string,
): { previous?: NavLink; next?: NavLink } {
	for (const guideNavigation of navigation) {
		const links = flattenGuideNavigation(guideNavigation);
		const currentIndex = links.findIndex((link) => link.id === contentId);

		if (currentIndex === -1) {
			continue;
		}

		return {
			previous: links[currentIndex - 1],
			next: links[currentIndex + 1],
		};
	}

	return {};
}
