import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateSourceAnchors } from "../src/lib/markdown/source-anchors";
import { contentIdToRoute, sourcePathToContentId } from "../src/lib/routes";
import {
	collectTranslatedDocs,
	EXPECTED_JSON_EXAMPLES,
} from "../src/lib/translated-docs";
import { collectTranslationInvariantErrors } from "../src/lib/translation-invariants";
import {
	computeSourceHash,
	readTranslationManifest,
	type TranslationManifest,
} from "../src/lib/translation-manifest";

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
	return manifestPath ?? path.join(projectRoot, "src/data/translation-manifest.json");
}

function pushUnique(errors: string[], error: string): void {
	if (!errors.includes(error)) {
		errors.push(error);
	}
}

function getPublicRoute(sourcePath: string): string {
	return contentIdToRoute(sourcePathToContentId(sourcePath));
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
			errors.push(`missing JSON example: public/examples/test-pro/${exampleName}`);
		}
	}
}

async function collectUpstreamReality(
	upstreamRoot: string,
	manifest: TranslationManifest,
	errors: string[],
): Promise<Map<string, "current" | "stale">> {
	const statusByTranslationPath = new Map<string, "current" | "stale">();
	const upstreamDocsRoot = path.resolve(upstreamRoot, "docs");

	for (const record of manifest.records) {
		const sourceAbsolutePath = path.resolve(upstreamRoot, record.sourcePath);
		const relativeToDocs = path.relative(upstreamDocsRoot, sourceAbsolutePath);

		if (
			relativeToDocs.startsWith("..") ||
			path.isAbsolute(relativeToDocs) ||
			!existsSync(sourceAbsolutePath)
		) {
			errors.push(
				`missing upstream source for recorded translation: ${record.sourcePath} (${record.translationPath})`,
			);
			continue;
		}

		try {
			const currentHash = await computeSourceHash(
				await readFile(sourceAbsolutePath, "utf8"),
			);
			statusByTranslationPath.set(
				record.translationPath,
				currentHash === record.sourceHash ? "current" : "stale",
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			errors.push(
				`unable to read upstream source for recorded translation: ${record.sourcePath} (${record.translationPath}): ${message}`,
			);
		}
	}

	return statusByTranslationPath;
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
	const upstreamReality = options.upstreamRoot
		? await collectUpstreamReality(options.upstreamRoot, manifest, errors)
		: undefined;

	for (const doc of docs) {
		if (doc.frontmatterError) {
			errors.push(doc.frontmatterError);
			continue;
		}

		const frontmatter = doc.frontmatter;
		if (!frontmatter) {
			continue;
		}

		const record = manifestByTranslationPath.get(doc.relativePath);

		if (!record) {
			errors.push(
				`translation without manifest record: ${doc.relativePath} (${frontmatter.sourcePath})`,
			);
		} else {
			if (
				record.sourcePath !== frontmatter.sourcePath ||
				record.sourceCommit !== frontmatter.sourceCommit ||
				record.sourceHash !== frontmatter.sourceHash
			) {
				errors.push(
					`source metadata differs from manifest: ${doc.relativePath} (${record.sourcePath})`,
				);
			}

			const actualStatus = upstreamReality?.get(record.translationPath);
			if (
				actualStatus &&
				frontmatter.translationStatus !== actualStatus
			) {
				errors.push(
					`translationStatus mismatch: ${doc.relativePath} declares ${frontmatter.translationStatus} but upstream is ${actualStatus}`,
				);
			}
		}

		const publicRoute = getPublicRoute(frontmatter.sourcePath);
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

		// Fence/URL invariants compare against the live upstream tip; only current
		// translations are required to match. Stale pages intentionally lag.
		if (
			options.upstreamRoot &&
			record &&
			frontmatter.translationStatus === "current"
		) {
			const sourceAbsolutePath = path.resolve(
				options.upstreamRoot,
				record.sourcePath,
			);
			if (existsSync(sourceAbsolutePath)) {
				try {
					const sourceMarkdown = await readFile(sourceAbsolutePath, "utf8");
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
