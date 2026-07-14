---
title: ランタイムグラフ
description: ワークフローごとのランタイムグラフのスキーマ、コンパイルライフサイクル、回復モデル。
sidebarOrder: 13
sourcePath: docs/reference/13-runtime-graph.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: fc37eecb2141414613ae25026a64b357eb5b353e4d60ca60bff7e4a5a943c38a
translationStatus: current
---
<a id="runtime-graph"></a>
# ランタイムグラフ

> 対象読者: レベル 2/3（チーム導入者、フレームワーク貢献者）。

本章では、バージョン 0.5.0 のマイルストーン 8 で導入されたワークフロー単位の
`runtime-graph.json` アーティファクトを説明します。これは、各承認ゲートで監査ログから
実体化される `stage-graph.json` のデータプレーン上のミラーです。このアーティファクトを
必要とするコントロールプレーンとデータプレーンの分離については
[プレーンアーキテクチャ](02-plane-architecture.md)を、コンパイルを起動する遷移を持つ
ライフサイクルについては[状態機械](12-state-machine.md)を参照してください。

---

<a id="1-what-it-is"></a>
## 1. 概要

`stage-graph.json` は構造上の真実です。すべてのステージ定義と、
すべての `requires_stage` / `produces` / `consumes` エッジを保持します。
ワークフロー実行の間で安定しています。

`runtime-graph.json` は実行上の真実です。*現在の*ワークフローについて、開始済み・
承認済みのステージ、各ステージのメモリーファイルの内容、発火したセンサーを記録します。
ワークフローごとに 1 ファイルで、`<record>/runtime-graph.json` にあります。
`<record>/` は意図のレコードディレクトリ、すなわち
`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` です。ノード形状は
`stage-graph.json` と同じですが、構造ではなくテレメトリーで満たされます。

これは、コンシューマー（マイルストーン 11 のボルト分岐・マージ、マイルストーン 12 の
ゲート儀式、マイルストーン 14 の診断ツール、バージョン 0.10.0 のワークフロー横断オブザーバー）が、
問い合わせのたびに監査ログを再走査する代わりに、単一の実体化ビューを読めるようにするために
存在します。

---

<a id="2-schema"></a>
## 2. スキーマ

以下の TS インターフェースは固定された契約です。変更するには、同じ PR で
すべてのコンシューマーを更新する必要があります。

```ts
interface RuntimeGraph {
  workflow_id: string;            // ISO timestamp from LATEST WORKFLOW_STARTED audit row (so a re-birthed intent identifies the live workflow, not a dead one)
  scope: string;                  // from state.md "Scope" field
  started_at: string;             // ISO 8601, same row as workflow_id
  stages: RuntimeStage[];         // chronological order by started_at
  bolt_dag?: BoltDag;             // present only when units-generation's unit-of-work-dependency.md carries a valid (well-formed, acyclic) fenced edge block; absent/malformed/cyclic blocks omit the node
}

interface BoltDag {
  units: { name: string; depends_on: string[]; kind?: string }[]; // verbatim from the authored edge block; kind (service|spec|ui|packaging|library) present only when the edge block tags the unit
  batches: string[][];            // topological levels; each level = units whose deps are all satisfied by prior levels; level entries sorted lexicographically (deterministic)
}

interface RuntimeStage {
  stage_slug: string;
  started_at: string | null;      // ISO from STAGE_STARTED; null when `instances` is present
  completed_at: string | null;    // ISO from STAGE_COMPLETED; null when pending OR when `instances` is present
  agent: string | null;           // lead_agent; null when `instances` is present
  memory_path: string;            // <record>/<phase>/<stage>/memory.md (parent stage path even on instance-bearing rows)
  memory_entries: number | null;  // null = no memory.md file OR `instances` is present; else parseMemoryHeadings.total
  memory_breakdown: {             // null when memory_entries is null
    interpretations: number;
    deviations: number;
    tradeoffs: number;
    open_questions: number;
  } | null;
  sensor_firings: SensorFiring[]; // empty array in milestone 8 (sensors fire in milestone 9 + milestone 10)
  outcome: "approved" | "failed" | "pending";
  learnings_captured: {           // null on pending rows; populated on transition to approved
    from_orchestrator: number;    // zero in milestone 8 (gate ritual is milestone 12)
    from_user_addition: number;
  } | null;
  instances?: BoltInstance[];     // present only when stage runs per-Bolt; milestone 11 populates
}

interface BoltInstance {
  bolt: string;
  worktree: string;
  started_at: string;
  completed_at: string | null;
  memory_path: string;
  memory_entries: number | null;
  memory_breakdown: { interpretations: number; deviations: number; tradeoffs: number; open_questions: number; } | null;
  sensor_firings: SensorFiring[];
  outcome: "approved" | "failed" | "pending";
}

interface SensorFiring {
  id: string;
  fire_id: string;                // 8-hex correlator emitted by the milestone 9 dispatcher on every row
  result: "passed" | "failed" | "budget-override" | "incomplete"; // 4-state (milestone 12 Q10)
  ts: string;                     // FIRED row's timestamp
  detail_path?: string;
}
```

