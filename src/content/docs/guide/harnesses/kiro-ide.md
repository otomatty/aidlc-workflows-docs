---
title: Kiro IDE での AI-DLC 実行
description: Kiro IDE 向けの前提条件、インストール、hook の仕組み、Claude Code との差分を説明します。
sidebarOrder: 21
sourcePath: docs/guide/harnesses/kiro-ide.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 3db87bb0c1260eb2e00dae7ad73b5fc3ce0ca3048e2450316dbb7f3ad0bf845a
translationStatus: current
---

<a id="running-ai-dlc-on-kiro-ide"></a>
# Kiro IDE での AI-DLC 実行

このフレームワークのハーネスの 1 つとして、`dist/kiro-ide/` は [Kiro IDE](https://kiro.dev/) の内部で同じ AI-DLC 方法論を実行します。決定論的な 1 つのコア、つまりツール、32 個のステージファイル、プロトコル、ナレッジ、センサー、スコープ、ルールは、すべてのハーネスでバイト単位に共有されます。異なるのはシェル（skills、agent configs、hook wiring、activation）だけです。

> [!IMPORTANT]
> **Kiro IDE では Claude Opus 4.8 で AI-DLC を実行してください。** コンダクターは各ステージごとに複数段階の手順を進めます。確認質問、成果物の生成、レビュー担当者の確認、学習ループ、そして承認ゲートです。Opus 4.8 はこの手順を最後まで守り、各ゲートで正しく停止します。より弱いモデルは任意手順（レビュー担当者の確認と学習ループ）を省略し、ゲートを急いで通過することがあります。ワークフローを始める前に、chat model を **Claude Opus 4.8** に設定してください。

<a id="prerequisites"></a>
## 前提条件

- **Kiro IDE** にサインイン済みであること
- **Claude Opus 4.8** が chat model として選択されていること（上の注記を参照）
- **bun** が `PATH` 上にあること（`curl -fsSL https://bun.sh/install | bash`）

> [!TIP]
> bun は *non-interactive* shell から見える `PATH` 上になければなりません。IDE がフックやツールを実行するのはその shell です。これらの shell は `~/.zshenv`（zsh）または `~/.bashrc`（bash）を読み取り、`~/.zshrc` は読みません。しかし bun installer は `~/.zshrc` に書き込みます。ターミナルでは `which bun` が通るのにフックから bun が見つからない場合は、`BUN_INSTALL` / `PATH` の export を `~/.zshenv`（または `~/.bashrc`）へコピーしてください。

<a id="install"></a>
## インストール

```bash
cp -r dist/kiro-ide/.kiro your-project/.kiro
cp -r dist/kiro-ide/aidlc your-project/aidlc        # the workspace shell (spaces/default/memory) — a sibling of .kiro/, not inside it
cp dist/kiro-ide/AGENTS.md your-project/AGENTS.md   # merge if you already have one
```

`aidlc/` ディレクトリはワークスペースシェルです。エンジンが読む事前構築済みの `aidlc/spaces/default/memory/` メソッドツリーを含みます。これは `.kiro/` の **兄弟ディレクトリ** であり、その内側ではないため、別々にコピーしてください（または `dist/kiro-ide/` ツリー全体をまとめてコピーしても構いません）。これがないと、`/aidlc --doctor` の "workspace shell ready" 判定は失敗します。

`your-project/` を Kiro IDE で開きます。このインストールには次が含まれます。

- `.kiro/settings/cli.json` と `chat.defaultAgent: "aidlc"`。そのため AI-DLC のコンダクター agent が既定で有効になり、`/aidlc` がそのまま使えます。
- `.kiro/hooks/*.kiro.hook` - IDE のネイティブな hook format で登録される framework hook です。IDE の Agent Hooks panel に表示されます。

chat panel で `/aidlc --doctor` を実行してセットアップを確認し、その後 `/aidlc <description>` でワークフローを開始します。

<a id="usage"></a>
## 使い方

Claude Code ハーネスと同一です。`/aidlc <description>` でワークフローを開始し、`/aidlc --status` で現在位置を確認でき、`/aidlc --doctor`、`--stage`、`--phase`、`--depth`、`--test-strategy` もすべて使えます。ステージごとのランナー（`/aidlc-application-design`）とスコープごとのランナー（`/aidlc-feature`）もインストールされます。初期化 command はありません。同梱シェルがワークスペースを足場として用意し、最初の `/aidlc` で最初の intent が自動生成されます。

<a id="how-hooks-work-on-kiro-ide"></a>
## Kiro IDE でフックはどう動くか

Kiro IDE は `.kiro/hooks/` 配下の `.kiro.hook` files を通じてフックを登録します（`hooks` block を agent JSON の中で読む Kiro CLI とは異なる仕組みです）。各 `.kiro.hook` は command を実行し、それが共有の `aidlc-kiro-adapter.ts` shim を経由して IDE の hook event を、バイト共有のコアフックが期待する形へ正規化します。

IDE はフックの文脈を **`USER_PROMPT` environment variable** で渡します（stdin ではありません。IDE は stdin を開きますが書き込みません）。`USER_PROMPT` は JSON 文字列 `{ toolName, toolArgs, toolResult, toolSuccess }` です。IDE は `toolArgs` を空のままにするため、adapter は `toolResult` text から書き込まれた file path を復元し、payload を持たないフック（`runtime-compile`、`sync-statusline`）は tool payload ではなく監査証跡を基準に動かします。

| フック | IDE event | 目的 |
|------|-----------|---------|
| `aidlc-session-start` | `promptSubmit` | ワークフローの resume context を注入する |
| `aidlc-mint` | `promptSubmit` | 各 prompt ごとに human-turn event を記録する（human-presence gate） |
| `aidlc-session-end` | `agentStop` | `SESSION_ENDED` を出力する（observability） |
| `aidlc-stop` | `agentStop` | forwarding-loop continuation |
| `aidlc-block` | `preToolUse` | approval gate が開いたままで、その後に人間が操作していない間は tool call を強制ブロックする（human-presence floor） |
| `aidlc-audit-logger` | `postToolUse`（write） | 成果物の create / update を記録する（path は `toolResult` から取得） |
| `aidlc-sensor-fire` | `postToolUse`（write） | 該当する sensor を起動する（path は `toolResult` から取得） |
| `aidlc-runtime-compile` | `postToolUse`（shell） | runtime graph を再コンパイルする（監査末尾を条件に実行） |
| `aidlc-sync-statusline` | `postToolUse`（shell） | 監査内の最新 `STAGE_STARTED` から `Current Stage` を前進方向にのみ同期する（IDE では `spec` event が発火しない） |

フックが発火するたびに、chat には "Run Command Hook" 行が表示されます。

<a id="debugging-hooks"></a>
### フックのデバッグ

フックの挙動が想定どおりでない場合は、debug logging を有効にすると、各フックがどの判断経路を通ったか（どのゲートを選んだか、どの path に解決されたか、なぜ終了したか）を `<record>/.aidlc-hooks-health/hook-debug.log` に追記します。これは **既定では無効** で、通常運用では log は作られず、余分な overhead もありません。有効化する方法は 2 つあり、どちらでも構いません。

- **filesystem marker（Kiro IDE では最も簡単）:** project 内で `touch aidlc/.aidlc-hook-debug` を実行します。次にフックが発火した時点で有効になり、IDE の再起動は不要です。無効化するときは `rm aidlc/.aidlc-hook-debug` を実行します。
- **environment variable:** `export AIDLC_HOOK_DEBUG=1`。IDE はフックを non-interactive shell で実行するため、それらの shell が読む場所へ設定してください。`~/.zshenv`（zsh）または `~/.bashrc`（bash）へ export を追加し、その後 IDE を再起動します。

<a id="whats-different-on-kiro-ide"></a>
## Kiro IDE で異なる点

| 項目 | Claude Code | Kiro IDE |
|------|-------------|----------|
| フック登録 | `settings.json` の `hooks` block | `.kiro/hooks/*.kiro.hook` files（Agent Hooks panel に表示） |
| ゲートと質問 | `AskUserQuestion` widget | 番号付きの文章による選択肢（番号で回答）。`[Answer]:` タグを持つ質問 FILE が正本のまま残る |
| ステータスライン | 現在のステージ + モデル + context % | 利用不可。`/aidlc --status` と、各ゲートで表示される進捗行を使う |
| サブエージェント用ステージ（2.1、3.5） | `Task` tool | Kiro の `subagent` tool -> `aidlc-developer-agent` / `aidlc-architect-agent`。IDE は delegated agent の tool grant を agent `.md` frontmatter の `tools:` から読み取るため、packaging 時に注入される。agent-v1 JSON は CLI 専用 |
| Construction swarm | 並列 `Task` floor、任意の ultracode Workflow | subagent fan-out のみ。`AIDLC_USE_SWARM=1` は no-op として通知される |
| セッション監査イベント | `SESSION_STARTED/RESUMED/ENDED`、`SESSION_COMPACTED` | `SESSION_STARTED` / `SESSION_ENDED`（pre-compaction event はない） |
| MCP サーバー | 5 個を同梱（`.mcp.json`: `context7` + 4 つの AWS server） | 同梱なし |

それ以外、つまり状態機械、per-intent 記録ディレクトリ（`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`）配下の監査証跡と成果物、学習ループ、センサー、スコープ、depth / test-strategy は同一に動作します。なぜなら本当に同一であり、同じツールが `.kiro/tools/` から実行されるからです。

プロジェクトの `aidlc/` ワークスペースはハーネス中立です。プロジェクトをハーネス間で移動すること、または並行して両方を動かすことはサポートされていますが未検証です。進行中のワークフローがある状態で競合するハーネス構成を検出すると、`/aidlc --doctor` が警告します。

<a id="for-framework-developers"></a>
## フレームワーク開発者向け

`dist/kiro-ide` は `core/` と `harness/kiro-ide/` から `bun scripts/package.ts kiro-ide` で **生成** されます（コアの複製に対して `{{HARNESS_DIR}}` token を `.kiro` に置換し、`rules/` を `steering/` へ rename します）。`bun scripts/package.ts --check` は差分監視であり、CI で実行されます。手書きの Kiro IDE 側 surface は `harness/kiro-ide/` にあり、orchestrator skill（`skills/aidlc/`）、agent JSON 群（`agents/`）、hook adapter と `.kiro.hook` files（`hooks/`）、`settings/cli.json`、`AGENTS.md` を含みます。編集するのはそれら（または `core/`）であり、生成物の `dist/kiro-ide` ではありません。

IDE ハーネスが CLI ハーネス（`harness/kiro/`）と異なるのは 3 点です。`.kiro.hook` files を同梱すること（CLI は agent-JSON の `hooks` block に依存し、IDE はそれを無視します）、`aidlc.json` から使われない `hooks` block を省くこと、そして delegation 先 agent `.md` files に `tools:` frontmatter grant を manifest が注入することです（`frontmatterAdditions`）。IDE は delegated subagent の tools を agent-v1 JSON ではなく `.md` frontmatter から解決するため、この grant がないと IDE 側 delegate はツールを持たないまま実行されます。なお、この frontmatter grant は無制限であり（IDE には `allowedCommands` / `allowedPaths` 相当がないため）、CLI JSON sandbox より広い許可になります。詳細は [新しいハーネスへの移植](../../harness-engineering/09-porting-to-a-new-harness.md) を参照してください。

<a id="next-steps"></a>
## 次のステップ

インストールと有効化が終わったら、方法論自体はどのハーネスでも同じです。次はハーネス中立の章へ進んでください。

- [最初のワークフロー](../02-your-first-workflow.md) - 注釈付きの最初から最後までの実行例
- [フェーズとステージ](../04-phases-and-stages.md) - 5 つのフェーズと 32 のステージ
- [スコープ、深度、テスト戦略](../05-scopes-and-depth.md) - 実行規模の適切な見積もり方
- [用語集](../glossary.md) - すべての用語の定義

他のハーネス: [Codex CLI での AI-DLC](codex-cli.md) · [ハーネス一覧](README.md)
