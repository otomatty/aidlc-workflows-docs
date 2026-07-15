// confluence-sync.ts — aidlc-workflows の docs/ を日本語 Confluence スペースへ
// 一方向同期するための決定的ヘルパー。翻訳と MCP 呼び出しは Claude(/sync-confluence
// スキル)が行い、このスクリプトはミラー生成・差分検知・push 用本文の出力・台帳更新
// だけを担当する。aidlc-workflows リポジトリのルートで実行すること。
//
// モード:
//   --bootstrap --site <翻訳サイト repo>   初回のみ。既存日本語訳からミラーと台帳を生成
//   --detect [--format text|json]          原文 HEAD と台帳を比較して分類
//   --emit <sourcePath>                    push 用の本文(リンク変換済み Markdown)を stdout へ
//   --record <sourcePath...>               同期完了したレコードの sourceCommit を HEAD に更新
//   --set-page <sourcePath> --page-id <id> [--version <n>]   ページ ID / バージョンを記録
//   --set-parent <dir> --page-id <id>      親ページの ID を記録
//   --remove <sourcePath>                  レコードとミラーを削除(原文削除の反映後に)

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const MANIFEST_PATH = "data/confluence-manifest.json";
const MIRROR_ROOT = "confluence-docs";

// サイトの meta.ts に定義されているセクション名。未定義のディレクトリは
// ディレクトリ名がそのまま仮タイトルになる(bootstrap が報告するので台帳を編集して直す)。
const SECTION_TITLES: Record<string, string> = {
	"docs/guide": "ユーザーガイド",
	"docs/guide/agents": "エージェント詳細",
	"docs/guide/harnesses": "他のハーネス",
	"docs/harness-engineering": "ハーネスエンジニアガイド",
	"docs/reference": "開発者リファレンス",
	"docs/reference/agents": "エージェント",
	"docs/reference/04-stages": "ステージ",
};

interface ParentEntry {
	dir: string;
	title: string;
	parentDir: string | null;
	pageId: string | null;
}

interface PageRecord {
	sourcePath: string;
	mirrorPath: string;
	route: string;
	title: string;
	sourceCommit: string;
	pageId: string | null;
	confluenceVersion: number | null;
}

interface Manifest {
	baseUrl: string;
	spaceKey: string;
	rootPageId: string;
	parents: ParentEntry[];
	records: PageRecord[];
}