`instances` が存在する場合、ステージ行の単一インスタンス用フィールド
（`started_at`、`completed_at`、`memory_entries`、`memory_breakdown`）は
NULL です。これらの値は代わりに各インスタンスに格納されます。ステージ行のフィールドと
インスタンス配列のフィールドが同時に存在することはありません。

<a id="the-boltunit-dependency-dag-bolt_dag"></a>
### ボルト / ユニット依存 DAG（`bolt_dag`）

省略可能な `bolt_dag` ノードは、エンジンが並列ビルドバッチを算出するために読む、
機械可読なユニット依存グラフです。スウォームのファンアウトにおいては「DAG が許可」
となります。ソースは、ユニット生成（2.7）が人間可読な説明文と並べて
`unit-of-work-dependency.md` に記載する、**フェンスで囲まれた `yaml` の
`units:` エッジブロック**です。

```yaml
units:
  - name: auth
    kind: service
    depends_on: []
  - name: api
    depends_on: [auth]
```

各ユニットには、そのユニットが何であるかを示す、省略可能な `kind`
（`service | spec | ui | packaging | library`）を指定できます。これはそのまま
`bolt_dag.units[].kind` に入り、ユニット単位で構築設計を絞り込む処理を
駆動します（[ステージ定義](15-stage-definition.md)の `produces_kinds` を参照）。
ステージが生成するアーティファクトは、各ユニットの種別に該当するものに絞り込まれます。
タグなしのユニットには `kind` キーがなく、設計アーティファクトの完全なマトリクスを維持します。
無効な種別値はブロック全体を `malformed`（後述）にするため、誤った絞り込みが行われる前に
2.7 ゲートで明示的に失敗します。

`compile` は、モデル呼び出しを伴わない純粋なデータ解析で、*その構造化ブロック*を
`units`（そのままのエッジ）と `batches`（トポロジカルレベル）に解析します。
各バッチは依存関係がすべて先行バッチで満たされるユニットの集合です。そのためバッチ内の
ユニットには相互依存がなく、並列実行できます。レベル内の項目は出力前に辞書順に
ソートされるため、記述順にかかわらずノードは決定的です。

アーティファクトがない場合、またはエッジブロックがない・不正（名前の重複、宙ぶらりんの
依存・自己依存、解析不能）・循環している場合、ノードは**完全に省略**されます。
`compile` は理由を示す診断を標準エラー出力に書き込み、誤っているが形式上は有効な DAG を出力する
代わりに、エンベロープから `bolt_dag` を除外します。これらの失敗は、同じブロックを検証して
エッジブロックの状態を報告する `required-sections` センサーにより、
2.7 ゲートで上流へ通知されます。エッジを構造化データとして（一度だけ、2.7 承認ゲートの
背後で行うナレッジ作業として）記述することで、フックから起動された `compile` は再実行時にも
バイト単位で同一になります。コンパイルパスにはモデルが存在しません。オーケストレーションエンジンは、
ノードがない場合に読み取り側で `unit-of-work-dependency.md` からバッチを再計算して
ユニット単位の反復を自己修復しますが、グラフファイル自体は次回のコンパイルでのみ修復されます。

---

<a id="3-compile-lifecycle"></a>
## 3. コンパイルライフサイクル

コンパイルは、遷移クラスの監査イベントが出力されるたびにツール使用後のシェルフック
（`.claude/hooks/aidlc-runtime-compile.ts`）から起動されます。このフックは
コンダクターからのすべてのシェルツール呼び出しで発火し、低コストに絞り込みます。

