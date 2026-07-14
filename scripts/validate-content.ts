import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
	routeForRecord,
	routeForTranslationPath,
	sourcePathForTranslation,
} from "../lib/routes";
import { validateSourceAnchors } from "../lib/source-anchors";
import {
	collectTranslatedDocs,
	EXPECTED_JSON_EXAMPLES,
} from "../lib/translated-docs";
import { collectTranslationInvariantErrors } from "../lib/translation-invariants";
import {
	computeSourceHash,
	MANIFEST_RELATIVE_PATH,
	readTranslationManifest,
	type TranslationManifest,
} from "../lib/translation-manifest";

export interface ValidationResult {
	ok: boolean;
	errors: string[];
}

export interface ValidateContentOptions {
	projectRoot?: string;
	upstreamRoot?: string;
	manifestPath?: string;
}

function getManifestPath(projectRoot: string, manifestPath?: string): string {
	return manifestPath ?? path.join(projectRoot, MANIFEST_RELATIVE_PATH);
}

function pushUnique(errors: string[], error: string): void {
	if (!errors.includes(error)) {
		errors.push(error);
	}
}

function collectManifestCoverageErrors(
	manifest: TranslationManifest,
	translationRelativePaths: Set<string>,
	errors: string[],
): void {
	for (const record of manifest.records) {
		if (!translationRelativePaths.has(record.translationPath)) {
			errors.push(
				`missing translation for manifest record: ${record.sourcePath} -> ${record.translationPath}`,
			);
		}
	}
}

function collectJsonExampleErrors(projectRoot: string, errors: string[]): void {
	for (const exampleName of EXPECTED_JSON_EXAMPLES) {
		const examplePath = path.join(
			projectRoot,
			"public/examples/test-pro",
			exampleName,
		);

		if (!existsSync(examplePath)) {
			errors.push(
				`missing JSON example: public/examples/test-pro/${exampleName}`,
			);
		}
	}
}

export async function validateContent(
	options: ValidateContentOptions = {},
): Promise<ValidationResult> {
	const projectRoot = options.projectRoot ?? process.cwd();
	const manifestPath = getManifestPath(projectRoot, options.manifestPath);
	const manifest = await readTranslationManifest(manifestPath);
	const docs = await collectTranslatedDocs(projectRoot);
	const manifestByTranslationPath = new Map(
		manifest.records.map((record) => [record.translationPath, record]),
	);
	const errors: string[] = [];
	const translationRelativePaths = new Set(docs.map((doc) => doc.relativePath));
	const routesByPublicPath = new Map<string, string>();

	collectManifestCoverageErrors(manifest, translationRelativePaths, errors);

	for (const doc of docs) {
		if (doc.frontmatterError) {
			errors.push(doc.frontmatterError);
			continue;
		}

		const record = manifestByTranslationPath.get(doc.relativePath);

		if (!record) {
			errors.push(
				`translation without manifest record: ${doc.relativePath} (${sourcePathForTranslation(doc.relativePath)})`,
			);
		}

		// A frontmatter slug replaces the file-derived route; the manifest must
		// carry the same route so SourceStatus can find the record at render time.
		const publicRoute = doc.frontmatter?.slug
			? routeForTranslationPath(`docs/${doc.frontmatter.slug}.mdx`)
			: routeForTranslationPath(doc.relativePath);
		if (record && routeForRecord(record) !== publicRoute) {
			errors.push(
				`manifest route mismatch: ${doc.relativePath} renders at ${publicRoute} but the manifest resolves ${routeForRecord(record)}`,
			);
		}
		const existingDocPath = routesByPublicPath.get(publicRoute);

		if (existingDocPath) {
			errors.push(
				`duplicate public route: ${publicRoute} (${existingDocPath}, ${doc.relativePath})`,
			);
		} else {
			routesByPublicPath.set(publicRoute, doc.relativePath);
		}

		const anchorValidation = validateSourceAnchors(doc.body);
		if (!anchorValidation.ok) {
			pushUnique(
				errors,
				`Invalid source anchors in ${doc.relativePath}: duplicate IDs: ${anchorValidation.duplicateIds.join(", ") || "none"}; invalid IDs: ${anchorValidation.invalidIds.join(", ") || "none"}; missing local hash targets: ${anchorValidation.missingReferences.join(", ") || "none"}; anchors not immediately followed by an ATX heading: ${anchorValidation.misplacedAnchorIds.join(", ") || "none"}`,
			);
		}

		// Upstream checks: the recorded source must exist, and a translation whose
		// record matches the live upstream tip must satisfy the fence/URL
		// invariants. Records lagging upstream (stale) intentionally skip them.
		if (options.upstreamRoot && record) {
			const sourceAbsolutePath = path.resolve(
				options.upstreamRoot,
				record.sourcePath,
			);
			if (!existsSync(sourceAbsolutePath)) {
				errors.push(
					`missing upstream source for recorded translation: ${record.sourcePath} (${record.translationPath})`,
				);
				continue;
			}

			try {
				const sourceMarkdown = await readFile(sourceAbsolutePath, "utf8");
				const currentHash = await computeSourceHash(sourceMarkdown);
				if (currentHash !== record.sourceHash) {
					continue;
				}
				for (const error of collectTranslationInvariantErrors(
					record.sourcePath,
					sourceMarkdown,
					doc.relativePath,
					doc.raw,
				)) {
					pushUnique(errors, error);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				errors.push(
					`unable to compare translation invariants for ${doc.relativePath}: ${message}`,
				);
			}
		}
	}

	collectJsonExampleErrors(projectRoot, errors);

	return {
		ok: errors.length === 0,
		errors: errors.sort((left, right) => left.localeCompare(right)),
	};
}

function parseCliArgs(argv: string[]): ValidateContentOptions {
	const cliOptions: ValidateContentOptions = {};

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];

		switch (argument) {
			case "--upstream": {
				const upstreamRoot = argv[index + 1];
				if (!upstreamRoot) {
					throw new Error("Missing value for --upstream.");
				}
				cliOptions.upstreamRoot = path.resolve(upstreamRoot);
				index += 1;
				break;
			}
			default:
				throw new Error(`Unknown argument: ${argument}`);
		}
	}

	return cliOptions;
}

if (import.meta.main) {
	const cliOptions = parseCliArgs(process.argv.slice(2));
	const result = await validateContent(cliOptions);

	if (!result.ok) {
		console.error(result.errors.join("\n"));
		process.exit(1);
	}

	console.log("Content validation passed.");
}