function runGit(args: string[]): string {
	return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitFileExistsAtHead(filePath: string): boolean {
	try {
		execFileSync("git", ["cat-file", "-e", `HEAD:${filePath}`], {
			stdio: "ignore",
		});
		return true;
	} catch {
		return false;
	}
}

async function readManifest(): Promise<Manifest> {
	if (!existsSync(MANIFEST_PATH)) {
		throw new Error(
			`${MANIFEST_PATH} がありません。先に --bootstrap を実行してください。`,
		);
	}
	return JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as Manifest;
}

async function writeManifestAtomically(manifest: Manifest): Promise<void> {
	mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
	const temporaryPath = `${MANIFEST_PATH}.${process.pid}.tmp`;
	try {
		await writeFile(
			temporaryPath,
			`${JSON.stringify(manifest, null, "\t")}\n`,
			"utf8",
		);
		await rename(temporaryPath, MANIFEST_PATH);
	} finally {
		await rm(temporaryPath, { force: true });
	}
}

// ---------------------------------------------------------------------------
// MDX → プレーン Markdown 変換(bootstrap 時のみ使用)

interface Frontmatter {
	title: string;
	description: string;
	rest: string;
}

function splitFrontmatter(source: string): Frontmatter {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) {
		return { title: "", description: "", rest: source };
	}
	const pick = (key: string): string => {
		const line = match[1].match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
		return line ? line[1].trim().replace(/^["']|["']$/g, "") : "";
	};
	return {
		title: pick("title"),
		description: pick("description"),
		rest: source.slice(match[0].length),
	};
}

// インラインコード(バッククォート区間)の外側だけに変換を適用する。
function mapOutsideInlineCode(
	line: string,
	transform: (segment: string) => string,
): string {
	const parts = line.split(/(`+[^`]*`+)/);
	return parts
		.map((part, index) => (index % 2 === 0 ? transform(part) : part))
		.join("");
}

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;

function convertMdxBody(body: string): string {
	const lines = body.split("\n");
	const out: string[] = [];
	let fence: string | null = null;
	let seenContent = false;
	let commentBuffer: string[] | null = null;

	const flushComment = () => {
		const content = (commentBuffer ?? []).join(" ").trim();
		commentBuffer = null;
		const fallback = content.match(/^Text fallback:\s*(.*)$/s);
		if (fallback) {
			out.push(`*（図の説明: ${fallback[1].trim()}）*`);
		}
		// Text fallback 以外の MDX コメントは出力しない
	};

	for (const rawLine of lines) {
		const line = rawLine.replace(/\r$/, "");

		if (fence) {
			out.push(line);
			const close = line.match(FENCE_RE);
			if (
				close &&
				close[1][0] === fence[0] &&
				close[1].length >= fence.length
			) {
				fence = null;
			}
			continue;
		}

		if (commentBuffer) {
			const closeIndex = line.search(/\*\/\\?\}/);
			if (closeIndex >= 0) {
				commentBuffer.push(line.slice(0, closeIndex));
				flushComment();
			} else {
				commentBuffer.push(line);
			}
			continue;
		}

		const fenceOpen = line.match(FENCE_RE);
		if (fenceOpen) {
			fence = fenceOpen[1];
			out.push(line);
			seenContent = true;
			continue;
		}

		// 冒頭のサイト用パンくずリンク(> [AI-DLC ドキュメント](/) の一部 …)は
		// Confluence ではページツリーが担うため落とす。
		if (!seenContent && line.trim().startsWith("> [AI-DLC ドキュメント](")) {
			continue;
		}
		if (line.trim() !== "") {
			seenContent = true;
		}

		// MDX コメント {/* ... */}(エスケープ形 \{/* ... */\} を含む)。
		// mermaid の Text fallback は Confluence で図が描画されない代替として可視化する。
		const commentOpen = line.match(/^\s*\\?\{\/\*\s?(.*)$/);
		if (commentOpen) {
			const restOfLine = commentOpen[1];
			const closeIndex = restOfLine.search(/\*\/\\?\}/);
			if (closeIndex >= 0) {
				commentBuffer = [restOfLine.slice(0, closeIndex)];
				flushComment();
			} else {
				commentBuffer = [restOfLine];
			}
			continue;
		}

		let converted = mapOutsideInlineCode(line, (segment) =>
			segment
				.replace(/<a id="[^"]*"[^>]*>\s*<\/a>/g, "")
				.replace(/<a id="[^"]*"[^>]*\/>/g, ""),
		);

		// アンカー除去で空になった行は、直前も空行なら重ねない
		if (
			converted.trim() === "" &&
			line.trim() !== "" &&
			out[out.length - 1]?.trim() === ""
		) {
			continue;
		}
		out.push(converted);
	}

	return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

// ---------------------------------------------------------------------------
// ルート計算(サイトの lib/routes.ts と同じ規則)

const NUMERIC_PREFIX = /^\d+[-_.]/;

function routeForTranslationPath(translationPath: string): string {
	const segments = translationPath
		.replace(/^docs\//, "")
		.replace(/\.mdx?$/, "")
		.split("/")
		.map((segment) => segment.replace(NUMERIC_PREFIX, ""))
		.filter((segment) => segment !== "index");
	return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

function routeForSourcePath(sourcePath: string): string {
	const segments = sourcePath
		.replace(/^docs\//, "")
		.replace(/\.md$/, "")
		.split("/")
		.map((segment) => segment.replace(NUMERIC_PREFIX, ""))
		.filter((segment) => segment !== "index" && segment !== "README");
	return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

function mirrorPathForSource(sourcePath: string): string {
	return sourcePath.replace(/^docs\//, `${MIRROR_ROOT}/`);
}

// ---------------------------------------------------------------------------
// bootstrap

interface SiteRecord {
	sourcePath: string;
	translationPath: string;
	sourceCommit: string;
	route?: string;
}

async function bootstrap(siteRoot: string, force: boolean): Promise<void> {
	if (!force && (existsSync(MANIFEST_PATH) || existsSync(MIRROR_ROOT))) {
		throw new Error(
			`${MANIFEST_PATH} または ${MIRROR_ROOT}/ が既に存在します。やり直す場合は --force を付けてください。`,
		);
	}
	runGit(["rev-parse", "--show-toplevel"]);

	const siteManifestPath = path.join(
		siteRoot,
		"data/translation-manifest.json",
	);
	if (!existsSync(siteManifestPath)) {
		throw new Error(`翻訳サイトの台帳が見つかりません: ${siteManifestPath}`);
	}
	const siteRecords = (
		JSON.parse(await readFile(siteManifestPath, "utf8")) as {
			records: SiteRecord[];
		}
	).records;

	const warnings: string[] = [];
	const records: PageRecord[] = [];

	for (const siteRecord of siteRecords) {
		const translationAbsolute = path.join(
			siteRoot,
			siteRecord.translationPath,
		);
		if (!existsSync(translationAbsolute)) {
			warnings.push(`訳文ファイルなし(スキップ): ${siteRecord.translationPath}`);
			continue;
		}
		if (!gitFileExistsAtHead(siteRecord.sourcePath)) {
			warnings.push(
				`原文が HEAD に存在しない(detect で deleted 扱いになる): ${siteRecord.sourcePath}`,
			);
		}
		const source = await readFile(translationAbsolute, "utf8");
		const { title, description, rest } = splitFrontmatter(source);
		const body = convertMdxBody(rest);
		const mirrorPath = mirrorPathForSource(siteRecord.sourcePath);

		mkdirSync(path.dirname(mirrorPath), { recursive: true });
		const frontmatterLines = [`title: ${title}`];
		if (description) {
			frontmatterLines.push(`description: ${description}`);
		}
		await writeFile(
			mirrorPath,
			`---\n${frontmatterLines.join("\n")}\n---\n\n${body}`,
			"utf8",
		);

		records.push({
			sourcePath: siteRecord.sourcePath,
			mirrorPath,
			route:
				siteRecord.route ??
				routeForTranslationPath(siteRecord.translationPath),
			title,
			sourceCommit: siteRecord.sourceCommit,
			pageId: null,
			confluenceVersion: null,
		});
	}

	records.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

	// 親ページ: docs 直下より深いディレクトリすべて(中間ディレクトリも含む)
	const parentDirs = new Set<string>();
	for (const record of records) {
		let dir = path.posix.dirname(record.sourcePath);
		while (dir !== "docs" && dir !== ".") {
			parentDirs.add(dir);
			dir = path.posix.dirname(dir);
		}
	}
	const parents: ParentEntry[] = [...parentDirs].sort().map((dir) => {
		const ancestor = path.posix.dirname(dir);
		return {
			dir,
			title:
				SECTION_TITLES[dir] ??
				path.posix.basename(dir).replace(NUMERIC_PREFIX, ""),
			parentDir: parentDirs.has(ancestor) ? ancestor : null,
			pageId: null,
		};
	});
	for (const parent of parents) {
		if (!SECTION_TITLES[parent.dir]) {
			warnings.push(
				`セクション名が未定義: ${parent.dir} → 仮タイトル「${parent.title}」(台帳を編集して修正可)`,
			);
		}
	}

	// Confluence はスペース内でページタイトルが一意。重複はセクション名を付けて解消する。
	const titleCount = new Map<string, number>();
	const allTitled: { title: string }[] = [...records, ...parents];
	for (const entry of allTitled) {
		titleCount.set(entry.title, (titleCount.get(entry.title) ?? 0) + 1);
	}
	for (const record of records) {
		if ((titleCount.get(record.title) ?? 0) > 1) {
			const topSection = record.sourcePath.split("/").slice(0, 2).join("/");
			let suffix = SECTION_TITLES[topSection] ?? topSection;
			// セクション名そのものと同名のページ(セクション概要)は「概要」を付ける
			if (suffix === record.title) {
				suffix = "概要";
			}
			const renamed = `${record.title}（${suffix}）`;
			warnings.push(
				`タイトル重複を解消: ${record.sourcePath}: 「${record.title}」→「${renamed}」`,
			);
			record.title = renamed;
		}
	}

	const manifest: Manifest = {
		baseUrl: "",
		spaceKey: "",
		rootPageId: "",
		parents,
		records,
	};
	await writeManifestAtomically(manifest);

	process.stdout.write(
		[
			`ミラー生成完了: ${records.length} ページ → ${MIRROR_ROOT}/`,
			`台帳生成: ${MANIFEST_PATH}(baseUrl / spaceKey / rootPageId を記入してから初回 push すること)`,
			...(warnings.length > 0 ? ["", "警告:", ...warnings.map((w) => `  - ${w}`)] : []),
			"",
		].join("\n"),
	);
}

// ---------------------------------------------------------------------------
// detect

type SyncStatus = "current" | "changed" | "deleted" | "added" | "error";

interface DetectEntry {
	status: SyncStatus;
	sourcePath: string;
	mirrorPath: string | null;
	title: string | null;
	pageId: string | null;
	changeRatio: number | null;
	note?: string;
}

async function detect(format: "text" | "json"): Promise<void> {
	const manifest = await readManifest();
	const headCommit = runGit(["rev-parse", "HEAD"]);
	const entries: DetectEntry[] = [];

	for (const record of manifest.records) {
		const base = {
			sourcePath: record.sourcePath,
			mirrorPath: record.mirrorPath,
			title: record.title,
			pageId: record.pageId,
		};
		if (!gitFileExistsAtHead(record.sourcePath)) {
			entries.push({ ...base, status: "deleted", changeRatio: null });
			continue;
		}
		let diffOutput: string;
		try {
			diffOutput = runGit([
				"diff",
				record.sourceCommit,
				headCommit,
				"--numstat",
				"--",
				record.sourcePath,
			]);
		} catch {
			entries.push({
				...base,
				status: "error",
				changeRatio: null,
				note: `sourceCommit ${record.sourceCommit} がこのリポジトリに存在しません(fetch 不足?)`,
			});
			continue;
		}
		if (diffOutput === "") {
			entries.push({ ...base, status: "current", changeRatio: null });
			continue;
		}
		const [added, removed] = diffOutput.split("\t").map(Number);
		const currentLines = runGit([
			"show",
			`${headCommit}:${record.sourcePath}`,
		]).split("\n").length;
		entries.push({
			...base,
			status: "changed",
			changeRatio:
				Math.round(((added + removed) / Math.max(currentLines, 1)) * 100) /
				100,
		});
	}

	const knownSources = new Set(manifest.records.map((r) => r.sourcePath));
	const headDocs = runGit(["ls-tree", "-r", "HEAD", "--name-only", "docs"])
		.split("\n")
		.filter((file) => file.endsWith(".md"));
	for (const sourcePath of headDocs) {
		if (!knownSources.has(sourcePath)) {
			entries.push({
				status: "added",
				sourcePath,
				mirrorPath: mirrorPathForSource(sourcePath),
				title: null,
				pageId: null,
				changeRatio: null,
			});
		}
	}

	const summary = { added: 0, changed: 0, deleted: 0, current: 0, error: 0 };
	for (const entry of entries) {
		summary[entry.status] += 1;
	}
	const report = { headCommit, summary, entries };

	if (format === "json") {
		process.stdout.write(`${JSON.stringify(report, null, "\t")}\n`);
		return;
	}
	const lines = [
		`HEAD: ${headCommit}`,
		`Summary: added=${summary.added}, changed=${summary.changed}, deleted=${summary.deleted}, current=${summary.current}, error=${summary.error}`,
		"",
	];
	for (const entry of entries) {
		if (entry.status === "current") {
			continue;
		}
		const ratio =
			entry.changeRatio === null ? "" : ` (change ratio ${entry.changeRatio})`;
		lines.push(
			`${entry.status.toUpperCase()} ${entry.sourcePath}${ratio}${entry.note ? ` — ${entry.note}` : ""}`,
		);
	}
	if (entries.every((entry) => entry.status === "current")) {
		lines.push("全ファイル current — 更新なし");
	}
	process.stdout.write(`${lines.join("\n")}\n`);
}

// ---------------------------------------------------------------------------
// emit — push 用本文(frontmatter 除去 + サイトルートリンク → Confluence URL)

async function emit(sourcePathArg: string): Promise<void> {
	const manifest = await readManifest();
	const record = manifest.records.find(
		(r) => r.sourcePath === sourcePathArg || r.mirrorPath === sourcePathArg,
	);
	if (!record) {
		throw new Error(`台帳にレコードがありません: ${sourcePathArg}`);
	}
	if (!manifest.baseUrl || !manifest.spaceKey) {
		process.stderr.write(
			"警告: baseUrl / spaceKey が未設定のため内部リンクは変換されません\n",
		);
	}
	const byRoute = new Map(manifest.records.map((r) => [r.route, r]));
	const source = await readFile(record.mirrorPath, "utf8");
	const { rest } = splitFrontmatter(source);

	const warnings: string[] = [];
	const lines = rest.split("\n");
	const out: string[] = [];
	let fence: string | null = null;

	for (const line of lines) {
		if (fence) {
			out.push(line);
			const close = line.match(FENCE_RE);
			if (
				close &&
				close[1][0] === fence[0] &&
				close[1].length >= fence.length
			) {
				fence = null;
			}
			continue;
		}
		const fenceOpen = line.match(FENCE_RE);
		if (fenceOpen) {
			fence = fenceOpen[1];
			out.push(line);
			continue;
		}
		out.push(
			mapOutsideInlineCode(line, (segment) =>
				segment.replace(
					/(!?)\[([^\]]*)\]\((\/[^)#\s]*|)(#[^)]*)?\)/g,
					(whole, bang, text, route, _fragment) => {
						if (bang === "!") {
							return whole; // 画像は変換対象外
						}
						if (route === "" ) {
							// フラグメントのみ(#anchor)の同一ページ内リンクは Confluence で
							// 解決できないためテキストに落とす
							warnings.push(`ページ内アンカーをテキスト化: [${text}]`);
							return text;
						}
						const normalized =
							route.length > 1 ? route.replace(/\/+$/, "") : route;
						const target = byRoute.get(normalized);
						if (!target || !target.pageId || !manifest.baseUrl) {
							warnings.push(
								`未解決リンクをテキスト化: [${text}](${route}) — 対象ページ未作成なら作成後に再 emit + update`,
							);
							return text;
						}
						return `[${text}](${manifest.baseUrl}/spaces/${manifest.spaceKey}/pages/${target.pageId})`;
					},
				),
			),
		);
	}

	process.stdout.write(`${out.join("\n").trim()}\n`);
	for (const warning of [...new Set(warnings)]) {
		process.stderr.write(`警告: ${warning}\n`);
	}
}

// ---------------------------------------------------------------------------
// 台帳更新系

async function recordSources(sourcePaths: string[]): Promise<void> {
	if (sourcePaths.length === 0) {
		throw new Error("--record には sourcePath を 1 つ以上指定してください。");
	}
	const status = runGit(["status", "--short", "--", "docs"]);
	if (status.length > 0) {
		throw new Error("docs ツリーが clean ではありません。--record の前にコミットしてください。");
	}
	const manifest = await readManifest();
	const headCommit = runGit(["rev-parse", "HEAD"]);

	for (const sourcePath of sourcePaths) {
		const existing = manifest.records.find(
			(r) => r.sourcePath === sourcePath,
		);
		if (existing) {
			existing.sourceCommit = headCommit;
			continue;
		}
		// 新規レコード: ミラーが翻訳済みで存在することが前提
		const mirrorPath = mirrorPathForSource(sourcePath);
		if (!existsSync(mirrorPath)) {
			throw new Error(
				`新規レコード ${sourcePath} を追加できません: ミラー ${mirrorPath} が未作成です(先に翻訳してから --record)。`,
			);
		}
		const { title } = splitFrontmatter(await readFile(mirrorPath, "utf8"));
		if (!title) {
			throw new Error(`${mirrorPath} の frontmatter に title がありません。`);
		}
		manifest.records.push({
			sourcePath,
			mirrorPath,
			route: routeForSourcePath(sourcePath),
			title,
			sourceCommit: headCommit,
			pageId: null,
			confluenceVersion: null,
		});
	}
	manifest.records.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
	await writeManifestAtomically(manifest);
	process.stdout.write(`記録しました: ${sourcePaths.join(", ")} @ ${headCommit}\n`);
}

async function setPage(
	sourcePath: string,
	pageId: string,
	version: number | null,
): Promise<void> {
	const manifest = await readManifest();
	const record = manifest.records.find((r) => r.sourcePath === sourcePath);
	if (!record) {
		throw new Error(`台帳にレコードがありません: ${sourcePath}`);
	}
	record.pageId = pageId;
	if (version !== null) {
		record.confluenceVersion = version;
	}
	await writeManifestAtomically(manifest);
	process.stdout.write(
		`set-page: ${sourcePath} → pageId=${pageId}${version !== null ? `, version=${version}` : ""}\n`,
	);
}

async function setParent(dir: string, pageId: string): Promise<void> {
	const manifest = await readManifest();
	const parent = manifest.parents.find((p) => p.dir === dir);
	if (!parent) {
		throw new Error(`台帳に親ディレクトリがありません: ${dir}`);
	}
	parent.pageId = pageId;
	await writeManifestAtomically(manifest);
	process.stdout.write(`set-parent: ${dir} → pageId=${pageId}\n`);
}

async function removeRecord(sourcePath: string): Promise<void> {
	const manifest = await readManifest();
	const index = manifest.records.findIndex(
		(r) => r.sourcePath === sourcePath,
	);
	if (index < 0) {
		throw new Error(`台帳にレコードがありません: ${sourcePath}`);
	}
	const [removed] = manifest.records.splice(index, 1);
	await writeManifestAtomically(manifest);
	await rm(removed.mirrorPath, { force: true });
	process.stdout.write(
		`削除しました: ${sourcePath}(ミラー ${removed.mirrorPath} も削除。Confluence ページ ${removed.pageId ?? "未作成"} の整理は MCP 側で)\n`,
	);
}

// ---------------------------------------------------------------------------
// CLI

interface CliArgs {
	mode:
		| "bootstrap"
		| "detect"
		| "emit"
		| "record"
		| "set-page"
		| "set-parent"
		| "remove";
	site?: string;
	force: boolean;
	format: "text" | "json";
	target?: string;
	paths: string[];
	pageId?: string;
	version: number | null;
}

function parseCliArgs(argv: string[]): CliArgs {
	const args: CliArgs = {
		mode: "detect",
		force: false,
		format: "text",
		paths: [],
		version: null,
	};
	let modeSet = false;
	const setMode = (mode: CliArgs["mode"]) => {
		if (modeSet) {
			throw new Error("モードフラグは 1 つだけ指定してください。");
		}
		args.mode = mode;
		modeSet = true;
	};

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		const next = (): string => {
			const value = argv[index + 1];
			if (!value) {
				throw new Error(`${argument} の値がありません。`);
			}
			index += 1;
			return value;
		};
		switch (argument) {
			case "--bootstrap":
				setMode("bootstrap");
				break;
			case "--detect":
				setMode("detect");
				break;
			case "--emit":
				setMode("emit");
				args.target = next();
				break;
			case "--record":
				setMode("record");
				break;
			case "--set-page":
				setMode("set-page");
				args.target = next();
				break;
			case "--set-parent":
				setMode("set-parent");
				args.target = next();
				break;
			case "--remove":
				setMode("remove");
				args.target = next();
				break;
			case "--site":
				args.site = next();
				break;
			case "--force":
				args.force = true;
				break;
			case "--format": {
				const format = next();
				if (format !== "text" && format !== "json") {
					throw new Error(`--format の値が不正です: ${format}`);
				}
				args.format = format;
				break;
			}
			case "--page-id":
				args.pageId = next();
				break;
			case "--version":
				args.version = Number(next());
				break;
			default:
				if (argument.startsWith("--")) {
					throw new Error(`不明な引数: ${argument}`);
				}
				args.paths.push(argument.split(path.sep).join("/"));
		}
	}
	return args;
}

if (import.meta.main) {
	try {
		const args = parseCliArgs(process.argv.slice(2));
		switch (args.mode) {
			case "bootstrap": {
				if (!args.site) {
					throw new Error(
						"--bootstrap には --site <翻訳サイト repo のパス> が必要です。",
					);
				}
				await bootstrap(path.resolve(args.site), args.force);
				break;
			}
			case "detect":
				await detect(args.format);
				break;
			case "emit":
				await emit(args.target ?? "");
				break;
			case "record":
				await recordSources(args.paths);
				break;
			case "set-page": {
				if (!args.pageId) {
					throw new Error("--set-page には --page-id が必要です。");
				}
				await setPage(args.target ?? "", args.pageId, args.version);
				break;
			}
			case "set-parent": {
				if (!args.pageId) {
					throw new Error("--set-parent には --page-id が必要です。");
				}
				await setParent(args.target ?? "", args.pageId);
				break;
			}
			case "remove":
				await removeRecord(args.target ?? "");
				break;
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`${message}\n`);
		process.exit(1);
	}
}