1. **コマンドフィルター** — `bun .claude/tools/aidlc-(state|jump|bolt|utility).ts`
   の呼び出しだけが早期終了を通過します。`aidlc-runtime.ts` は除外されます
   （再帰防止）。`aidlc-log.ts` は冗長なステージ内イベントのみを出力し、
   `aidlc-worktree.ts` は WORKTREE_* イベントのみを出力します。
2. **監査の存在ガード** — 意図の `audit/` シャードがまだ存在しない場合は終了します。
3. **ハートビート** — 診断ツールによる無応答フック検知のため、
   `<record>/.aidlc-hooks-health/runtime-compile.last` を書き込みます。
4. **末尾 3 ブロックの読み取り** — `audit.md` を `\n---\n` で分割し、
   最後の 3 エントリを取得します。
5. **イベントクラスフィルター** — 次のパターンを
   `**Event**: (GATE_APPROVED|STAGE_STARTED|STAGE_AWAITING_APPROVAL|AUDIT_MERGED|WORKFLOW_COMPLETED)`
   3 ブロックのいずれかと照合します。一致しなければ終了します。
6. **ディスパッチ** — `spawnSync("bun", [".claude/tools/aidlc-runtime.ts", "compile", ...])`。

`WORKFLOW_COMPLETED` が遷移セットに含まれるため、最終ステージの承認でコンパイルが
起動します。`aidlc-state.ts:575-593` の `handleCompleteWorkflow` は
STAGE_COMPLETED + PHASE_COMPLETED + PHASE_VERIFIED + WORKFLOW_COMPLETED の 4 つの
監査行を出力し、このうち最後の 3 行は PHASE_COMPLETED + PHASE_VERIFIED +
WORKFLOW_COMPLETED です。（承認パスでは、承認処理がすでに STAGE_COMPLETED を出力済み
であり、実行の前に `GATE_APPROVED` があるため、最終ステージの承認ではいずれにせよ
1 回のシェル呼び出しで 5 行が追加されます。）正規表現に `WORKFLOW_COMPLETED` がなければ、
ランタイムグラフが最終ステージを承認済みとして記録することはありません。

コンパイル自体は完全な監査ログを走査します（そのため結果は遷移の増分ではなく
イベントソーシングされます）。同じステージ識別子の `STAGE_STARTED` と次の `STAGE_COMPLETED` を
対応付け、`aidlc-lib.ts` の `parseMemoryHeadings()` を介して各ステージのメモリーファイルを
読み取り、`withAuditLock` 内の `writeFileAtomic` によりアーティファクトをアトミックに書き込みます。

---

<a id="4-outcome-enum-and-chronological-pairing"></a>
## 4. 結果の列挙値と時系列ペアリング

結果の値は `"approved" | "failed" | "pending"` の 3 種類です。

- **承認済み** — `STAGE_STARTED@T1` が、後続の `STAGE_COMPLETED@T2` と
  対応付けられた状態です。行の `completed_at` は `T2` です。
- **保留中** — `STAGE_STARTED@T1` に対して、そのステージ識別子の後続する
  `STAGE_COMPLETED` がない状態です。行の `completed_at` は `null` です。
- **失敗** — `instances[]` の親ステージ集約からのみ出力されます
  （単一インスタンスのステージは `"approved" | "pending"` のままです）。
  構築ステージの `instances[]` が空でない場合、親の `outcome` は
  そのインスタンスの集約です。すべて承認済みなら承認済み、1 つでも失敗なら
  失敗、それ以外（失敗なしで保留中がある場合）は保留中です。
  単一インスタンスのステージは `failed` を出力しません。基礎となる `BOLT_FAILED`
  イベントは、インスタンスを持つパスの外では構築ステージのスコープを
  持たないためです。

再ジャンプの扱い: `/aidlc --stage <slug>` は、すでに完了済みのステージ識別子に対して
`STAGE_STARTED` を再出力します。監査ログは
`STAGE_STARTED@T1, STAGE_COMPLETED@T2, STAGE_STARTED@T3` を保持します。
ペアリング規則では `STARTED@T1` と `COMPLETED@T2` が対応し、承認済みになりますが、
そのステージ識別子の**最新の** `STAGE_STARTED` が以前の行をすべて上書きします。識別子ごとに
1 行で、最新の STARTED が優先されます。したがって、結果は
`started_at: T3, completed_at: null` の保留中行です。

