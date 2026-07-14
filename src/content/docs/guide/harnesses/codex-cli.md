---
title: Codex CLI での AI-DLC
description: Codex CLI ハーネス向けの前提条件、インストール手順、Claude Code との差分を説明します。
sidebarOrder: 23
sourcePath: docs/guide/harnesses/codex-cli.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: ec50d42bbb22e186a7b731558d558b2fcc359a6cb6cd9f16c13d0ea4f421783e
translationStatus: current
---

<a id="ai-dlc-on-codex-cli"></a>
# Codex CLI での AI-DLC

`dist/codex/` は、このフレームワークが出荷するハーネス配布物の 1 つであり、OpenAI **Codex CLI** ハーネス向けです。1 つの決定論的なコアを複数のハーネスへ展開します。エンジン、状態機械、監査ログ、グラフ、swarm referee、学習用ゲートはどの配布物でもバイト単位で同一であり、異なるのはシェルだけです。このツリーは `core/` と `harness/codex/` から `bun scripts/package.ts codex` で **生成** されます。手作業で編集してはいけません（差分監視により CI が失敗します）。

<a id="prerequisites"></a>
## 前提条件

- **Codex CLI ≥ 0.139.0** - これより前のリリースでは、subagent フックの入力に実際の agent role が含まれず、ハイフンを含む agent TOML も解決できません。`/aidlc --doctor` がこの固定版を検証します。`codex --version` で確認してください。
- **bun** - Claude ハーネスと同じ要件です。すべてのツールとフックは bun 経由で実行されます。
- **モデルプロバイダー** - 同梱の `config.toml` は既定で **Amazon Bedrock** を使います（`openai.gpt-5.5`、エージェントは `openai.gpt-5.4`）。`[model_providers.amazon-bedrock.aws]` で AWS profile/region を設定してください。OpenAI 認証を使う場合は、provider の行をコメントアウトします。注意: Bedrock では `web_search` は利用できないため、Market Research ステージは自動的に縮退します。

<a id="install"></a>
## インストール

1. 配布物をプロジェクトへコピーします（Codex はプロジェクトの `.codex/hooks.json` を **Git リポジトリ** の中でしか検出しないため、対象プロジェクトは Git リポジトリである必要があります）。

   ```bash
   cp -r dist/codex/.codex/  your-project/.codex/
   cp -r dist/codex/.agents/ your-project/.agents/
   cp -r dist/codex/aidlc/   your-project/aidlc/      # the workspace shell (spaces/default/memory) — a sibling of .codex/, not inside it
   cp dist/codex/AGENTS.md   your-project/AGENTS.md   # or merge into yours
   ```

   `aidlc/` ディレクトリはワークスペースシェルです。エンジンが読む事前構築済みの `aidlc/spaces/default/memory/` メソッドツリーを含みます。これは `.codex/` の **兄弟ディレクトリ** として配置されるため、別途コピーしてください（または `dist/codex/` ツリー全体を一度にコピーしても構いません）。これが欠けていると、`$aidlc --doctor` の "workspace shell ready" 判定は失敗します。

2. 同梱 `AGENTS.md` の「Git Integration」節にある `.gitignore` 設定を、ワークフローを始める **前に** 適用してください。各 intent の `audit/` 配下にある clone ごとの監査シャードは意図的に commit されます（各 clone が自分自身の `<host>-<clone>.md` へ書き込むため、並行追記でも Git 競合しません）。一方で、利用者ごとのカーソル情報やマシン固有の実行時状態は無視したままにします。

3. プロジェクトを信頼済みにし、フック信頼設定を事前投入します。Codex は未信頼のフックを実行しません（`--dangerously-bypass-hook-trust` flag でも実行されません）。対話的な TUI セッションを 1 回起動して hooks dialog で "Trust all and continue" を選ぶか、決定論的に事前投入してください。

   ```bash
   bun scripts/package.ts codex trust --project /abs/path/to/your-project
   ```

   これは `$CODEX_HOME/config.toml` に貼り付け可能な `[hooks.state]` の設定行を出力します（hash は path ではなく hook identity を対象に計算されるため、出力される設定行は同梱 `hooks.json` に対して正確です）。

4. 同梱 `.codex/config.toml` を `~/.codex/config.toml` にマージします（またはプロジェクト単位に置いたままでも構いません。信頼済みプロジェクトはそれを読み取ります）。次で確認してください。

   ```bash
   bun .codex/tools/aidlc-utility.ts doctor
   ```

<a id="use"></a>
## 使い方

`$aidlc`（または `/skills` -> aidlc）に続けてスコープか説明を渡してオーケストレーターを起動します。コマンド体系は Claude ハーネスと同じで、`$aidlc --status`、`$aidlc --help` などが使えます。ステージランナーは明示起動のみです。`$aidlc-application-design`、`$aidlc-bugfix` などを使います（37 個のランナー説明が index を汚染しないよう、暗黙の skill matching から除外されています）。

