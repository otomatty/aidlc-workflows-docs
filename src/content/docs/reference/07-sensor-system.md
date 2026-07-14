---
title: センサーシステム
description: ステージ出力への書き込み時に発火する AI-DLC センサーマニフェストのスキーマと解決モデルを定義します。
sidebarOrder: 7
sourcePath: docs/reference/07-sensor-system.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: bb666e5bafe7708b86d73f7a1fad07ea1c7368bdd8cb514b730e72771d21e596
translationStatus: current
---

<a id="sensor-system"></a>
# センサーシステム

> 対象読者: ティア 2/3（チーム導入者、フレームワークコントリビューター）。

この章は、AI-DLC のセンサーマニフェスト、つまりステージ出力への書き込み時に発火する決定論的チェックの**スキーマリファレンス**です。センサーは制御ループにおけるフィードバック側であり、ルールはフィードフォワード側です（次章の [ルールシステム](08-rule-system.md) を参照）。[プレーンアーキテクチャ](02-plane-architecture.md) は、両者を各ステージノードへ解決されるコントロールプレーン入力として位置付けます。

この章が扱うのはマニフェストの**ファイル形式**です。センサーマニフェストに何が含まれるか、ステージがどうセンサーをインポートするか、出荷済み 4 つのマニフェストがどう設定されているかを説明します。ワークフロー中にセンサーがどう発火するかという利用者向け視点は、ユーザーガイドの [ルールと学習ループ](../guide/09-rules-and-the-learning-loop.md) を参照してください。

> **パス規約。** 以下の `<record>/` はアクティブな意図の記録ディレクトリ、つまり `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` を指します（UTC 日付の短い接頭辞と短いケバブケースのラベルを持ち、記録ディレクトリが時系列順に並ぶ形です。正準 ID は `intents.json` の行にある UUIDv7 です）。なお、出荷済みの 2 つの文書形状センサーの `matches` グロブは、現在でも旧来の成果物ツリーのパス形状を保持しており、以下ではスキーマ説明のためにその値を逐語で引用します。

実行時振る舞いは [ステージプロトコル](04-stage-protocol.md) を参照してください。ステージ定義という並行するファイル形式については [ステージ定義](15-stage-definition.md) を参照してください。

---

<a id="manifest-location-and-filename"></a>
## マニフェストの配置とファイル名

センサーマニフェストは次の場所にあります。

```
dist/claude/.claude/sensors/aidlc-<id>.md
```

フレームワーク同梱のすべてのマニフェストは、より広いフレームワークファイル規約に合わせて `aidlc-` というファイル名接頭辞を持ちます。メタデータ部の `id:` フィールドは、ファイル名の語幹から `aidlc-` 接頭辞を外し、`.md` を除いたものと**必ず一致**しなければなりません。

| ファイル名 | 必須の `id:` |
|---|---|
| `aidlc-required-sections.md` | `required-sections` |
| `aidlc-linter.md` | `linter` |

このファイル名と識別子の規則は `tests/unit/t86-sensor-manifest-schema.sh` で強制されています。`aidlc-` 接頭辞は、**ユーザー定義のカスタムセンサーでも必須**です。コンパイル解決器は `SENSOR_FILE_REGEX = /^aidlc-([a-z][a-z0-9-]*)\.md$/`（`aidlc-graph.ts` の `loadSensors`）でマニフェストを発見するため、接頭辞のないファイルは黙って無視され、どのステージにも束縛されません。カスタムセンサーは `aidlc-<id>.md` と命名し、`id: <id>` を設定してください。

---

<a id="sensor-manifest-schema"></a>
## センサーマニフェストのスキーマ

