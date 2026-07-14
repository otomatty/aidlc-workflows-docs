---
title: "Codex Manifest Shape: Codex がアドインをどう管理するか"
description: Codex のプラグインマニフェスト、コンポーネント配線、配布モデル、ランタイム解決フローを詳述する調査レポートです。
sidebarOrder: 10
sourcePath: docs/reference/research/Codex Manifest Shape Report.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 3173fcac1359e62f43558046ef5849d8fbe507084ebe9c25d3261371bc84c285
translationStatus: current
---

<a id="codex-manifest-shape-how-codex-manages-add-ins"></a>
# Codex Manifest Shape: Codex がアドインをどう管理するか

> **詳細調査レポート** | 2026 年 6 月 26 日  
> **Sources**: OpenAI 公式ドキュメント、Codex SDK v0.16.1 (HexDocs)、HuggingFace Context Course、コミュニティガイド、GitHub issues  
> **Confidence**: 高い — 一次ソースのドキュメント + SDK 型仕様 + 実務者による検証

---

<a id="executive-summary"></a>
## エグゼクティブサマリー

OpenAI Codex は、すべてのプラグインを単一の必須ファイル `.codex-plugin/plugin.json` で識別する **manifest-first のプラグインシステム** を採用しています。このマニフェストはプラグインの識別情報を宣言し、バンドルされたコンポーネント（skills、MCP servers、app connectors、lifecycle hooks）を指し示し、マーケットプレイス表示向けのインストール面メタデータを提供します。

**主要な事実:**
- マニフェストで厳密に必須なのは `name` (kebab-case) だけ
- プラグインは最大 4 種類のコンポーネントを束ねられる: Skills (brain)、Apps (hands)、MCP Servers (nervous system)、Hooks (lifecycle)
- 配布には Git ネイティブのマーケットプレイスを使う。これはリポジトリ単位、個人用、公式のいずれにもなり得る JSON カタログ
- プラグインのインストール先は `~/.codex/plugins/cache/$MARKETPLACE/$PLUGIN/$VERSION/`
- このシステムは前方互換であり、未知のキーは `extra` maps を通じて round-trip serialization 後も保持される

---

<a id="1-manifest-file-pluginjson"></a>
## 1. マニフェストファイル: `plugin.json`

<a id="location--role"></a>
### 配置場所と役割

マニフェストは `.codex-plugin/plugin.json` に置かれます。`.codex-plugin/` ディレクトリ内で許可される唯一のファイルです。その他のすべてのコンポーネント（`skills/`、`hooks/`、`assets/`、`.mcp.json`、`.app.json`）はプラグインルートに置かれます。

マニフェストには 3 つの役割があります。
1. プラグインを **識別** する（name、version、author）
2. **バンドルされたコンポーネントを指し示す**（skills、MCP servers、apps、hooks）
3. **マーケットプレイスメタデータを提供する**（descriptions、icons、legal links、starter prompts）