単一ステージの除外: `--single` によるステージランナーの実行は、合成された
`**Workflow**: single-stage:<slug>` ID の下に `STAGE_STARTED` / `STAGE_COMPLETED` の
ペアを記録します（監査専用。`aidlc-orchestrate.ts` の `handleSingleReport` を参照）。
ペアリングでは、`Workflow` フィールドが `single-stage:` で始まるすべての `STAGE_*` 行を
除外します。これらの行はメインワークフローに属さないため、メインの `runtime-graph.json`
で行を作成・完了することはなく、`summary` の数を増やすこともありません。
メインワークフローの `STAGE_*` 行には `Workflow` フィールドがありません。フィールドが
ない行は保持されます。同じ除外は `aidlc-state.ts` の `hasStageAuditEvent` における重複排除
チェックにも適用されます。よって、単一実行の `STAGE_COMPLETED` によって、同じステージ識別子に対する
メインワークフロー自身の完了イベント出力が抑制されることはありません。

---

<a id="5-memory_empty-semantics"></a>
## 5. MEMORY_EMPTY の意味

`MEMORY_EMPTY` 監査行は、ステージ行が以下の**すべて**を満たす場合にコンパイルから
出力されます（唯一の出力元。`audit-format.md:171` が
`tools/aidlc-runtime.ts compile` を登録しています）。

- `outcome === "approved"`（保留中行は出力しません。後述の §6 を参照）
- `memory_entries === 0`（ファイルが存在し、標準の 4 つの §13 見出しの下の
  エントリがゼロ）

エントリがゼロの保留中行は出力**しません**。まだ実行中のステージは、コンダクターが
まだメモリーファイルに書いていないため、正当にエントリがゼロである場合があります。実行中に
MEMORY_EMPTY を出力すると、実際に記録を省略したことを表さないノイズが生まれます。
マイルストーン 14 の診断ツールが必要とするシグナルは「エントリゼロで承認済みのステージ」であり、
ステージが承認されていることが前提です。

<a id="idempotency--exactly-once-per-slug-gate-completion"></a>
### 冪等性 — (ステージ識別子, ゲート完了) ごとに厳密に 1 回

同じ監査ログに対する再コンパイルでは、`runtime-graph.json` 自体はバイト単位で
等価です。MEMORY_EMPTY の出力にはさらに強い保証があります。
**`(stage_slug, completed_at)` タプルごとに MEMORY_EMPTY 行は最大 1 行です**。

ロックされたセクション内で、コンパイルは `audit.md` を再読み込みし、エントリゼロで
承認済みの各ステージ識別子に既存の MEMORY_EMPTY 行がないか走査します。以前のいずれかの行の
タイムスタンプがこの識別子の `completed_at` 以降なら、出力を抑制します。つまり次のとおりです。

- エントリゼロでステージが承認された後の最初のコンパイルは、1 行の MEMORY_EMPTY を
  出力します。
- 同じワークフロー中の以後のコンパイルは、そのステージ識別子に対して再出力**しません**。
- `--stage <slug>` による再ジャンプと再承認では、新しい `STAGE_COMPLETED`
  （より後の `completed_at`）が生成されます。再承認時にもステージが空なら、以前の行の
  タイムスタンプは新しい完了時刻より前になるため、新たな MEMORY_EMPTY 行が出力されます。

診断ツールの MEMORY_EMPTY 率メトリクスは、重複排除なしでこれらの行を直接読み取ります。
空の記録を伴うゲート完了ごとに 1 行です。

ロックされたセクション内で MEMORY_EMPTY が出力された後、アーティファクトの書き込みに
失敗した場合、監査ログにはランタイムグラフが作成されなかったステージの N 個の
MEMORY_EMPTY 行が残ります。次のコンパイルは抑制走査でそれらの行を検出して再出力を
スキップし、その後アーティファクトが作成されます。重複した出力も、実体のない
アーティファクトも発生しません。

---

<a id="6-v040-backfill-rule"></a>
## 6. バージョン 0.4.0 のバックフィル規則

マイルストーン 13 のメモリーファイルライフサイクルが提供される前に完了したステージには、
メモリーファイルの履歴がありません。バックフィル規則は次のとおりです。

