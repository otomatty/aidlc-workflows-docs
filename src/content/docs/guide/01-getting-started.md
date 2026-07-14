---
title: はじめに
description: この実装のインストール、環境確認、最初のワークフロー準備を説明します。
sidebarOrder: 1
sourcePath: docs/guide/01-getting-started.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 180434163ae1fd808ea87a844165a212ff91f183c103da1ef823b721d8db2533
translationStatus: current
---

<a id="getting-started"></a>
# はじめに

この章では、この実装のインストール方法、環境の確認方法、そして最初のワークフローに向けた準備を順に説明します。

---

<a id="prerequisites"></a>
## 前提条件

この実装を使うには、システム上に 2 つのツールが必要です。

| 前提条件 | 目的 | インストール |
|-------------|---------|---------|
| **Claude Code** | この実装は Claude Code の command として動作します。orchestrator、agents、hooks はすべて Claude Code の中で実行されます。 | Native install（推奨、auto-updates あり）: macOS/Linux/WSL `curl -fsSL https://claude.ai/install.sh \| bash`; Windows PowerShell `irm https://claude.ai/install.ps1 \| iex`。または `brew install --cask claude-code`。([docs](https://code.claude.com/docs/en/quickstart)) |
| **bun** | すべての CLI tools と 12 個すべての hooks（state management、audit logging、sensor dispatch、runtime-graph compile、loop enforcement、reviewer scope enforcement、statusline、human-turn mint）に必要です。すべて TypeScript で書かれており、bun 経由で実行されます（起動は約 20ms）。追加の依存関係はなく、macOS、Linux、native Windows PowerShell で同一に動作します。 | `curl -fsSL https://bun.sh/install \| bash` ([docs](https://bun.sh))。Windows では `npm install -g bun` または `powershell -c "irm bun.sh/install.ps1 \| iex"` |

> **重要**: `bun` は non-interactive shell から見える `PATH` 上になければなりません。Claude Code は shell を non-interactively 実行するため、`~/.zshrc` ではなく `~/.zshenv`（zsh）または `~/.bashrc`（bash）を読み込みます。Windows で Git Bash を使う場合は `~/.bashrc` が正しいファイルです。Claude Code 内で `which bun` が失敗する場合は、bun の PATH export をその適切なファイルに追加してください。

前提条件を確認します。

```bash
command -v claude >/dev/null && echo "✓ Claude Code installed" || echo "✗ Install Claude Code first"
command -v bun    >/dev/null && echo "✓ bun installed"          || echo "✗ Install bun first"
```

<a id="aws-bedrock-setup"></a>
## AWS Bedrock セットアップ

この実装は **AWS Bedrock** 向けに設定済みの状態で出荷されます。配布される `.claude/settings.json` には次が設定されています。

| 変数 | 値 | 目的 |
|----------|-------|---------|
| `CLAUDE_CODE_USE_BEDROCK` | `1` | Claude Code を Bedrock 経由で実行する |
| `AWS_REGION` | `us-east-1` | Bedrock region。**必須**です。Claude Code はこれを `~/.aws` から読みません。リージョンごとの上書きは後述します |
| `ANTHROPIC_DEFAULT_FABLE_MODEL` | `global.anthropic.claude-fable-5[1m]` | `fable`/`fable[1m]` を選ぶ利用者向けの Fable alias |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `global.anthropic.claude-opus-4-8[1m]` | orchestrator model（`opus[1m]` で使用される 1M-context variant） |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `global.anthropic.claude-sonnet-4-6[1m]` | subagent model |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | background/fast tasks（`[1m]` なし。Haiku 4.5 は 1M variant のない 200K model のため） |

これらの model pin は、global Bedrock inference profile ID（`global.` prefix）を使用しています。Fable、Opus、Sonnet の pin に付いている `[1m]` suffix は 1M-context variant を選ぶためのものです。これにより、tier-pinned subagents も（`opus[1m]` の orchestrator だけでなく）1M window を利用できます。Claude Code は model ID が Bedrock に渡る前にこの suffix を取り除きます。ただし、AWS アカウント側のセットアップは一度だけ必要です。

<a id="one-time-aws-account-setup-manual-path"></a>
### AWS アカウントの初回セットアップ（手動手順）

1. **Anthropic model access を有効化します。** [Amazon Bedrock console](https://console.aws.amazon.com/bedrock/) で **Model catalog** を開き、使用する各 Anthropic model（Fable、Opus、Sonnet、Haiku）を選択して use-case form を送信してください。アクセスは即時で付与されます。どの model も呼び出す前に、AWS アカウントごとに一度必要です。（AWS Organizations では management account から一度送信すれば、child account にも承認が広がります。）

2. **IAM permissions を付与します。** role/user には model invocation と inference profile 解決のために次が必要です。

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowModelAndInferenceProfileAccess",
         "Effect": "Allow",
         "Action": [
           "bedrock:InvokeModel",
           "bedrock:InvokeModelWithResponseStream",
           "bedrock:ListInferenceProfiles",
           "bedrock:GetInferenceProfile"
         ],
         "Resource": [
           "arn:aws:bedrock:*:*:inference-profile/*",
           "arn:aws:bedrock:*:*:application-inference-profile/*",
           "arn:aws:bedrock:*:*:foundation-model/*"
         ]
       }
     ]
   }
   ```

3. **AWS credentials を提供します。** Claude Code は既定の AWS SDK credential chain を使用します。次のいずれか 1 つで構いません。

   ```bash
   aws configure                         # static access key / secret
   # — or — an SSO profile:
   aws sso login --profile <your-profile>
   export AWS_PROFILE=<your-profile>
   # — or — credentials already exported in your environment (AWS_ACCESS_KEY_ID, etc.)
   ```

   secrets は共有の `settings.json` に入れないでください。漏らしたくない `AWS_PROFILE`（または他の env） は `.claude/settings.local.json`（gitignored）に置いてください。

4. **region を設定します。** もし `us-east-1` でない場合、共有設定を編集せずに上書きできます。出荷時の既定値は `us-east-1` です。

   ```bash
   cp .claude/settings.local.json.example .claude/settings.local.json
   # then add  "AWS_REGION": "<your-region>"  to the env block
   ```

   `settings.local.json` は `settings.json` より優先されます。`aws bedrock list-inference-profiles --region <your-region>` で、その region で model が利用可能か確認してください。

> **より簡単な経路:** 上の手動手順の代わりに `claude` を起動し、ログインプロンプトで **3rd-party platform → Amazon Bedrock** を選ぶと、wizard が credentials、region、利用可能な models を検出して user settings に書き込みます。変更したいときはいつでも `/setup-bedrock` を再実行できます。それでも step 1（model access）は console で一度だけ完了する必要があります。

常に最新で権威あるセットアップ手順、つまり IAM detail、SSO refresh、inference profiles、troubleshooting については、AWS のガイド **[Claude Code on Amazon Bedrock: Quick Setup Guide](https://community.aws/content/2tXkZKrZzlrlu0KfH8gST5Dkppq/claude-code-on-amazon-bedrock-quick-setup-guide)** と [Amazon Bedrock documentation](https://docs.aws.amazon.com/bedrock/) を参照してください。

<a id="mcp-servers-optional"></a>
## MCP サーバー（任意）

この実装は、project root（`.claude/` の隣）にある `.mcp.json` で MCP servers を宣言します。Claude Code はそれらを session に provision し、すべての AI-DLC agent がそれらを継承します。つまり、宣言された server にはどの agent も個別の grant なしで到達できます。出荷される `.mcp.json` には 5 つの MCP servers が宣言されています。

| サーバー | 提供機能 | 転送方式 | 認証情報 |
|--------|----------|-----------|-------------|
| `context7` | Library/SDK documentation lookups | HTTP | 環境変数の `CONTEXT7_API_KEY` |
| `aws-mcp` | AWS API access | `uvx` (`mcp-proxy-for-aws@latest`, `AWS_REGION=us-east-1`) | Standard AWS credential chain |
| `aws-pricing` | AWS pricing queries | `uvx` (`awslabs.aws-pricing-mcp-server@latest`) | AWS credential chain |
| `aws-iac` | Infrastructure-as-code tooling | `uvx` (`awslabs.aws-iac-mcp-server@latest`) | AWS credential chain |
| `aws-serverless` | Serverless tooling | `uvx` (`awslabs.aws-serverless-mcp-server@latest`) | AWS credential chain |

<a id="prerequisites-1"></a>
### 前提条件

4 つの AWS server は `uvx` 経由で起動します。`uv`/`uvx` を一度インストールしてください。

```bash
curl -fsSL https://astral.sh/uv/install.sh | sh
```

`context7` は HTTP server なのでローカルインストールは不要です。使うには API key を export します。

```bash
export CONTEXT7_API_KEY=<your-key>
```

`CONTEXT7_API_KEY`（およびその他の secret env）は共有の `settings.json` ではなく `.claude/settings.local.json`（gitignored）に置いてください。`.mcp.json` 自体には env-var placeholder しか含まれず、secrets は commit されません。

<a id="what-becomes-available"></a>
### 利用可能になるもの

4 つの AWS server は、Claude Code が Bedrock に使うのと同じ既定の AWS SDK credential chain で認証します（[AWS Bedrock セットアップ](#aws-bedrock-setup) を参照）。`uvx` がインストールされ、AWS credentials が解決できれば、それらの server は自動的に起動します。`context7` は `CONTEXT7_API_KEY` を設定すると起動します。servers は session level で継承されるため、どの agent も宣言されたすべての server に到達できます。agent ごとの grant 作業はありません。

> **特定の agent を制限する（高度な設定）:** 継承は加算的です。server を宣言すると、すべての agents で利用可能になります。agent ごとの grant はできません。ある agent が特定の server を使えないようにするには、その agent の `tools:` allowlist を、その agent が呼んでよい fully-qualified `mcp__<server>__<tool>` id のみに絞ってください（裸の `mcp__<server>` token は認識されません）。agent の tool access の仕組みは [エージェント](06-agents.md) を参照してください。

<a id="not-using-these"></a>
### これらを使わない場合

credentials がなくてもブロッカーにはなりません。credentials を持たない server、つまり AWS chain がないものや `CONTEXT7_API_KEY` がないものは単に unavailable になるだけです。ワークフローはそれなしで動作し、それを待って停止することはありません。server 自体を外したい場合は、`.mcp.json` からその entry を削除してください。

---

<a id="installation"></a>
## インストール

AI-DLC のインストールは、使用する harness 向け distribution を project にコピーする形で行います。以下の手順は **Claude Code**（`dist/claude/.claude/` tree）を対象としています。Kiro または Codex を使う場合は、それぞれ専用の distribution とインストール手順があるので、[Kiro IDE での実行](harnesses/kiro-ide.md) または [Codex CLI での実行](harnesses/codex-cli.md) を参照してください。Claude Code 実装は、project にコピーする `.claude/` directory として提供されます。

<a id="step-1-copy-the-implementation"></a>
### 手順 1: 実装をコピーする

```bash
cp -r dist/claude/.claude/ your-project/.claude/
cp -r dist/claude/aidlc/   your-project/aidlc/     # the workspace shell — a sibling of .claude/, not inside it
```

1 行目は engine、つまり orchestrator、stage files、agent personas、hooks、knowledge files、default settings をコピーします。2 行目は **workspace shell** をコピーします。これは engine が読む、事前構築済みの `aidlc/spaces/default/memory/` method tree です。これは `.claude/` の **sibling** として出荷されるため（中ではありません）、別途コピーする必要があります。あるいは `dist/claude/` tree 全体をまとめてコピーしても構いません。`aidlc/spaces/default/memory/` がないと、`/aidlc --doctor` の "workspace shell ready" check は失敗します。

<a id="step-2-navigate-to-your-project"></a>
### 手順 2: プロジェクトへ移動する

```bash
cd your-project
```

すべての `/aidlc` commands は project root を基準に実行されます。

---

<a id="the-workspace-shell"></a>
## ワークスペースシェル (Workspace Shell)

scaffold step はありません。コピーした distribution にはすでに workspace shell、つまり `.claude/` engine と、memory layer（team-affirmed practices と learnings が保存される `aidlc/spaces/default/memory/`）を持つ事前構築済みの `aidlc/spaces/default/` が含まれています。init command を実行する必要はありません。

最初に `/aidlc` を実行したとき（あるいは作りたいものを説明したとき）、engine は active space の中に最初の intent を **auto-birth** します。各 intent は `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` に自身の record dir を持ち、その中には次が含まれます。

- `aidlc-state.md` — intent ごとの workflow state
- `audit/` — audit trail。per-clone shards（`<host>-<clone>.md`）として書かれます
- `<phase>/<stage>/...` — stage artifacts（例: `inception/requirements-analysis/requirements.md`）

team knowledge は 1 つ上の space level、つまり `aidlc/spaces/<space>/knowledge/`（`intents/` の sibling）に置かれるため、その space のすべての intents を通して蓄積されます。engine はそこを空で作成し、あなたは任意で `aidlc-shared/` や agent ごとの subdirectory の下に free-form files を追加します。

最初の実行前に [チームナレッジ](08-knowledge.md) や team practices を追加したい場合は、出荷済みの `aidlc/spaces/default/memory/` files を編集してください。space level の `aidlc/knowledge/` directory は、最初の `/aidlc` 実行時に空の状態で作成されます。

workspace layout の全体像、つまりどのように複数の intents を同時に保持するか、spaces が何のためにあるか、それらを移動する command は何かについては、[スペースとインテント](03-spaces-and-intents.md) を参照してください。

---

<a id="verify-the-setup"></a>
## セットアップを確認する

ヘルスチェックを実行し、すべてが正しく揃っていることを確認します。

```
/aidlc --doctor
```

`--doctor` は、すべての check が通れば exit 0、いずれかが失敗すれば exit 1 になります。どちらの場合も、完全な report は stdout に書き出されます。

<a id="what-doctor-checks"></a>
### `--doctor` が確認すること

| チェック | 検証内容 |
|-------|-------------------|
| Prerequisites | `bun` がインストールされ、`$PATH` 上にあること |
| Hook presence | `settings.json` が配線しているすべての hook（その `hooks` blocks と `statusLine` command、つまり framework の 12 hooks 全体）が `.claude/hooks/` に存在すること。配線済みなのに欠けている hook は大きく失敗します。期待 roster を `settings.json` から取るため、そこに hook を追加すれば自動的に check 対象になります |
| Project structure | `.claude/settings.json` があり、期待どおりの設定であること |
| Workspace shell | `.claude/` と `aidlc/spaces/default/memory/` が存在すること（出荷済み shell） |
| State file | active intent の `aidlc-state.md` がその audit trail と一致していること（drift なし） |
| Hook heartbeats | `.aidlc-hooks-health/` に hook executions からの recent timestamps が入っていること |
| Graph integrity | `stage-graph.json` に cycle がなく、すべての slug に対応する stage file があること |
| Scope validation | 9 つすべての scopes が graph に対して正常に walk できること（scope truncation gaps に関する advisory は想定内です） |
| Schema + references | すべての stage の YAML frontmatter が妥当で、すべての consumes/requires_stage reference が解決できること |
| Keyword overlap | `.claude/scopes/*.md` files 全体で、同じ keyword を複数 scope が主張していないこと |
| Pending-compose marker | `aidlc/.aidlc-compose-pending`（in-flight compose gate marker）が存在する場合、その age を報告します。fresh（24h 未満。open compose gate では通常状態）は advisory として pass、stale（crashed compose gate に取り残された状態）は fail します。存在しなければ無言です。対処: compose gate が pending でないなら削除し、pending ならその gate を解決してください |

<a id="example-output"></a>
### 出力例

```
✓ bun installed (required for CLI tools and hooks)
✓ aidlc-audit-logger.ts present
✓ aidlc-sync-statusline.ts present
✓ aidlc-validate-state.ts present
✓ aidlc-log-subagent.ts present
✓ aidlc-session-start.ts present
✓ aidlc-session-end.ts present
✓ aidlc-statusline.ts present
✓ settings.json present
✓ AWS_AIDLC_DEFAULT_SCOPE (unset — no project default)
✓ workspace shell ready (.claude/ + aidlc/spaces/default/memory/)
✓ Hook heartbeats: not yet fired (first workflow stage will populate)
✓ State matches last audit event (no drift)
✓ Cycle detection: 0 cycles
✓ Orphan stage files: 32 graph entries all have files
✓ Scope validation: 9 scopes valid (29 advisories)
✓ Schema validation: 32/32 stages valid
✓ Graph references: 122 artifacts + edges resolved
✓ Keyword overlap: no conflicts
```

<a id="fixing-failures"></a>
### 失敗の直し方

| 失敗 | 修正方法 |
|---------|-----|
| `bun` not installed | `curl -fsSL https://bun.sh/install \| bash` でインストールします。Windows では `npm install -g bun` または `powershell -c "irm bun.sh/install.ps1 \| iex"`。non-interactive shell から見える PATH 上にあることを確認してください |
| Hook not present | distribution から `.claude/` directory を再コピーします |
| `settings.json` missing | distribution から再コピーします: `cp dist/claude/.claude/settings.json .claude/settings.json` |
| Workspace shell missing | `dist/claude/` から workspace shell を project root に再コピーします |
| State file issues | active intent の record dir を `aidlc/spaces/<space>/intents/` 配下で archive し、`/aidlc` を実行して新しく始めます |
| Graph/scope/schema/keyword failures | diagnostic が fault のある artifact、slug、scope name を具体的に報告します。これは `.claude/aidlc-common/stages/` や `.claude/scopes/` の authoring drift を示します。`bun .claude/tools/aidlc-graph.ts compile` で compiled graph + scope grid を再生成するか、名指しされた stage/scope を直接調べてください |

---

<a id="start-your-first-workflow"></a>
## 最初のワークフローを始める

`--doctor` が通れば、次を実行する準備が整っています。

```
/aidlc Build a REST API for inventory management
```

または、scope を直接指定することもできます。

```
/aidlc feature
/aidlc bugfix Fix the login timeout issue
```

この後に何が起きるかを段階的に確認するには、[最初のワークフロー](02-your-first-workflow.md) を参照してください。

---

<a id="quick-reference"></a>
## クイックリファレンス

shell では次のように実行します。

```bash
# Verify prerequisites
command -v claude >/dev/null && echo "✓ Claude Code" || echo "✗ Claude Code"
command -v bun    >/dev/null && echo "✓ bun"          || echo "✗ bun"

# Install (engine + the workspace shell sibling)
cp -r dist/claude/.claude/ your-project/.claude/
cp -r dist/claude/aidlc/   your-project/aidlc/

# Launch Claude Code in your project
cd your-project && claude
```

Claude Code session の中では次のように実行します。

```
# Verify (exits 1 on any check failure; read stdout for the full report)
/aidlc --doctor

# Start
/aidlc Build a task management API with user authentication
```

---

<a id="tool-permissions"></a>
## ツール権限 (Tool Permissions)

同梱されている `.claude/settings.json` では、Claude Code tools（Read、Edit、Write、Bash、Glob、Grep、Task、WebSearch）が事前承認されているため、ワークフロー中に call ごとの permission prompt が出ません。使用前にこの file を確認し、自身の security requirements に合わせて調整してください。

[カスタマイズ](13-customization.md) には tool permissions を変更する詳細があります。

---

<a id="next-steps"></a>
## 次のステップ

- [最初のワークフロー](02-your-first-workflow.md) — 完全な実行を注釈付きで追うウォークスルー
- [スコープ、深度、テスト戦略](05-scopes-and-depth.md) — task に適した scope の選び方
- [トラブルシューティング](15-troubleshooting.md) — よくある問題と対処
- [用語集](glossary.md) — 用語リファレンス
