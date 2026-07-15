import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
	routeForRecord,
	routeForTranslationPath,
	sourcePathForTranslation,
} from "../lib/routes";
import { validateSourceAnchors } from "../lib/source-anchors";
import { collectTerminologyErrors } from "../lib/terminology-lint";
import {
	collectTranslatedDocs,
	EXPECTED_JSON_EXAMPLES,
	NON_TRANSLATION_PATHS,
} from "../lib/translated-docs";
import { collectTranslationInvariantErrors } from "../lib/translation-invariants";
import {
	computeSourceHash,
	MANIFEST_RELATIVE_PATH,
	readTranslationManifest,
	type TranslationManifest,
	type TranslationRecord,
} from "../lib/translation-manifest";

export interface ValidationResult {
	ok: boolean;
	errors: string[];
}

export interface ValidateContentOptions {
	projectRoot?: string;
	upstreamRoot?: string;
	manifestPath?: string;
	/**
	 * 上流の作業ツリーではなく、各レコードの sourceCommit 時点の原文
	 * (`git show <sourceCommit>:<sourcePath>`)と照合する。上流 HEAD が
	 * 記録より進んでいても全レコードの不変条件を検証できるため、CI 向け。
	 * upstreamRoot と併用必須。
	 */
	atRecordedCommit?: boolean;
}

/** 記録された sourceCommit 時点の原文を上流 clone から取り出す(バイト保全のため trim しない)。 */
function readSourceAtRecordedCommit(
	upstreamRoot: string,
	record: TranslationRecord,
): string {
	return execFileSync(
		"git",
		["show", `${record.sourceCommit}:${record.sourcePath}`],
		{ cwd: upstreamRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
	);
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

		// frontmatter の slug はファイル名由来のルートを置き換える。SourceStatus が
		// レンダリング時にレコードを引けるよう、マニフェスト側も同じルートを持つ必要がある。
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

		// 行番号を実ファイルに一致させるため raw(frontmatter 込み)を渡す。
		for (const error of collectTerminologyErrors(doc.relativePath, doc.raw)) {
			pushUnique(errors, error);
		}

		// 上流照合: 既定モードは作業ツリーと比較し、レコードが上流の最新に一致する
		// 翻訳のみフェンス/URL の不変条件を検査する(記録より進んだ上流は意図的にスキップ)。
		// atRecordedCommit モードは記録時点の原文を git show で取り出し、
		// 上流 HEAD の位置に関係なく全レコードを検査する。
		if (options.upstreamRoot && record) {
			try {
				let sourceMarkdown: string;

				if (options.atRecordedCommit) {
					sourceMarkdown = readSourceAtRecordedCommit(
						options.upstreamRoot,
						record,
					);
					const recordedHash = await computeSourceHash(sourceMarkdown);
					if (recordedHash !== record.sourceHash) {
						errors.push(
							`manifest hash mismatch at recorded commit: ${record.sourcePath}@${record.sourceCommit.slice(0, 12)} does not hash to the recorded sourceHash (${record.translationPath})`,
						);
						continue;
					}
				} else {
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
					sourceMarkdown = await readFile(sourceAbsolutePath, "utf8");
					const currentHash = await computeSourceHash(sourceMarkdown);
					if (currentHash !== record.sourceHash) {
						continue;
					}
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

	// changelog / watch-prompt などの翻訳対象外ページも表記揺れの検査だけは行う。
	for (const relativePath of NON_TRANSLATION_PATHS) {
		const absolutePath = path.join(projectRoot, relativePath);
		if (!existsSync(absolutePath)) {
			continue;
		}
		const raw = await readFile(absolutePath, "utf8");
		for (const error of collectTerminologyErrors(relativePath, raw)) {
			pushUnique(errors, error);
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
			case "--at-recorded":
				cliOptions.atRecordedCommit = true;
				break;
			default:
				throw new Error(`Unknown argument: ${argument}`);
		}
	}

	if (cliOptions.atRecordedCommit && !cliOptions.upstreamRoot) {
		throw new Error("--at-recorded requires --upstream.");
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
