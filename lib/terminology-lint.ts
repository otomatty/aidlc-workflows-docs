/**
 * 用語・表記揺れの lint。
 * .claude/skills/sync-docs/terminology.md の対訳表で確立した表記から
 * 逸脱しやすいパターン(長音符の欠落など)を検出する。
 * コードフェンス内とインラインコード内は検査対象外。
 */

export interface TerminologyRule {
	/** 1 行単位で照合するパターン(g フラグ付き) */
	pattern: RegExp;
	/** 期待する表記 */
	expected: string;
}

// パターンは「誤記のみに一致し、正しい表記には一致しない」よう否定先読み・後読みで絞る。
// 例: /サーバ(?!ー)/ は「サーバ環境」に一致し「サーバー」「サーバーレス」には一致しない。
// (?<!セン) は「センサーバインディング」(センサー+バインディング)の誤検知を防ぐ。
export const TERMINOLOGY_RULES: readonly TerminologyRule[] = [
	{ pattern: /オーケストレータ(?!ー)/g, expected: "オーケストレーター" },
	{ pattern: /(?<!セン)サーバ(?!ー)/g, expected: "サーバー" },
	{ pattern: /ユーザ(?!ー|ビリティ)/g, expected: "ユーザー" },
	{ pattern: /コンピュータ(?!ー)/g, expected: "コンピューター" },
];

const FENCE_LINE_PATTERN = /^\s*(`{3,}|~{3,})/;
const INLINE_CODE_PATTERN = /`[^`]*`/g;

/**
 * ファイル全文(frontmatter 込み)を行単位で走査し、表記揺れをエラー文字列として返す。
 * 行番号を実ファイルと一致させるため frontmatter は除去せずに渡すこと
 * (title/description の値も日本語なので検査対象に含めてよい)。
 * フェンスは開始時のマーカー長を記録し、同じ長さ以上のマーカーで閉じる
 * (CommonMark 準拠。4 バッククォートのフェンス内に ``` があっても閉じ扱いしない)。
 */
export function collectTerminologyErrors(
	displayPath: string,
	body: string,
): string[] {
	const errors: string[] = [];
	let openFenceLength = 0;

	body.split(/\r?\n/).forEach((line, lineIndex) => {
		const fenceMatch = line.match(FENCE_LINE_PATTERN);

		if (fenceMatch) {
			const markerLength = fenceMatch[1].length;
			if (openFenceLength === 0) {
				openFenceLength = markerLength;
			} else if (markerLength >= openFenceLength) {
				openFenceLength = 0;
			}
			return;
		}

		if (openFenceLength > 0) {
			return;
		}

		const proseOnly = line.replace(INLINE_CODE_PATTERN, "");

		for (const rule of TERMINOLOGY_RULES) {
			for (const match of proseOnly.matchAll(rule.pattern)) {
				errors.push(
					`terminology drift in ${displayPath}:${lineIndex + 1}: 「${match[0]}」は「${rule.expected}」に統一する`,
				);
			}
		}
	});

	return errors;
}
