import { describe, expect, it } from "vitest";

import { collectTerminologyErrors } from "../../lib/terminology-lint";

describe("collectTerminologyErrors", () => {
	it("長音符が欠落した表記を行番号つきで報告する", () => {
		const body = [
			"オーケストレーターは正しい表記です。",
			"オーケストレータが起動する。",
			"サーバ環境とユーザ設定。",
		].join("\n");

		const errors = collectTerminologyErrors("docs/sample.mdx", body);

		expect(errors).toEqual([
			"terminology drift in docs/sample.mdx:2: 「オーケストレータ」は「オーケストレーター」に統一する",
			"terminology drift in docs/sample.mdx:3: 「サーバ」は「サーバー」に統一する",
			"terminology drift in docs/sample.mdx:3: 「ユーザ」は「ユーザー」に統一する",
		]);
	});

	it("正しい表記と正当な派生語には反応しない", () => {
		const body = [
			"オーケストレーターがサーバーレス環境でユーザーを認証する。",
			"ユーザビリティの検証を行う。",
		].join("\n");

		expect(collectTerminologyErrors("docs/sample.mdx", body)).toEqual([]);
	});

	it("コードフェンス内とインラインコード内は検査しない", () => {
		const body = [
			"本文です。",
			"```bash",
			"echo サーバ設定",
			"```",
			"インラインの `ユーザ` は対象外。",
		].join("\n");

		expect(collectTerminologyErrors("docs/sample.mdx", body)).toEqual([]);
	});

	it("4 バッククォートのフェンス内にある ``` を閉じ扱いしない", () => {
		const body = [
			"````text",
			"サーバ設定",
			"```",
			"ユーザ設定",
			"````",
			"フェンス後のオーケストレータ。",
		].join("\n");

		expect(collectTerminologyErrors("docs/sample.mdx", body)).toEqual([
			"terminology drift in docs/sample.mdx:6: 「オーケストレータ」は「オーケストレーター」に統一する",
		]);
	});
});