- `memory_entries: null` ↔ `memory_breakdown: null` ↔ MEMORY_EMPTY を出力しない。
- 両フィールドは常に一緒に変化します。判別基準は
  「`parseMemoryHeadings` は実行されたか」です。メモリーファイルが存在する場合
  （ゼロバイトでも）は実行済みでキーは数値になり、メモリーファイルがない場合は両方とも
  `null` です。

この規則がなければ、バージョン 0.4.x から 0.5.0 にアップグレードするすべてのユーザーは、最初の
アップグレード後のワークフローで大量の MEMORY_EMPTY 行を見ることになります。

---

<a id="7-recovery-model--snapshot--suffix-replay"></a>
## 7. 回復モデル — スナップショット + サフィックス再生

`runtime-graph.json` と `audit.md` はイベントソーシングのペアを構成します。
`audit.md` は追記専用のイベントログ、`runtime-graph.json` は最後のゲート遷移時に
取得された実体化スナップショットです。両方を持つリーダーは、スナップショットを読み、
その最後の `completed_at` 以降の監査行を再生して現在の状態を復元します。

人が読む順番で、回復ソースは 5 つあります。

1. **アーティファクトツリー**（`<record>/<phase>/<stage>/`）— 何が生成されたか。
2. **`memory.md`**（`<record>/<phase>/<stage>/memory.md`）— コンダクターが記録することを
   選んだ内容。
3. **`audit/` シャード** — 正式なイベントログ。実際に何が起きたか。
4. **状態ファイル** — アクティブなステージのカーソル。
5. **`runtime-graph.json`** — 実体化ビュー。監査ログの再走査より高速に問い合わせられますが、
   常に監査ログから再導出できます。

<a id="freshness-caveat-for-pending-rows"></a>
### 保留中行の鮮度に関する注意

保留中行の `memory_entries` と `memory_breakdown` は、最後のコンパイル時点で
スナップショット化されています。ステージが実行中で、最後にコンパイルが起動した後に
コンダクターがさらにエントリを書き込んだ場合、スナップショットは遅れています。
回復時のコンシューマーは回復時点で `memory.md` を再解析しなければなりません。
保留中行のスナップショット化された数を信頼しては**いけません**。

バージョン 0.5.0 には保留中件数をライブで読むコンシューマーはありません。この例外処理を
必要とするバージョン 0.6.0 の `--resume` に向けて記録されています。

<a id="parallel-bolt-mid-flight-recovery-closed-in-v050"></a>
### 並列ボルトの実行途中の回復（バージョン 0.5.0 で解決）

並列ボルトを持つワークフローがバッチの途中でクラッシュした場合、マイルストーン 8 には
ボルトごとの回復の接続点がありませんでした。スキーマは `instances?` を予約していましたが、
コンパイルはメインに単一インスタンス行しか書き込まず、作業ツリーはランタイムグラフの
フラグメントを受け取っていませんでした。これはバージョン 0.5.0 で、ランタイム用の
フラグメント作成（ボルト開始）とフラグメント統合（ボルト完了時のマージオプション）、および監査が
構築フェーズのステージウィンドウ内に 2 つ以上の異なるステージ識別子を示すときに
`BoltInstance[]` を出力するコンパイルの投入処理拡張により解決しました。

ボルトごとのフラグメントはバージョン 0.5.0 では生成されても使われません（作業ツリーのレコード
ディレクトリにある `runtime-graph.json` を読むバージョン 0.5.0 のリーダーはありません）。
バージョン 0.6.0 の `--resume` は、メインのマージ後ランタイムグラフを正式なものとして、
フラグメントをヒントとして扱うべきです。さらに `aidlc-bolt.ts` に従って孤立した
作業ツリーを確認し、その回復プロンプトを表示する必要があります。

---

<a id="8-cli-surface"></a>
## 8. CLI インターフェース

