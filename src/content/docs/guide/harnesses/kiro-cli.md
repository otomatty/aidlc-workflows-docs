---
title: Kiro CLI での AI-DLC 実行
description: Kiro CLI 向けの前提条件、インストール、既定設定、Claude Code との差分を説明します。
sidebarOrder: 22
sourcePath: docs/guide/harnesses/kiro-cli.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 8e793976577cd725398324e4d946cb524745636b31fe3ab48966a2a5d224491f
translationStatus: current
---

<a id="running-ai-dlc-on-kiro-cli"></a>
# Kiro CLI での AI-DLC 実行

> [!NOTE]
> Kiro CLI で AI-DLC を使う場合は、**Claude Opus 4.8** が最も適しています。これには **有料の Kiro プラン** が必要です。より弱いモデルでは、コンダクターが任意のステージ手順（レビュー担当者の確認、学習ループ）を省いたり、承認ゲートを急いで通過したりすることがあります。IDE 向け配布物については [Kiro IDE での AI-DLC 実行](kiro-ide.md) で別途説明しています。

このフレームワークのハーネスの 1 つとして、`dist/kiro/` は [Kiro CLI](https://kiro.dev/docs/cli/) 上で同じ AI-DLC 方法論を実行します。決定論的な 1 つのコア、つまりツール、32 個のステージファイル、プロトコル、ナレッジ、センサー、スコープ、ルールは、すべてのハーネスでバイト単位に共有されます。異なるのはシェル（skills、agent configs、hook wiring、activation）だけです。

<a id="prerequisites"></a>
## 前提条件

- **Kiro CLI ≥ 2.6**（`kiro-cli --version`）、およびログイン済みであること（`kiro-cli login`）
- **bun** が `PATH` 上にあること（`curl -fsSL https://bun.sh/install | bash`）

<a id="install"></a>
## インストール

```bash
cp -r dist/kiro/.kiro your-project/.kiro
cp -r dist/kiro/aidlc your-project/aidlc       # the workspace shell (spaces/default/memory) — a sibling of .kiro/, not inside it
cp dist/kiro/AGENTS.md your-project/AGENTS.md   # merge if you already have one
```

`aidlc/` ディレクトリはワークスペースシェルです。エンジンが読む事前構築済みの `aidlc/spaces/default/memory/` メソッドツリーを含みます。これは `.kiro/` の **兄弟ディレクトリ** であり、その内側ではないため、別々にコピーする必要があります（または `dist/kiro/` ツリー全体をまとめてコピーしても構いません）。これがないと、`/aidlc --doctor` の "workspace shell ready" 判定は失敗します。

その後、プロジェクトでセッションを開始します。

```bash
kiro-cli chat
```

このインストールには `.kiro/settings/cli.json` が含まれており、`chat.defaultAgent: "aidlc"` が設定されています。そのため AI-DLC のコンダクター agent が既定で有効になり、`/aidlc` がそのまま使えます。**このワークスペース設定は、あなたが設定しているグローバル既定 agent より優先されます**。自分の既定 agent を優先したい場合は、この設定を削除して `kiro-cli chat --agent aidlc` を使ってください。

同じ `cli.json` には、`chat.modelDefaults` を通じたモデルごとの推論量既定値も入っています。固定されたオーケストレーター用モデル（`claude-opus-4.8`）には `xhigh` が設定されており、コンダクターは最初から最大限に深く推論します。balanced / templated agent tier が固定する `claude-sonnet-4.5` には `high` が設定されています（Kiro には agent ごとの effort 設定面がないため、effort はモデルに紐づきます。同じモデルを共有する 2 つの tier では、より高い tier の値が勝ちます）。judgment tier の agents はモデルを固定せず、あなたの `/model` 既定値に従い、そのモデル自身の既定 effort を使います。この file を読むのは Kiro CLI だけで、Kiro IDE は `cli.json` を無視し、拡張機能側のモデルごとの既定値を適用します。セッションごとの上書きは、chat 中の `/effort <level>` または `kiro-cli chat --effort <level>`（low|medium|high|xhigh|max）で行えます。セッション用 flag と user-level の `~/.kiro/settings/cli.json` は、ワークスペース既定値より優先されます。

<a id="usage"></a>
## 使い方

Claude Code ハーネスと同一です。`/aidlc <description>` でワークフローを開始し、`/aidlc --status` で現在位置を確認でき、`--doctor`、`--stage`、`--phase`、`--depth`、`--test-strategy` もすべて使えます。ステージごとのランナー（`/aidlc-application-design`）とスコープごとのランナー（`/aidlc-feature`）もインストールされます。

<a id="whats-different-on-kiro"></a>
## Kiro で異なる点

| 項目 | Claude Code | Kiro CLI |
|------|-------------|----------|
| ゲートと質問 | `AskUserQuestion` widget | 番号付きの文章による選択肢（番号で回答）。`[Answer]:` タグを持つ質問 FILE が正本のまま残る |
| ステータスライン | 現在のステージ + モデル + context % | 利用不可。`/aidlc --status` と、各ゲートで表示される進捗行を使う |
| サブエージェント用ステージ（2.1、3.5） | `Task` tool | Kiro の `subagent` tool -> `aidlc-developer-agent` / `aidlc-architect-agent` 設定 |
| Construction swarm | 並列 `Task` floor、任意の ultracode Workflow | subagent fan-out のみ。`AIDLC_USE_SWARM=1` は no-op として通知される |
| セッション監査イベント | `SESSION_STARTED/RESUMED/ENDED`、`SESSION_COMPACTED` | `SESSION_STARTED` のみ（Kiro には session-end / pre-compaction hook がない） |
| 転送ループ強制（Stop hook） | interactive + headless | interactive セッションのみ。`--no-interactive` 実行では stop-hook block が効かない |
| 権限 | `settings.json` allowlist | `aidlc` agent config: 事前承認されるのは `bun .kiro/tools/*` のみで、他の shell command は確認が出る |
| ウェルカムメッセージ | `settings.json` の `companyAnnouncements` をセッション開始時に表示 | なし。Kiro には welcome-render 相当機能がなく、session-start hook は resume context のみを注入する |
| MCP サーバー | 5 個を同梱（`.mcp.json`: `context7` + 4 つの AWS server） | 同梱なし。Kiro の MCP 設定方式は、ここではまだ文書化していないため、実運用上は現在 Claude 専用 |

それ以外、つまり状態機械、監査証跡、intent 記録ディレクトリ（`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`）配下の成果物、学習ループ、センサー、スコープ、depth / test-strategy は同一に動作します。なぜなら本当に同一であり、同じツールが `.kiro/tools/` から実行されるからです。

プロジェクトの `aidlc/` ワークスペースはハーネス中立です。プロジェクトをハーネス間で移動すること、または並行して両方を動かすことはサポートされていますが未検証です。進行中のワークフローがある状態で競合するハーネス構成を検出すると、`/aidlc --doctor` が警告します。

<a id="for-framework-developers"></a>
## フレームワーク開発者向け

`dist/kiro` は `core/` と `harness/kiro/` から `bun scripts/package.ts kiro` で **生成** されます（コアの複製に対して `{{HARNESS_DIR}}` token を `.kiro` に置換し、`rules/` を `steering/` へ rename します）。`bun scripts/package.ts --check` は差分監視であり、CI で実行されます（t145）。手書きの Kiro 側 surface は `harness/kiro/` にあり、orchestrator skill（`skills/aidlc/`）、agent JSON 群（`agents/`）、hook adapter（`hooks/aidlc-kiro-adapter.ts`）、`settings/cli.json`、`AGENTS.md` が含まれます。編集するのはそれら（または `core/`）であり、生成物の `dist/kiro` ではありません。詳細は [新しいハーネスへの移植](../../harness-engineering/09-porting-to-a-new-harness.md) を参照してください。

実機の TUI 動作確認テストも Claude の兄弟テストと並んで存在します。`tests/e2e/t-tui-kiro-intent-capture.serial.test.ts` は、同梱ツリーに対して `kiro-cli chat` をキーストロークで操作します（番号付き文章のゲートには "1"、つまり推奨選択肢で回答し、ディスク上の状態を条件に終了します）。`AIDLC_KIRO_TUI_LIVE=1` で有効化できます。tmux、`kiro-cli`、またはログイン済みの Kiro セッションがない場合は、理由を出して skip します。

<a id="next-steps"></a>
## 次のステップ

インストールと有効化が終わったら、方法論自体はどのハーネスでも同じです。次はハーネス中立の章へ進んでください。

- [最初のワークフロー](../02-your-first-workflow.md) - 注釈付きの最初から最後までの実行例
- [フェーズとステージ](../04-phases-and-stages.md) - 5 つのフェーズと 32 のステージ
- [スコープ、深度、テスト戦略](../05-scopes-and-depth.md) - 実行規模の適切な見積もり方
- [用語集](../glossary.md) - すべての用語の定義

他のハーネス: [Codex CLI での AI-DLC](codex-cli.md) · [ハーネス一覧](README.md)
