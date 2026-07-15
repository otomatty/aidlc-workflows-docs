# confluence-sync — aidlc-workflows docs の日本語 Confluence 同期キット

英語原文 `docs/` の内容を、**翻訳サイト（aidlc-workflows-docs）とは完全に独立した**日本語
Confluence Cloud スペースとして運用するための一式。Claude Code のスラッシュコマンド
`/sync-confluence` を手動実行して同期する。

初回だけ翻訳サイトの既存日本語訳を流用してミラー（`confluence-docs/`）を生成し、以後は
原文の git 差分を見て「既存訳を最大限保全する差分パッチ方式」（翻訳サイトの `/sync-docs`
と同じ流儀）でミラーを更新し、Atlassian MCP 経由で Confluence へ一方向 push する。
ブートストラップ以降、翻訳サイトを参照することはない。

## 構成（すべて aidlc-workflows リポジトリに配置する）

```
aidlc-workflows/
├── .claude/skills/sync-confluence/
│   ├── SKILL.md          ← /sync-confluence の実体
│   └── terminology.md    ← 訳語・文体規約（翻訳サイトから引き継ぎ）
├── scripts/confluence-sync.ts   ← ミラー生成・差分検知・emit・台帳更新の決定的ヘルパー
├── confluence-docs/      ← 日本語 Markdown ミラー（これが正。初回に自動生成）
└── data/confluence-manifest.json ← 台帳（pageId・バージョン・sourceCommit。初回に自動生成）
```

役割分担: 翻訳・判断・MCP 呼び出しは Claude（SKILL.md の手順）、機械的な変換と台帳の
整合性はスクリプト。

## セットアップ（初回のみ）

1. **ファイル配置**: この `confluence-sync/` ディレクトリの中身を、上記のパスどおり
   aidlc-workflows リポジトリへコピーする（`.claude/skills/sync-confluence/` と
   `scripts/confluence-sync.ts`）。要 bun。

2. **Atlassian MCP 接続**（aidlc-workflows のプロジェクトで一度だけ）:
   ```
   claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse
   ```
   Claude Code 内の `/mcp` から OAuth でブラウザ認証する。

3. **Confluence 側の準備**: 同期先スペース（またはスペース内の親ページ）を決めておく。
   必要な情報は ①baseUrl（`https://<site>.atlassian.net/wiki`）②スペースキー
   ③ルート親ページ ID の 3 つ。

4. **初回実行**: aidlc-workflows で Claude Code を開き `/sync-confluence` を実行。
   台帳が無ければスキルがブートストラップ手順（ミラー生成 → 接続情報の記入 → 親ページ
   作成 → 全ページ create → リンク解決の 2 次パス）を案内・実行する。
   ミラー生成は翻訳サイトのローカルクローンを参照するため、`--site` にそのパスを渡す
   （スキルが確認してくる）。

## 日常運用

原文（docs/）が更新されたら、aidlc-workflows で:

```
/sync-confluence
```

スキルは次を行う:

- `bun scripts/confluence-sync.ts --detect` で added / changed / deleted / current を分類
- changed は変更率 50% を境に差分パッチ or 全文再翻訳（既訳の文言は最大限保全）
- push 前にページのバージョン番号を照合し、**Confluence 側で直接編集されていたら警告して
  確認**（独立運用の安全装置）
- push 成功分の pageId / バージョン / sourceCommit を台帳に記録
- ミラーと台帳の変更は working tree に残して報告（コミットはユーザーがレビュー後に指示）

## 制約・既知の割り切り

- **一方向同期**。Confluence 側での編集は次回同期で検知はされるが、取り込みはされない
  （確認のうえ上書きが基本）
- **mermaid は図として描画されない**（コードブロック + 直後の「図の説明」テキストで代替）。
  Mermaid 用 Marketplace アプリを入れている場合は SKILL.md の該当項を調整する
- **ページ内アンカー**（`#fragment`）は Confluence へ持ち越せないため、リンクはページ
  単位に落ちる
- ページタイトルはスペース内で一意という Confluence の制約により、重複タイトルは
  「タイトル（セクション名）」形式に自動リネームされる（ブートストラップ時に報告あり）
