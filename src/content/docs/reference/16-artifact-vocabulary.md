---
title: アーティファクト用語集
description: AI-DLC のアーティファクト名、命名規則、レジストリ導出、ファイルシステム上の配置に関するリファレンス。
sidebarOrder: 16
sourcePath: docs/reference/16-artifact-vocabulary.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 3f56d0e01949ace364115ea243417ec22c1780f5d6d8fcb995fb824a00959948
translationStatus: current
---
<a id="artifact-vocabulary"></a>
# アーティファクト用語集

本章は、各ステージの YAML フロントマターにある `produces:` と
`consumes[].artifact:` で使用される、AI-DLC アーティファクト名の正規文字列に
関する規則です。命名形式、衝突解決ポリシー、ファイルシステムのパス規約、
コマンドラインからライブレジストリを確認する方法を扱います。

レジストリ自体は**記述するものではなく導出されるもの**です。存在する正規名の
権威ある情報源は、すべてのステージファイルの `produces[]` フィールドと、各
ステージの `optional_produces[]`（ユニットごとに条件付きで書き込まれる
アーティファクト。フィールドの説明は `15-stage-definition.md` を参照）の和集合
です。そのため、条件付きで生成される名前も登録されたままとなり、生成元を
解決できます。`dist/claude/.claude/tools/aidlc-graph.ts` のヘルパーはコンパイル済み
ステージグラフを読み取り、その和集合を集合として返します。これはスコープ
（`aidlc-lib.ts:772` の `validScopes()`）やエージェント
（`aidlc-lib.ts:794` の `loadAgents()`）と同じパターンです。本章にレジストリを
列挙しないことで、並行して手管理されるリストに起きやすい乖離を防ぎます。

---

<a id="what-an-artifact-is-here"></a>
## ここでいうアーティファクト

アーティファクトとは、YAML フロントマター内でちょうど 1 つの生成ステージが
宣言する**正規識別子**です。他のステージは、読み取り依存関係を宣言するために
`consumes[]` で同じ識別子を参照します。識別子は短いハイフン区切りの文字列であり、
ファイル拡張子、フォルダ接頭辞、スラッシュは含みません。

`dist/claude/.claude/aidlc-common/protocols/stage-definition.md` にある
マイルストーン 4 の具体例は次のとおりです。

```yaml
slug: scope-definition
# ...
produces:
  - scope-document
  - intent-backlog
  - scope-definition-questions
consumes:
  - artifact: intent-statement
    required: true
  - artifact: feasibility-assessment
    required: false
```

ここで `scope-document`、`intent-backlog`、`scope-definition-questions` は
`scope-definition` ステージが生成するアーティファクトです。`intent-statement` と
`feasibility-assessment` は、このステージが消費するアーティファクトであり、
それぞれ別の `intent-capture`、`feasibility` ステージが生成します。

このレジストリにおいて**アーティファクトではないもの**は次のとおりです。

- **ファイルパス。** `<record>/ideation/scope-definition/scope-document.md`
  （`<record>/` はインテントのレコードディレクトリ
  `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`）はファイルシステム上の
  場所であり、正規名は `scope-document` です。後述の「ファイルシステムへの
  マッピング」を参照してください。
- **ファイル名。** ディスク上の `.md` ファイルと正規名は一致する必要が
  ありません（衝突時を除けば、通常は一致します）。
- **状態管理用ファイル。** `aidlc-state.md`、`audit.md`、`.aidlc-recovery.md` は
  `produces[]` を通じてステージが管理するのではなく、ツール
  （`aidlc-state.ts`、フックスクリプト）が管理します。レジストリには決して
  現れません。
- **実行時の値。** 「ユーザーの自由記述回答」や「ワークスペース分類
  （新規開発/既存資産あり）」のような文字列は動的なデータであり、永続する
  ステージ間アーティファクトではありません。

---

<a id="the-derivation-rule"></a>
## 導出規則

1. **ステージファイルが権威を持ちます。** 各ステージの `produces:` リストは、
   そのステージが出力するすべての正規名を宣言します。`consumes:` は、その
   ステージが依存する正規文字列を指定します。
2. **レジストリは記述せず、計算します。**
   `bun dist/claude/.claude/tools/aidlc-graph.ts artifacts` を実行すると、ライブ
   レジストリが名前ごとに 1 行、アルファベット順で出力されます。このツールは
   コンパイル済み `stage-graph.json` にある全ステージの `produces[]` の和集合を
   取ります。
3. **本章に並行リストは置きません。** 一覧が必要な場合はツールを実行します。
   本章で正規名をレジストリ表として列挙することはありません。