各マニフェストは、YAML メタデータ部と本文を持つ Markdown ファイルです。メタデータ部が構造化契約、つまり純粋な機能記述子であり、本文はそのチェックを説明する人向け文書です。マニフェストは*そのセンサーが何か*を記述し、どのステージが使うかは持ちません。その関係は、ステージ側のメタデータ部にある `sensors:` フィールドによって表現されます（後述の [ステージがセンサーをインポートする仕組み](#how-stages-import-sensors) を参照）。

```yaml
---
id: required-sections                       # required
kind: deterministic                          # required
command: bun .claude/tools/aidlc-sensor-required-sections.ts   # required
default_severity: advisory                   # required
description: Checks that stage output ...    # required
category: document-shape                     # optional
matches: "**/{aidlc-docs,intents}/**"                  # optional capability filter
input_schema:                                # optional
  output_path: string
  stage_slug: string
output_schema:                               # optional
  pass: boolean
  missing_headings: string[]
timeout_seconds: 5                           # optional
---

# required-sections sensor

<body — prose documenting default mode, override mode, failure mode>
```

| 項目 | 必須 | 型 | 注記 |
|---|---|---|---|
| `id` | ✓ | ケバブケース文字列 | `aidlc-` 接頭辞を除いたファイル名の語幹と一致します。ルールファイルの `pairing:` フィールドから相互参照されます（[ルールシステム](08-rule-system.md) を参照）。 |
| `kind` | ✓ | 列挙値 | 現在受け入れられるのは `deterministic` だけです。`llm` はバージョン 0.11.0 の LLM ディスパッチ章向け予約値です。下の [`kind` 列挙値](#kind-enum) を参照してください。 |
| `command` | ✓ | 文字列 | 正準な呼び出し接頭辞です。各出荷済みセンサーは自分専用のスクリプトを指します（例: `bun .claude/tools/aidlc-sensor-required-sections.ts`）。ディスパッチャー（`aidlc-sensor.ts`）は、常に `--stage <slug>` を付け足し、その後に入力形状に応じたファイルフラグを追加します。文書センサーは `--output-path <path>`、コードセンサー（`linter`, `type-check`）は `--file-path <path>` です。 |
| `default_severity` | ✓ | 列挙値 | 現在受け入れられるのは `advisory` だけです。`blocking` は将来予約です。 |
| `description` | ✓ | 文字列 | 1 行の人向け説明。 |
| `category` | 任意 | 文字列 | 自由形式の説明ラベル。出荷済み 4 マニフェストでは `document-shape` と `code-quality` を使っています。閉じた列挙値ではありません。 |
| `matches` | 任意 | グロブ文字列 | 発火時に `PostToolUse` フックが読む機能フィルターです。詳しくは [`matches` フィルター](#matches-filter) を参照してください。 |
| `input_schema` | 任意 | オブジェクト | 現在は助言用途ですが、将来の LLM ディスパッチではテンプレート契約として使われます。 |
| `output_schema` | 任意 | オブジェクト | 現在は助言用途ですが、将来の LLM ディスパッチでは解析契約として使われます。 |
| `timeout_seconds` | 任意 | 整数 | 1 回の発火に対する実時間上限。 |

---

<a id="kind-enum"></a>
## `kind` 列挙値

`kind` フィールドはディスパッチ方式を宣言します。現在スキーマが受け入れる値は 1 つだけです。

- `deterministic` — マニフェストの `command:` が自己完結したシェル呼び出しであり、0（成功）/ 非 0（失敗）で終了し、構造化された詳細を既知パスへ書き出します。

`llm` は **LLM ディスパッチ章**（バージョン 0.11.0 以降）のために予約されています。その章が出荷されるまでは、コンシューマーは `kind: llm` を解析時に拒否しなければなりません。予約は書き込み時点で強制されており、現時点で `kind: llm` のマニフェストを出荷することはマニフェスト作成者のエラーです。

`kind` に対する未知値、つまり `deterministic` 以外は解析時に拒否されます。前方互換が適用されるのは*未知のキー*であって、既知キーへの未知値ではありません（[前方互換ポリシー](#forward-compat-policy) を参照）。

---

<a id="how-stages-import-sensors"></a>
## ステージがセンサーをインポートする仕組み

著述方向はプルです。各ステージはメタデータ部で、自分が使うセンサーを宣言します。コンパイル解決器は宣言された各 ID をマニフェストレジストリで引き当て、コンパイル済みグラフノードに `sensors_applicable` 配列として焼き込みます。著述方向が局所参照性を保つため、ステージファイルを開けば、そのステージ実行時にどのチェックが走るかをその場で確認できます。

```yaml
# dist/claude/.claude/aidlc-common/stages/construction/code-generation.md
---
slug: code-generation
phase: construction
# ...
requires_stage: [...]
sensors:
  - linter
  - type-check
inputs: ...
outputs: ...
---
```

`sensors:` は接頭辞なし識別子の一覧です。各 ID は、各マニフェストのメタデータ部にある `id:` フィールドに一致します。これはファイル名と識別子の契約により、`aidlc-` を除いたファイル名の語幹です。コンパイル解決器は次の処理を行います。

1. `dist/claude/.claude/sensors/` を走査し、`aidlc-<id>.md` 形式のマニフェストをすべて解析する。
2. 解決時に O(1) で引けるよう、識別子で索引化する。
3. 各ステージについて、宣言された各インポート識別子を引く。未知の識別子はコンパイル時に明示的な失敗とする。発火時に静かに失敗させない。
4. マニフェストの `matches` フィルターを、そのまま解決済み `sensors_applicable[]` エントリへコピーする。
5. ステージごとの解決済み配列を、正準の `data/stage-graph.json` に出力する（`FIELD_ORDER` では `rules_in_context` の後に固定）。

実行時の `PostToolUse` フック（`aidlc-sensor-fire.ts`）は、グラフノードの `sensors_applicable` を読みます。マニフェストを再度開きません。`matches` はコンパイル時のスナップショットです。ワークフロー中にマニフェストを編集しても、その進行中ワークフローで何が発火するかは変わりません。これは BGP 的な安定性特性です（[プレーンアーキテクチャ](02-plane-architecture.md) を参照）。

<a id="per-stage-sensor-matrix-32-framework-stages"></a>
### ステージごとのセンサーマトリクス（フレームワーク 32 ステージ）

| ステージ | `sensors:` |
|---|---|
| 3 つの初期化（ワークスペース足場作成、ワークスペース検出、状態初期化） | `[]`（決定論的セットアップであり、エージェント著述 Markdown がない） |
| 構想 7、立ち上げ 8、運用 7 の Markdown ステージと `code-generation` | Markdown ステージは `[required-sections, upstream-coverage]`、`code-generation` は `[linter, type-check]`（コードのみ） |
| `build-and-test` | `[required-sections, upstream-coverage, type-check]`（`linter` は意図的に除外。ビルドが正準のリントを走らせるため） |
| 5 つの構築設計（CI パイプライン、機能設計、インフラ設計、NFR 設計、NFR 要件） | `[required-sections, upstream-coverage, linter, type-check]`（コード断片を含む Markdown 設計） |

フォーク側でのカスタマイズは、ステージの `sensors:` 一覧を直接編集して行います。束縛は、カスタマイズ対象のすぐ隣にあります。マニフェストは純粋な機能記述子であり、ステージ対象化フィールドは持ちません。`applies_to:` はありません。プル型の著述により除去されました。厳密加算の実行時モデルが適用されるので、フォークがあるセンサーをあるステージへ付けたいならインポートし、不要なら書かなければよいだけです。上書きレイヤーを考える必要はありません。

---

<a id="matches-filter"></a>
## `matches` フィルター

`matches` は、マニフェスト上の任意トップレベル機能記述子です。センサーが解析できるファイル形状のグロブ、つまり*"このセンサーはこのグロブに一致するファイルを解析する"* を宣言します。これはコンパイル時ではなく、発火時に `PostToolUse` フックが消費します。

| マニフェスト | `matches` |
|---|---|
| `aidlc-required-sections.md` | `**/{aidlc-docs,intents}/**` |
| `aidlc-upstream-coverage.md` | `**/{aidlc-docs,intents}/**` |
| `aidlc-linter.md` | `**/*.{ts,js}` |
| `aidlc-type-check.md` | `**/*.{ts,tsx}` |

`matches` は実質的に発火フィルターそのものです。理論上は任意でも、実務上は必須です。フックは書き込まれたパスをこのグロブと比較し、一致した場合だけ発火します。`matches` を持たないエントリは一切発火しません（`aidlc-sensor-fire.ts`: `if (!entry.matches) continue`）。そのため、出荷済み 4 マニフェストはすべて `matches` を宣言しています。2 つの文書形状センサーは成果物ツリーに、2 つのコード品質センサーは言語グロブに限定されます。コンパイル解決器は `matches` をそのままステージ別 `sensors_applicable[]` へコピーし、フックはグラフノードからスナップショットされた値を読みます。

空文字列（`matches: ""`）は解析時に拒否されます。グロブがないとセンサーは発火しないため、マニフェストは自分が適用されるグロブ形状を必ず明示しなければなりません。「全部に発火する」モードはありません。

<a id="cross-references-between-rules-and-sensors"></a>
### ルールとセンサーの相互参照

ルールファイル側では `pairing: aidlc-required-sections` のように `aidlc-` 接頭辞付きでセンサーを指します。一方、センサーマニフェストの `id:` は `required-sections` のように接頭辞なしです。診断ツールの網羅性検査は、ルールの `pairing:` 値から `aidlc-` 接頭辞を剥がしてから、マニフェスト `id` と照合します。

---

<a id="default_severity"></a>
## `default_severity`

バージョン 0.5.0 では `advisory` が唯一の有効値です。助言センサーの失敗は監査行と詳細ファイルを生成しますが、ステージゲートもユーザーのワークフローも止めません。

`blocking` は将来のラルフドライバー向け予約値です。したがって現在は、このフィールドは構造上は存在していても、意味論上は単一値です。

---

<a id="command-invocation-contract"></a>
## `command:` の呼び出し契約

マニフェストの `command:` は**正準な呼び出し接頭辞**であって、完全な引数列ではありません。各出荷済みセンサーは自分専用のスクリプトを指します。ディスパッチャー（`aidlc-sensor.ts`）は発火時に実行時コンテキストを後付けします。必ず `--stage <stage-slug>` を付け、その後にセンサーの入力形状に合うファイルフラグを付けます。文書センサーなら `--output-path <file>`、コードセンサー（`linter`, `type-check`）なら `--file-path <file>` です。

```
<command> --stage <stage-slug> --output-path <file-being-written>   # document sensor
<command> --stage <stage-slug> --file-path   <file-being-written>   # code sensor
```

したがって、たとえば次のマニフェストがあり:

```yaml
command: bun .claude/tools/aidlc-sensor-required-sections.ts
```

それが `requirements-analysis` に対して、意図の記録ディレクトリ内の要件成果物書き込みで呼ばれるときの実際のディスパッチは次の形です。

```
bun .claude/tools/aidlc-sensor-required-sections.ts \
  --stage requirements-analysis \
  --output-path aidlc/spaces/default/intents/260624-inventory-api/inception/requirements-analysis/requirements.md
```

マニフェストは発火ごとのフラグを持ちません。ディスパッチャーが追加し、マニフェスト自体は純粋な機能記述子のままです。

---

<a id="gate-ritual-handoff-surface-stdout--selections-file-in"></a>
## ゲート儀式の受け渡し（標準出力を公開／選択ファイルを入力）

§13 の学習ゲートはツールを実行主体とします。決定論的ツール（`aidlc-learnings.ts`）とライブの `/aidlc` セッションを担うコンダクターの往復は 2 区間あり、その間にナレッジステップと判断ステップが入ります。

1. **公開（標準出力）**。次のコマンドがステージの `memory.md` を読み、構造化 JSON を出力します。

   ```
   bun .claude/tools/aidlc-learnings.ts surface --slug <stage-slug>
   ```

   内容は `candidates[]`（空でない解釈／逸脱／トレードオフごとに 1 件。`id`、`source_heading`、`ts`、`summary`、`context`、`default_scope: "project"` を持つ）と、読み取り専用の `parked_open_questions[]` です。`AskUserQuestion` 用のフィールド名は含まず、純粋なドメインデータだけです。未解決の質問は候補になりません。研究項目だからです。
2. **コンダクターが `AskUserQuestion` を描画する（ナレッジ）**。候補 1 件につき 1 オプションで、ラベルは候補 `summary` を逐語で使い、説明には導出先（例: `→ memory/project.md (Deviation)`）と、チームへの昇格の選択肢を載せます。`multiSelect` の結果を受けたら、コンダクターは各保持ラベルを候補 `id` と `source_heading` に対応付けます。その後、必ず「次回に向けて追加することはありますか？」を尋ね、自由記述があれば見出し選択の単一 AUQ（解釈／逸脱／トレードオフ／未解決の質問）を出します。分類はこの見出し選択のみが決め、保存先はそこから導出されます。
3. **採用時の競合検査（ナレッジ → オーケストレーター LLM。永続化に渡る選択を絞る）**。保持された各学習について、コンダクターは提案された単一の日付付きエントリを `org.md` の対応 `## <section>` と比較します。矛盾が見つかった場合は、対立する組織文をその場に表示し、ユーザーが修正／スキップ／エスカレーションを選びます。競合がないもの、またはユーザーがエスカレーションしたものだけが先へ進みます。センサーマニフェストには組織節対応がないため、この検査は行いません。
4. **永続化（選択ファイルを入力）**。コンダクターは保持された選択を `<record>/.aidlc-learnings/<slug>-selections.json`（Git の追跡対象外）へ書き、次のコマンドを呼びます。

   ```
   bun .claude/tools/aidlc-learnings.ts persist --slug <slug> --selections-json <path>
   ```

   決定論的な書き込み役はこのツールです。競合判断はしません。各学習を `aidlc/spaces/<space>/memory/{project,team}.md` へプラクティスとして書き込み、センサー選択についてはマニフェストと起点ステージの `sensors:` メタデータ部へのインポート追加を、1 つの `withAuditLock` トランザクション内で行います。その後 `RULE_LEARNED` / `SENSOR_PROPOSED` を出します。

この選択ファイルは再実行用の成果物でもあります。永続化が途中で落ちても、人間へ再プロンプトせず同じ JSON を再適用できます（書き込まれた各行に `<!-- cid:<slug>:<id> -->` マーカーを持たせることで内容存在による冪等性を実現します）。

---

<a id="defaults-for-scaffolded-manifests"></a>
## 足場作成されるマニフェストの既定値

センサー提案がゲートで確認されると、ゲート儀式ツールは新しい**プロジェクトティア**のマニフェストを `<project>/.claude/sensors/aidlc-<id>.md` に足場作成します。フレームワーク同梱配布物は決して変更しません。プロジェクト単位の学習ループがフレームワーク本体を書き換えてはいけないためであり、フレームワーク配布物のパスは拒否されます。既定値は次のとおりです。

| 項目 | 既定値 | 注記 |
|---|---|---|
| `id` | ユーザー自由記述から導出（ケバブケース化） | |
| `kind` | `deterministic` | 現在唯一受理される値 |
| `command` | `bun .claude/tools/aidlc-sensor-<id>.ts` | 仮のセンサー別スクリプト。利用者が実装スクリプトへ更新する |
| `default_severity` | `advisory` | 現在唯一受理される値 |
| `description` | ユーザー自由記述由来 | |
| `category` | `""` | 必要なら利用者が埋める |
| `matches` | 発火にはグロブが必要 | どの形のファイルへ適用するかを足場作成時に確認する。成果物ツリーのグロブでも `**/*.ts` のようなコードグロブでもよい。`matches` がないエントリは発火しない |
| `input_schema` | `{ output_path: string, stage_slug: string }` | ディスパッチャーが付加するフラグ形状に一致 |
| `output_schema` | `{ pass: boolean }` | ディスパッチャーが依存する最小構造 |
| `timeout_seconds` | `30` | 保守的な既定。遅いディスパッチャー向けに調整可能 |

マニフェストを足場作成した後、ゲート儀式ツールは同じ `withAuditLock` トランザクション内で、新しい識別子を起点ステージの `sensors:` メタデータ部一覧へ追加します。これがプル型著述における 2 回書き込みの導入です。次のワークフローでコンパイルされれば、センサーは完全に配線されます。これは許可された唯一のステージメタデータ部編集です。増やすのはインポート一覧だけであり、`## Steps` / `## Sensors` / `## Learn` の本文形状は変えません。

出荷済み 4 マニフェストは、この既定値からどう発展するかの実例です。`aidlc-required-sections.md` と `aidlc-upstream-coverage.md` は `timeout_seconds: 5` と成果物ツリー用 `matches` グロブを使います。`aidlc-linter.md` は `30` と `matches: "**/*.{ts,js}"`、`aidlc-type-check.md` は `60` と `matches: "**/*.{ts,tsx}"` を使います。

---

<a id="forward-compat-policy"></a>
## 前方互換ポリシー

センサーマニフェストを消費する側、つまりコンパイラ、ディスパッチャー、ゲート儀式の足場作成、診断ツールは、**未知のマニフェストキー**を許容しなければなりません。将来 `cool_new_field:` のような任意フィールドが追加されても、古いコンシューマーはそれを無視して処理を継続します。これにより、スキーマを加法的に進化させてもフォークやアップグレード前のワークスペースを壊しません。

前方互換は、既知キーへの未知値には適用されません。上の [`kind` 列挙値](#kind-enum) で説明したとおり、`kind` の未知値は解析時に拒否されます。同じ原則は、ほかの列挙値的フィールド、たとえば `default_severity` にも当てはまります。

---

<a id="reserved-for-future-releases"></a>
## 将来リリース向け予約

いくつかのセンサー機能は、フィールド形状だけ先に安定させるため、スキーマ上に予約されていますが、まだ有効ではありません。

- **`kind: llm` ディスパッチ** — LLM 評価型センサー（バージョン 0.11.0）。現時点では `kind` は存在していても、`deterministic` 以外は解析時に拒否されます。
- **`blocking` 重大度** — 助言テレメトリではなく、ゲートを止めるセンサー失敗（バージョン 0.10.0 のラルフドライバー）。現時点で受理されるのは `advisory` のみです。

どちらも書き込み時点で強制されます。つまり、今それらを使ったマニフェストを出荷すること自体が作成者エラーであり、パーサーが拒否します。

<a id="next-steps"></a>
## 次のステップ

- **ルール** — この制御ループのフィードフォワード側であり、`pairing:` フィールドによってセンサーと対になります。[ルールシステム](08-rule-system.md) を参照してください。
- **利用者向け学習ループ** — センサー提案がどうゲートで表面化され、確認され、確認済み提案が新しいマニフェストをどう足場作成するか。ユーザーガイドの [ルールと学習ループ](../guide/09-rules-and-the-learning-loop.md) を参照してください。
- **コンパイル境界** — `sensors_applicable` がワークフロー開始時に 1 回だけどう解決され、発火時にグラフノードからどう読まれるか。[プレーンアーキテクチャ](02-plane-architecture.md) を参照してください。

上のスキーマと、`dist/claude/.claude/sensors/` にある出荷済み 4 マニフェストが、現時点の実働例です。