```bash
# Walk audit + memory.md, write runtime-graph.json (invoked by hook).
bun .claude/tools/aidlc-runtime.ts compile

# Print one stage row from runtime-graph.json (debug/test surface).
bun .claude/tools/aidlc-runtime.ts read <stage-slug>

# Print deterministic aggregates over runtime-graph.json: stage/phase
# outcome tallies, memory-entry counts by category, sensor 4-state
# tallies, learnings captured, and workflow duration. Read-only; the
# session skills (session-cost, replay, outcomes-pack) consume the
# --json shape so every number they render comes from here, not from
# LLM-side counting.
bun .claude/tools/aidlc-runtime.ts summary [--json]

# Byte-copy main runtime-graph.json into a Bolt's worktree fragment
# (one-shot; called by `aidlc-bolt start --worktree`). No audit emit —
# the fragment lifecycle rides on STATE_FORKED + AUDIT_FORKED.
bun .claude/tools/aidlc-runtime.ts fragment-fork --slug <kebab-slug>

# Remove the worktree fragment (idempotent; called by
# `aidlc-bolt complete --merge`). No audit emit — the fragment
# lifecycle rides on STATE_MERGED + AUDIT_MERGED. Main's runtime-graph
# is rebuilt event-source by the post-Bash compile hook on AUDIT_MERGED.
bun .claude/tools/aidlc-runtime.ts fragment-merge --slug <kebab-slug>
```

すべてのサブコマンドは、標準のカレントディレクトリベースの解決を上書きする
`--project-dir <path>` を受け付けます。

通常の運用ではコンパイルはフック駆動です。テストとデバッグのために手動呼び出しも
用意されています。

---

<a id="9-why-hook-driven-not-llm-tool-coupled"></a>
## 9. なぜフック駆動で、LLM ツール結合ではないのか

以前の計画改訂版では、承認・進行・マージ完了の各ハンドラー内に、ランタイムコンパイルを
兄弟プロセスで起動する呼び出しを挿入することを提案していました。この方法は、
[プレーンアーキテクチャ](02-plane-architecture.md)に記載された根幹の原則に反します。

> 決定性が必要な場所ではツールを使います。知識が必要な場所では LLM / エージェントを使います。
> 判断が必要な場所では人を使います。

ランタイムグラフのコンパイルは、特定のセッションの外部から観測可能でなければならない
データプレーンの基盤です。LLM が呼び出すツールに結合すると、LLM の呼び出し漏れが
決定性の保証を壊します。人が承認をクリックした後にコンダクターが
`aidlc-orchestrate.ts report --stage <slug> --result approved` を呼び出し忘れると、
監査行は追加されず、コンパイルも起動しません。ランタイムグラフは静かに遅延し、
回復基盤は破損します。

ツール使用後のシェルフックは、LLM が次に何をするかにかかわらず、コンダクターが実際に
サブプロセスを呼び出したときに発火します。監査出力側の接続点
（`bun aidlc-(state|jump|bolt|utility).ts`）が決定性のアンカーです。

---

<a id="10-known-gaps-closed-by-future-prs"></a>
## 10. 今後の PR で解消される既知のギャップ

- **MEMORY_EMPTY 率メトリクス** — マイルストーン 14 の診断ツールが、§5 で固定した
  `(Stage, ISO-second)` の重複排除タプルを使用して率を表示します。
- **`learnings_captured` の来歴件数** — マイルストーン 12 のゲート儀式が
  `from_orchestrator` と `from_user_addition` を投入します。
- **`sensor_firings` 配列** — マイルストーン 9 とマイルストーン 10 がセンサーを
  ディスパッチし、このスロットを投入します。
- **`runtime-graph.json` のボルト分岐・マージ** — バージョン 0.5.0 で
  `fragment-fork`（新しい監査イベントなし。STATE_FORKED + AUDIT_FORKED に追随）と
  `fragment-merge`（新しい監査イベントなし。STATE_MERGED + AUDIT_MERGED に追随）により
  解決しました。構築ステージのウィンドウ内に 2 つ以上の異なるステージ識別子がある場合、
  コンパイルは監査の BOLT_*-タグ付きイベントから `instances[]` を投入します。
- **ヘッドレスワークフローの CLI モードディスパッチ** — バージョン 0.6.0+ では Claude Code 以外の
  実行パスが提供される可能性があります。このフックは Claude Code セッション内でのみ発火します。

---

<a id="11-fragment-lifecycle"></a>
## 11. フラグメントのライフサイクル

ボルトごとのランタイムグラフフラグメントファイルは、メインの場所をミラーする
`<worktree>/<record>/runtime-graph.json` にあり、Git の無視対象です。
そのライフサイクルは次のとおりです。