<a id="complete-manifest-example"></a>
### 完全なマニフェスト例

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "description": "Bundle reusable skills and app integrations.",
  "author": {
    "name": "Your team",
    "email": "team@example.com",
    "url": "https://example.com"
  },
  "homepage": "https://example.com/plugins/my-plugin",
  "repository": "https://github.com/example/my-plugin",
  "license": "MIT",
  "keywords": ["research", "crm"],
  "skills": "./skills/",
  "mcpServers": "./.mcp.json",
  "apps": "./.app.json",
  "hooks": "./hooks/hooks.json",
  "interface": {
    "displayName": "My Plugin",
    "shortDescription": "Reusable skills and apps",
    "longDescription": "Distribute skills and app integrations together.",
    "developerName": "Your team",
    "category": "Productivity",
    "capabilities": ["Read", "Write"],
    "websiteURL": "https://example.com",
    "privacyPolicyURL": "https://example.com/privacy",
    "termsOfServiceURL": "https://example.com/terms",
    "defaultPrompt": [
      "Use My Plugin to summarize new CRM notes.",
      "Use My Plugin to triage new customer follow-ups."
    ],
    "brandColor": "#10A37F",
    "composerIcon": "./assets/icon.png",
    "logo": "./assets/logo.png",
    "screenshots": ["./assets/screenshot-1.png"]
  }
}
```

> 出典: [developers.openai.com/codex/plugins/build](https://developers.openai.com/codex/plugins/build)

---

<a id="2-field-reference"></a>
## 2. フィールドリファレンス

<a id="top-level-required-fields"></a>
### トップレベルの必須フィールド

| フィールド | 型 | 検証 |
|-------|------|------------|
| `name` | string | **空でない kebab-case** でなければならない（小文字、数字、ハイフンのみ） |

> 厳密に必須なのは `name` だけです。それ以外はすべて任意です。

<a id="top-level-optional-fields"></a>
### トップレベルの任意フィールド

| フィールド | 型 | 目的 |
|-------|------|---------|
| `version` | string | Semver 文字列（例: `"1.0.0"`）— キャッシュパスを決定する |
| `description` | string | 人が読める要約 |
| `author` | object | `{name, email?, url?}` |
| `homepage` | string | ランディングページ URL |
| `repository` | string | ソースコードリポジトリ URL |
| `license` | string | SPDX identifier（例: `"MIT"`） |
| `keywords` | string[] | 発見性のためのタグ |
| `skills` | string | skills ディレクトリへのパス（`./` で始まる必要がある） |
| `mcpServers` | string | `.mcp.json` ファイルへのパス |
| `apps` | string | `.app.json` ファイルへのパス |
| `hooks` | string/array/object | パス、またはインライン hook 定義 |
| `interface` | object | インストール面メタデータ（§3 を参照） |

<a id="the-interface-object"></a>
### `interface` オブジェクト

| JSON キー | 目的 | 制約 |
|----------|---------|------------|
| `displayName` | マーケットプレイスでのプラグイン名 | — |
| `shortDescription` | プラグインカード上の 1 行説明 | — |
| `longDescription` | 詳細ページの説明 | — |
| `developerName` | 公開者名 | — |
| `category` | マーケットプレイスカテゴリ | 例: `"Productivity"` |
| `capabilities` | ケイパビリティバッジ | 例: `["Read", "Write"]` |
| `websiteURL` | 外部リンク | — |
| `privacyPolicyURL` | プライバシーポリシー | 公開プラグインでは必須 |
| `termsOfServiceURL` | 利用規約 | — |
| `defaultPrompt` | composer 内の開始用プロンプト | **最大 3 件、各 ≤128 chars** |
| `brandColor` | 16 進カラー | 例: `"#10A37F"` |
| `composerIcon` | アイコンパス | `./assets/icon.png` |
| `logo` | ロゴパス | `./assets/logo.png` |
| `screenshots` | スクリーンショットパス | `./assets/*` パスの配列 |

---

<a id="3-validation-rules-sdk-enforced"></a>
## 3. 検証ルール（SDK により強制）

Codex SDK（Elixir、`Codex.Plugins.Manifest.parse!/1`）は、次の安定したルールを強制します。

| ルール | 詳細 |
|------|--------|
| kebab-case の名前 | 空でなく、小文字 + 数字 + ハイフンのみ |
| `./` 接頭辞が必須 | すべてのコンポーネントパスと asset パスは `./` で始まる必要がある |
| `..` による脱出不可 | パスはプラグインルートより上へ遡れない |
| `defaultPrompt` の上限 | 最大 **3** 件 |
| プロンプト長の上限 | 各 ≤**128 characters**（whitespace normalization 後） |
| 決定的な JSON | 書き出し時は末尾改行付きの安定した JSON を生成 |
| 前方互換なキー | 未知のキーは `extra` maps に保持され、round-trip 後も残る |

```elixir
# Validation API
{:ok, manifest} = Codex.Plugins.Manifest.parse(data)
Codex.Plugins.Manifest.parse!(data)  # raises on error
```

---

<a id="4-directory-layout"></a>
## 4. ディレクトリレイアウト

```
my-plugin/                          ← plugin root
├── .codex-plugin/
│   └── plugin.json                 ← REQUIRED (only file in this dir)
├── skills/                         ← "skills": "./skills/"
│   ├── code-review/
│   │   └── SKILL.md
│   └── deploy/
│       └── SKILL.md
├── hooks/
│   └── hooks.json                  ← "hooks": "./hooks/hooks.json"
├── .app.json                       ← "apps": "./.app.json"
├── .mcp.json                       ← "mcpServers": "./.mcp.json"
└── assets/
    ├── icon.png
    ├── logo.png
    └── screenshot-1.png
```

---

<a id="5-component-wiring-how-add-ins-are-referenced"></a>
## 5. コンポーネント配線: アドインがどう参照されるか

<a id="51-skills-the-brain-layer"></a>
### 5.1 Skills（"Brain" レイヤー）

**マニフェストポインタ**: `"skills": "./skills/"`

Codex は `SKILL.md` ファイルを含むサブディレクトリをこのディレクトリから走査します。各 skill は YAML frontmatter を持ちます。

```markdown
---
name: deploy-kubernetes
description: Deploy containerized apps to Kubernetes clusters.
---

## Workflow
1. Verify kubectl context...
2. Generate manifests...
```

**有効化モード:**
- **Implicit**（デフォルト）: ユーザーのタスクが `description` と意味的に一致すると自動ロード
- **Explicit**: `$skill-name` 構文で呼び出される

**設定上書き**（`config.toml`）:
```toml
[skills.deploy-kubernetes]
enabled = true
invocation = "explicit"    # or "implicit"
priority = 10              # higher wins on conflicts
```

**解決優先順位**: REPO > USER > ADMIN > SYSTEM > DEFAULTS

---

<a id="52-mcp-servers-the-nervous-system-layer"></a>
### 5.2 MCP Servers（"Nervous System" レイヤー）

**マニフェストポインタ**: `"mcpServers": "./.mcp.json"`

等価な 2 つの形式があります。

```json
// Direct server map
{
  "docs": {
    "command": "docs-mcp",
    "args": ["--stdio"]
  }
}

// Wrapped (alternative)
{
  "mcp_servers": {
    "docs": {
      "command": "docs-mcp",
      "args": ["--stdio"]
    }
  }
}
```

各 server entry は `command`（必須）、`args`（必須）、`env`（任意）を持ちます。

**サーバー単位のポリシー上書き**（`config.toml`）:
```toml
[plugins."my-plugin".mcp_servers.docs]
enabled = true
default_tools_approval_mode = "prompt"
enabled_tools = ["search"]

[plugins."my-plugin".mcp_servers.docs.tools.search]
approval_mode = "approve"
```

**Approval modes**: `"approve"`（自動実行）、`"prompt"`（ユーザーに確認）、`"deny"`（ブロック）

---

<a id="53-appsconnectors-the-hands-layer"></a>
### 5.3 Apps/Connectors（"Hands" レイヤー）

**マニフェストポインタ**: `"apps": "./.app.json"`

認証付きのサードパーティサービス connector を定義します。

```json
{
  "apps": [{
    "name": "github-connector",
    "auth": {
      "type": "oauth2",
      "client_id": "${GITHUB_CLIENT_ID}",
      "authorization_url": "https://github.com/login/oauth/authorize",
      "token_url": "https://github.com/login/oauth/access_token",
      "scopes": ["repo", "read:org"]
    }
  }]
}
```

**認証種別**: OAuth 2.0、API key  
**Auth timing**: marketplace policy により制御される — `ON_INSTALL` または `ON_FIRST_USE`

---

<a id="54-lifecycle-hooks"></a>
### 5.4 ライフサイクルフック

**マニフェストポインタ**: `"hooks": "./hooks/hooks.json"`（指定しない場合は auto-discovered）

`hooks` フィールドは **4 つの形式** を受け入れます。
1. 単一パス: `"./hooks/hooks.json"`
2. パス配列: `["./hooks/session.json", "./hooks/tools.json"]`
3. インライン object
4. インライン object の配列

**フックイベントスキーマ**:
```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "python3 ${PLUGIN_ROOT}/hooks/session_start.py",
        "statusMessage": "Loading plugin context"
      }]
    }]
  }
}
```

**サポートされるイベント**: `SessionStart`、`TurnStarted`、`TurnCompleted`、`ToolCallRequested`、`ToolCallCompleted`

**hook command で利用可能な environment variables**:
| 変数 | 説明 |
|----------|-------------|
| `PLUGIN_ROOT` | インストール済みプラグインのルートパス |
| `PLUGIN_DATA` | プラグインの書き込み可能なデータディレクトリ |
| `CLAUDE_PLUGIN_ROOT` | 互換 alias |
| `CLAUDE_PLUGIN_DATA` | 互換 alias |

**⚠️ Trust model**: プラグイン hooks は **non-managed** です。Codex は、ユーザーが hook 定義を明示的にレビューして信頼するまでそれらをスキップします。プラグインをインストールしても hooks が自動的に信頼されるわけではありません。

---

<a id="6-distribution-the-marketplace-system"></a>
## 6. 配布: マーケットプレイスシステム

<a id="marketplace-json-structure"></a>
### マーケットプレイス JSON 構造

```json
{
  "name": "repo-marketplace",
  "interface": { "displayName": "Team Plugins" },
  "plugins": [
    {
      "name": "demo-plugin",
      "source": {
        "source": "local",
        "path": "./plugins/demo-plugin"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL",
        "products": ["codex-app", "codex-cli"]
      },
      "category": "Productivity"
    }
  ]
}
```

<a id="marketplace-scopes"></a>
### Marketplace のスコープ

| ティア | 配置場所 | 可視性 |
|------|----------|------------|
| 公式 | OpenAI-hosted | すべてのユーザー |
| リポジトリ | `$REPO_ROOT/.agents/plugins/marketplace.json` | リポジトリの共同作業者 |
| 個人 | `~/.agents/plugins/marketplace.json` | 現在のユーザー |
| 旧来方式 | `$REPO_ROOT/.claude-plugin/marketplace.json` | Cross-tool 互換 |

<a id="source-types"></a>
### ソース種別

| 型 | 形式 | 用途 |
|------|--------|----------|
| `local` | `"./relative/path"` | 同一リポジトリ内プラグイン |
| `url` | 完全な HTTPS/SSH URL | スタンドアロンのプラグインリポジトリ |
| `git-subdir` | URL + subdirectory path | モノレポプラグイン |
| GitHub shorthand | `owner/repo[@ref]` | 短縮参照 |

**Git-backed marketplace entry の例:**
```json
{
  "name": "remote-helper",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/example/codex-plugins.git",
    "path": "./plugins/remote-helper",
    "ref": "main"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Productivity"
}
```

<a id="policy-controls"></a>
### ポリシー制御

| フィールド | 値 | 効果 |
|-------|--------|--------|
| `policy.installation` | `AVAILABLE`, `PREINSTALLED`, `HIDDEN` | 発見/自動インストールの挙動 |
| `policy.authentication` | `ON_INSTALL`, `ON_FIRST_USE`, `NONE` | 認証タイミング |
| `policy.products` | string[] | 特定の Codex サーフェスに限定 |

<a id="cli-commands"></a>
### CLI コマンド

```bash
# Marketplace management
codex plugin marketplace add owner/repo
codex plugin marketplace add ./local-path
codex plugin marketplace list
codex plugin marketplace upgrade
codex plugin marketplace remove <name>

# Plugin lifecycle
codex plugin install <plugin-name>
codex plugin enable <plugin-id>
codex plugin disable <plugin-id>
codex plugin remove <plugin-id>
codex plugin upgrade <plugin-id>
```

<a id="install-cache"></a>
### インストールキャッシュ

プラグインのインストール先:
```
~/.codex/plugins/cache/$MARKETPLACE_NAME/$PLUGIN_NAME/$VERSION/
```

- ローカルプラグイン: `$VERSION = "local"`
- Codex はソースではなく **cache** からロードする（offline use を可能にする）
- uninstall 後も cache は残る（再有効化をサポート）
- version 検証のために `gitCommitSha` を追跡する

<a id="plugin-state"></a>
### プラグイン状態

次の settings files により制御されます。
- ユーザー: `~/.codex/settings.json`
- プロジェクト: `./.codex/settings.json`（git 管理）
- ローカル: `./.codex/settings.local.json`（gitignored）

```json
{
  "enabledPlugins": {
    "my-plugin@repo-marketplace": true,
    "experimental@personal": false
  }
}
```

---

<a id="7-runtime-resolution-flow"></a>
## 7. ランタイム解決フロー

```
                    ┌─────────────────────────────┐
                    │    .codex-plugin/plugin.json │
                    └──────────────┬──────────────┘
           ┌───────────┬──────────┼──────────┬──────────────┐
           ▼           ▼          ▼          ▼              ▼
      "skills"    "mcpServers"  "apps"    "hooks"     "interface"
      "./skills/" "./.mcp.json" ".app"   "./hooks/"   (metadata)
           │           │          │          │
           ▼           ▼          ▼          ▼
    ┌──────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐
    │ Scan for │ │ Spawn   │ │Resolve │ │ Await   │
    │ SKILL.md │ │ process │ │ creds  │ │ user    │
    │ files    │ │ per     │ │(OAuth/ │ │ trust   │
    │          │ │ entry   │ │ APIkey)│ │ review  │
    └────┬─────┘ └────┬────┘ └───┬────┘ └────┬────┘
         ▼            ▼          ▼           ▼
    ┌──────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐
    │ Index by │ │Register │ │Register│ │ Execute │
    │ name+desc│ │ tools   │ │ caps   │ │ command │
    │ for auto │ │ in agent│ │ as     │ │ on      │
    │ matching │ │         │ │ tools  │ │ event   │
    └──────────┘ └─────────┘ └────────┘ └─────────┘
```

**At install**: ファイルを cache にコピー → コンポーネントを登録  
**At runtime**: 有効化されたプラグインをロード → skills を索引化 → MCP servers を起動 → apps を有効化 → 信頼済み hooks を待機状態にする

---

<a id="8-ecosystem-comparison"></a>
## 8. エコシステム比較

| 観点 | Codex | Claude Code | Cursor | VS Code |
|-----------|-------|-------------|--------|---------|
| モデル | マニフェスト優先 | マニフェスト優先 | IDE ネイティブ | Extension API |
| マニフェスト | `.codex-plugin/plugin.json` | `.claude-plugin/plugin.json` | N/A | `package.json` |
| 配布 | Git repos + cache | Git repos + cache | 中央ストア | `.vsix` packages |
| コンポーネント | Skills + MCP + Apps + Hooks | Skills + MCP + Hooks + LSP | 拡張機能 | 拡張機能 |
| オフライン | ✅ | ✅ | ❌ | ✅ |
| クロスツール MCP | ✅ | ✅ | ✅（consumer） | ❌ |

**重要な洞察**: MCP は普遍的な相互運用レイヤーです。よく作られた MCP server は Codex、Claude Code、Cursor のすべてで動作します。ラッピング層（marketplace metadata、skill definitions）はツール固有ですが、機能的な基盤は移植可能です。

---

<a id="9-minimal--published-progression"></a>
## 9. 最小構成から公開品質への進行

<a id="absolute-minimum-valid"></a>
### 最小構成（有効）
```json
{ "name": "my-plugin" }
```

<a id="minimal-functional"></a>
### 最小の実用構成
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Reusable greeting workflow",
  "skills": "./skills/"
}
```

<a id="published-quality"></a>
### 公開品質
§1 の例にあるすべてのフィールドを含み、特に次に注意します。
- `interface.privacyPolicyURL` と `termsOfServiceURL`（公式ディレクトリでは必須）
- `interface.defaultPrompt`（最大 3 件 × 128 文字の開始用プロンプト）
- `interface.logo` と `screenshots`（マーケットプレイスでの存在感）
- 少なくとも `name` を含む `author`
- 発見性のための `keywords`

---

<a id="10-key-takeaways"></a>
## 10. 重要な要点

1. **Manifest-first は宣言的** — インストール時にコードは実行されず、JSON は検査可能かつポータブル
2. **必須なのは `name` のみ** — 最小構成で始め、必要に応じて複雑さを追加できる
3. **3 層アーキテクチャ** が関心を分離する: Skills（knowledge）、Apps（auth）、MCP（tools）
4. **信頼は明示的** — hooks は自動実行されず、ユーザーがレビューして承認する必要がある
5. **前方互換** — 未知のキーは `extra` maps を通じた SDK round-trip 後も保持される
6. **Git ネイティブ配布** — プラグインはリポジトリに存在し、コンパイルもビルドステップも不要
7. **MCP が移植性レイヤー** — 同じ servers が Codex、Claude Code、Cursor をまたいで動作する

---

*3 つの並列リサーチトラックから編集。個別エージェントファイルは `artifacts/research/codex-manifest-shape/` にあります。*  
*主要ソース: [OpenAI Codex Docs](https://developers.openai.com/codex/plugins/build), [Codex SDK HexDocs](https://hexdocs.pm/codex_sdk/13-plugin-authoring.html), [HuggingFace Context Course](https://huggingface.co/learn/context-course/unit3/anatomy.md)*
