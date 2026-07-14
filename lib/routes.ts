// Mirrors Blume's route mapping (blume/src/core/sources/normalize.ts):
// extension stripped, `index` segments dropped, numeric ordering prefixes
// (`01-`) stripped.
const NUMERIC_PREFIX = /^\d+[-_.]/;

export function routeForTranslationPath(translationPath: string): string {
	const segments = translationPath
		.replace(/^docs\//, "")
		.replace(/\.mdx?$/, "")
		.split("/")
		.map((segment) => segment.replace(NUMERIC_PREFIX, ""))
		.filter((segment) => segment !== "index");
	return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

export function routeForRecord(record: {
	route?: string;
	translationPath: string;
}): string {
	return record.route ?? routeForTranslationPath(record.translationPath);
}

// docs/guide/agents/index.mdx <-> upstream docs/guide/agents/README.md
export function sourcePathForTranslation(translationPath: string): string {
	return translationPath
		.replace(/(^|\/)index\.mdx$/, "$1README.md")
		.replace(/\.mdx$/, ".md");
}