<a id="harness-differences-vs-claude-code"></a>
## Claude Code とのハーネス差分

- **ゲート** は、同梱設定の flag が有効なときは `request_user_input` ツールで表示され、そうでない場合は番号付き文章による代替表示になります（番号または自由記述で回答します）。いずれの場合も、ゲートの意味論はエンジン側にあります。
- **カスタムステータスラインはありません** - ワークフロー位置は `update_plan` ツール（`task-progress` statusline item）と `$aidlc --status` に載ります。
- **sandbox 下の Git**: `workspace-write` は設計上 `.git` を sandbox 内で read-only に保ちます。対話セッションでは自動で昇格し、同梱 `.codex/rules/default.rules` が `git worktree` / `commit` / `add` を事前許可します。無人実行（CI、exec worker）では `writable_roots = ["<main repo>/.git"]` が必要です。テンプレートは同梱 `config.toml` にあります（linked worktree は `<main>/.git/worktrees/*` に解決されるため、main repo の `.git` を指定する必要があります）。
- **Swarm floor = `codex exec` workers** - Construction unit ごとに 1 つの headless worker をその Bolt worktree で起動し（常に `< /dev/null`）、同じ決定論的 referee を使います。ここでは `AIDLC_USE_SWARM=1` に Workflow ツールがないため、明示的に縮退し（`SWARM_DEGRADED` が監査されます）。
- **セッションのライフサイクル**: Codex には SessionEnd event がありません。未終了セッションは、次回セッション開始時に推論された `SESSION_ENDED` 監査行として整合されます。Codex 専用の PostCompact event は、compaction 後にワークフローミッションを再注入します。これは Claude ハーネスに対する決定性の改善です。
- **成果物監査の忠実度**: 無人の `codex exec` 実行では、model が shell heredoc を使って file を書くことが多く、`apply_patch` hook matcher を通らないため、`ARTIFACT_*` 行が疎になる場合があります。対話的な TUI セッション（system prompt が `apply_patch` を必須化している環境）が、高忠実度の監査モードです。
- **AIDLC のルール層** は workspace root の `aidlc/spaces/<space>/memory/` に置かれます（手作業で編集する元データは 1 つで、どのハーネスでも同一です）。`config.toml` 内の `AIDLC_RULES_DIR` 環境設定が resolver にその場所を指し、オーケストレーターは `@aidlc/spaces/<space>/memory/...` という prompt mention を注入します。Codex 標準の `.codex/rules/` directory には Starlark permission rule が置かれ、AIDLC の方法論とは別物です。
- **welcome message はありません**: Claude ハーネスでは、セッション開始時に `settings.json` の `companyAnnouncements` から Phases/Stages/Scopes の onboarding banner を表示しますが、Codex に相当機能はありません。session-start path が注入するのは resume context のみです。
- **MCP servers**: Codex は `config.toml` の `[mcp_servers.<name>]` tables（project `.codex/config.toml` または `~/.codex/config.toml`）から MCP 定義を読み込みます。必要な server はそこへ追加してください。同梱設定は **何も** 宣言しません（Claude ハーネスは `.mcp.json` で 5 つ出荷しますが、Codex は既定で 0 です）。

<a id="regenerating"></a>
## 再生成

```bash
bun scripts/package.ts codex          # regenerate dist/codex from core/ + harness/codex/
bun scripts/package.ts --check        # CI drift guard (every harness)
```

`core/tools/` と `core/hooks/` 由来のコア `.ts` files は、それぞれの `dist/codex/` 内コピーとバイト単位で同一です（`tests/unit/t150-codex-packaging.test.ts` が固定しています）。文章側には `{{HARNESS_DIR}}` token が含まれ、packager がそれを `.codex` に置換します（加えて `rules/` -> `aidlc-rules/` の rename も行います）。これが唯一許可された変換種別です。実際の end-to-end 動作確認は `tests/e2e/t-exec-codex-status.serial.test.ts` です（gate: `AIDLC_CODEX_EXEC_LIVE=1`）。

<a id="next-steps"></a>
## 次のステップ

インストールと信頼設定が完了したら、方法論自体はどのハーネスでも同じです。次はハーネス中立の章へ進んでください。

- [最初のワークフロー](../02-your-first-workflow.md) - 注釈付きの最初から最後までの実行例
- [フェーズとステージ](../04-phases-and-stages.md) - 5 つのフェーズと 32 のステージ
- [スコープ、深度、テスト戦略](../05-scopes-and-depth.md) - 実行規模の適切な見積もり方
- [用語集](../glossary.md) - すべての用語の定義

他のハーネス: [Kiro IDE での AI-DLC 実行](kiro-ide.md) · [ハーネス一覧](README.md)