4. **所属は診断機能が検証します。** `/aidlc --doctor` は「グラフ参照」
   チェック（`aidlc-utility.ts`）を実行します。すべての
   `consumes[].artifact` エントリと `requires_stage[]` の識別子は導出済み
   レジストリに解決できなければなりません。孤立した消費側は壊れた参照として
   報告されます。

32 個のステージファイルはすべて `produces:` を宣言しているため、導出結果には
レジストリ全体が含まれます。ツールは空のデータに対しても明確に定義されています。
`produces:` を持たないステージは単に何も追加しません。ただし、配布される
フレームワークではすべてのステージに値があります。

---

<a id="naming-rules"></a>
## 命名規則

すべての正規名は、`dist/claude/.claude/tools/aidlc-stage-schema.ts` の
`SLUG_RE` が強制する `/^[a-z][a-z0-9-]*$/` に一致しなければなりません。つまり、
次のとおりです。

- **小文字のみ。** `ScopeDocument` や `SCOPE_DOCUMENT` ではなく
  `scope-document`。
- **ファイル拡張子なし。** `scope-document.md` ではなく `scope-document`。
- **フォルダ接頭辞・スラッシュなし。**
  `ideation/scope-definition/scope-document` ではなく `scope-document`。
- **英字で開始。** `s1` は有効ですが、`1-thing` は無効です。
- **途中に使用できるのはハイフン、数字、小文字の英字のみ。** アンダースコア、
  空白、ユニコード文字は使えません。

質問アーティファクトには慣例として `<stage-slug>-questions` を用います。ユーザー
入力を収集するステージは、主な成果物と並べて `<slug>-questions` という正規名を
宣言します。これはパーサー規則ではなく慣例です。

形式は**フラットな名前空間**です。`<phase>/<stage>/<artifact>` のような階層的な
接頭辞は使いません。これは AI-DLC の他の識別子とも一致します。エージェント識別子、
スコープ名、ステージ識別子、フェーズ名はすべてフラットなハイフン区切りです。

---

<a id="collision-policy"></a>
## 衝突ポリシー

2 つのステージが `produces[]` リストで同じ正規名を宣言しては**なりません**。
レジストリは集合であるため、名前はグローバルに一意でなければなりません。同じ
基礎概念を 2 つのステージが出力する場合は、区別できる 2 つの異なる名前を選びます。

現時点の例は 1 つです。`build-and-test`（構築）と
`performance-validation`（運用）は、どちらも `test-results.md` という
ファイルを書き込みます。ワイヤ上で衝突しないように、正規名は分けられています。

- `build-test-results` — `build-and-test` が出力します。このステージでは
  `build-instructions`、`unit-test-instructions`、
  `integration-test-instructions`、`performance-test-instructions`、
  `security-test-instructions`、`build-and-test-summary` と対になります。
- `load-test-results` — `performance-validation` が出力します。同じステージが
  すでに出力する `load-test-plan` と対になります。

両方の名前は現在、それぞれのステージの `produces:` リストに含まれています。

**ディスク上のファイル名は一致する必要がありません。** 両ステージはそれぞれの
フォルダで `test-results.md` を書き続けられます。正規名はファイル名ではなく、
ワイヤ上の識別子です。

---

<a id="filesystem-mapping"></a>
## ファイルシステムへのマッピング

アーティファクトのディスク上のパスは、`(正規名) + (生成ステージ) + (ユニット単位
フラグ)` から導出できます。現在の形は 2 種類です。

- **ユニット単位ではないステージ（29 件中 24 件）：**
  `<record>/<phase>/<stage>/<canonical-name>.md`
  例：アイデア創出の `feasibility` ステージが生成する
  `feasibility-assessment` は、
  `<record>/ideation/feasibility/feasibility-assessment.md` にあります。

- **ユニット単位の構築ステージ（29 件中 5 件）：**
  `nfr-requirements`、`nfr-design`、`functional-design`、
  `infrastructure-design`、`code-generation`。これらは構築中に
  作業単位ごとに各アーティファクトを 1 つ出力します。
  `<record>/construction/{unit-name}/<stage>/<canonical-name>.md`
  例：`functional-design` が生成する `business-logic-model` は、
  `<record>/construction/{unit-name}/functional-design/business-logic-model.md`
  にあります。

ユニット単位かどうかは、ステージフロントマターの
`for_each: unit-of-work` フィールドで宣言されます。作業単位ごとに一度実行される
5 つの構築ステージにはこれがあり、他のステージにはありません。将来的な
ヘルパーは、ステージグラフと正規名から機械的にパスを計算できます。