1. **ボルト開始時に分岐。** `aidlc-bolt start --worktree --slug <slug>` は、
   状態分岐と監査分岐の後にフラグメント作成処理へ委譲します。
   単一読み取りプロトコルでは、`readFileSync` で 1 回だけバッファに読み込み、そのバッファを
   `writeFileSync` でフラグメントパスへ書き込み、同じバッファを標準出力エンベロープ用に
   ハッシュします。これは、分岐の途中でメインを書き換える並行コンパイルとのバイトコピー /
   ハッシュ競合を防ぎます。メインに `runtime-graph.json` がまだない場合、フラグメントは
   作業ツリーの状態カーソルを基点とする空のグラフです。
2. **ボルトの存続中に更新。** シェル実行後のコンパイルフックは、作業ツリー内の遷移を含む
   遷移クラスの監査出力ごとに発火します。各発火で、作業ツリーの監査ビューから作業ツリーの
   `runtime-graph.json`（フラグメント）を再コンパイルします。このフラグメントには、この
   ボルトの監査分岐時点でアクティブだった兄弟の `instances[]` が投入されることがあります。
   作業ツリーの監査は分岐時点のスナップショットであるため、後から開始した兄弟は
   フラグメントには現れません。
3. **ボルト完了時にマージ。** ボルト完了コマンドは、
   状態統合と監査統合の後にフラグメント統合処理へ委譲します。
   この処理は標準出力による可観測性のためフラグメントをハッシュし、`unlinkSync` で
   削除して JSON エンベロープを出力します。親のシェル呼び出しが戻ると、コンパイルフックは
   メインで再発火し、マージ直後のステージ識別子に対する `instances[]` が投入されたメインの
   ランタイムグラフを再構築します。
4. **多層防御としての削除。** `aidlc-worktree merge` と `aidlc-worktree discard` はどちらも
   `git worktree remove` を呼び出し、結果としてフラグメントも削除されます。フラグメント統合の
   明示的な削除と暗黙的なクリーンアップの組み合わせは、状態統合と `git worktree remove`
   が状態側ですでに組になっている方法を踏襲した、多層防御パターンです。
5. **失敗モード。** `fragment-fork` の失敗（作業ツリー不在、フラグメントがすでに存在、
   バイトコピーの IO エラー、プロセス起動タイムアウト）では、診断ツールによる原因帰属のため
   `aidlc-bolt` が `Reason: fragment-fork-*` フィールドを持つ `BOLT_FAILED` を出力します
   （IO / ガードエラーは `fragment-fork-failed`、プロセスへの SIGTERM は
   `fragment-fork-timeout`）。状態分岐と監査分岐はロールバック**されません**。
   それぞれがすでに自身の監査行を出力しているためです。監査統合がすでに反映された後の
   フラグメント統合の失敗では、BOLT_COMPLETED、STATE_MERGED、AUDIT_MERGED、BOLT_FAILED
   の順という通常とは異なる部分成功の監査シグネチャが生成されます（IO / ガードエラーは
   フラグメント統合失敗、プロセスへの SIGTERM は
   `fragment-merge-timeout`）。フラグメントファイルは、暗黙的な `git worktree remove` の
   クリーンアップまで残存します。以後メインに対するコンパイルでは整合したランタイムグラフが
   生成されます。この位置の BOLT_FAILED は、集約における STATE_MERGED 優先の順序がボルトの
   コンテンツがすでにメインへ伝播済みであることを反映するため、インスタンスを `"approved"` と
   評価します。ここでの BOLT_FAILED は回復テレメトリーであり、接続点を記録するもので、
   コンテンツ自体は無傷のままです。

---

<a id="next-steps"></a>
## 次のステップ

- **データプレーンをこのように構造化する理由** — `runtime-graph.json` を第 2 の
  真実のソースではなく `stage-graph.json` のミラーにする、コントロールプレーン /
  データプレーンの分離です。[プレーンアーキテクチャ](02-plane-architecture.md)を参照してください。
- **コンパイルを起動するライフサイクル** — 監査出力がコンパイルフックを駆動する、
  ワークフロー / フェーズ / ステージの遷移です。[状態機械](12-state-machine.md)を参照してください。
- **このグラフの派生元となる監査ログ** — 68 イベントの分類と出力元レジストリです。
  [状態機械](12-state-machine.md)およびユーザーガイドの
  [状態と監査証跡](../guide/10-state-and-audit.md)を参照してください。