**コード知識ベースはスペースレベルの例外です。** リバースエンジニアリングの 9 つの
アーティファクト（`business-overview`、`architecture`、`code-structure`、
`api-documentation`、`component-inventory`、`technology-stack`、
`dependencies`、`code-quality-assessment`、`reverse-engineering-timestamp`）は、
インテントごとのレコードディレクトリ以下には解決されません。インテントではなく
リポジトリをキーとし、スペース内のすべてのインテントで共有される永続的な
リポジトリ単位のコード知識ベース
`aidlc/spaces/<space>/codekb/<repo>/` に格納されます。パスは
`resolveArtifactPath` の `isCodekb` 分岐
（`dist/claude/.claude/tools/aidlc-orchestrate.ts`）により、レコード相対規則の
外で解決されます。同じディレクトリは読み取り専用の `/aidlc codekb-path` コマンド
でも出力されます。

**衝突時は正規名とファイル名が異なります。** 衝突を分割した場合（上記参照）、
ディスク上のファイル名は分割前の形式（`test-results.md`）を維持できますが、正規名は
区別済みの形式になります。ファイルシステムではなく、ステージの `produces:` リストと
`bun aidlc-graph.ts artifacts` を情報源として使用してください。

---

<a id="how-to-view-the-live-registry"></a>
## ライブレジストリの確認方法

```bash
bun dist/claude/.claude/tools/aidlc-graph.ts artifacts
```

正規名を 1 行に 1 件、アルファベット順で出力します。

PR-8 前の出力は空です。ステージがまだ YAML に移行しておらず、`produces:` が
設定されていないためです。PR-8 後には、29 の非初期化ステージにまたがるおよそ
118 件の名前まで増えます。

件数を調べるには `wc -l`、絞り込みには `grep`、乖離チェックには期待するベースライン
との `diff` にパイプしてください。

---

<a id="adding-or-renaming-an-artifact"></a>
## アーティファクトの追加または名前変更

レジストリは導出されるため、本章を編集する必要はありません。

**新しいアーティファクトを追加するには：**

1. 生成ステージの `.md` ファイルを編集し、正規名を `produces:` リストへ追加します。
2. `bun aidlc-graph.ts artifacts` を実行し、名前が表示されることを確認します。
3. `/aidlc --doctor` を実行し、消滅した名前を参照する消費側がないことを確認します
   （「グラフ参照」チェック）。

**アーティファクト名を変更するには：**

1. 生成ステージの `produces:` エントリで名前を変更します。
2. 消費する各ステージの `consumes[].artifact` エントリでも名前を変更します。
3. `/aidlc --doctor`（PR-11 後）は更新を忘れた消費側を検出します。古い名前は
   生成元不明エラーになります。

ステージグラフの CI 乖離検出（`aidlc-graph compile --check`）は、YAML ソースから
`stage-graph.json` を再生成し忘れた名前変更を検出します。

---

<a id="stability"></a>
## 安定性

バージョン 1.0 出荷時点のライブレジストリが、フレームワークにおけるアーティファクト表面の
安定性ベースラインです。アーティファクト名の安定性ポリシーは次のとおりです。

- **名前変更**と**削除**はメジャーバージョンの変更です。1.x → 2.0。
- **追加**はマイナーバージョンで提供します。1.0 → 1.1 など。
- **バージョン 1.0 まで進行中：** 現行の 0.3.0 基盤セットを出発点とし、後続の
  0.4.0～0.11.0 リリースでは、方法論の進化に応じて名前の追加、変更、削除が
  行われる可能性があります。

このポリシーはライブデータに対して強制可能です。タグ時点のレジストリと HEAD の
レジストリの乖離は、1 行の `diff` で確認できます。

---

<a id="cross-references"></a>
## 相互参照

- `dist/claude/.claude/aidlc-common/protocols/stage-definition.md` —
  権威あるステージ形式仕様。`produces[]` / `consumes[]` を構造化フィールドとして
  定義します。
- [ステージ定義](15-stage-definition.md) — 仕様を説明する章。
- [状態機械](12-state-machine.md) — 監査イベントの並行する導出パターン。正規の
  列挙型は文書ではなく `aidlc-audit.ts` にあります。
- [ユーザーガイド — アーティファクトリファレンス](../guide/14-artifacts-reference.md)
  — ユーザー向けのアーティファクトライフサイクルとディレクトリ構成。
- `dist/claude/.claude/tools/aidlc-graph.ts` — 導出ツール
  （`artifactsRegistry()` と `artifacts` CLI サブコマンド）。
