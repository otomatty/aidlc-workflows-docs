# AI-DLC 日本語ドキュメントサイト設計

## 目的

`aidlc-workflows/docs` の全ドキュメントを日本語へ翻訳し、`aidlc-workflows-docs` で閲覧できる Astro サイトとして公開する。現在の日本語要約サイトの価値を残しながら、上流の User Guide、Harness Engineer Guide、Developer Reference を完全に参照できる状態にする。

## 対象範囲

- 上流 `docs/` の Markdown 89本を全文翻訳する。
- 上流 `docs/` の JSON 3本は内容を変更せず掲載する。
- 現在の概要、アーキテクチャ、ワークフロー、エージェントの要約を新しいトップページへ再構成する。
- 現在の変更履歴を `/changelog/` として維持する。
- 公開先は既存の GitHub Pages とする。
- 掲載言語は日本語のみとする。
- 原文更新の検出は自動化するが、翻訳と公開は人が確認して実行する。

## アーキテクチャ

`aidlc-workflows-docs` を Astro、TypeScript、Bun による静的サイトへ置き換える。Starlightは使用せず、Astro Content Collectionsと独自コンポーネントでドキュメントUIを構築する。

翻訳Markdownは `src/content/docs/` に置き、上流と同じ構造を保つ。

```text
src/content/docs/
├── index.md
├── guide/
├── harness-engineering/
└── reference/
```

各Markdownは次のメタデータを持つ。

- `title`
- `description`
- `sidebarOrder`
- `sourcePath`
- `sourceCommit`
- `sourceHash`
- `translationStatus`

動的ルート `src/pages/[...slug].astro` がContent Collectionsからページを生成する。上流のパスをURLへ反映し、たとえば `docs/guide/00-introduction.md` は `/aidlc-workflows-docs/guide/00-introduction/` で公開する。ドキュメント全体の入口は `/aidlc-workflows-docs/docs/` とする。

## UI構成

既存のダークテーマ、配色、日本語フォントを基礎として再利用する。UIは次の独立したAstroコンポーネントへ分割する。

- サイトヘッダー
- 階層サイドバー
- ガイド切り替え
- パンくず
- ページ内目次
- 前後ページ移動
- バージョン・更新状態表示
- モバイルナビ
- 検索ダイアログ
- Mermaid図
- GitHub Alert

トップページには現在の4つの解説ページの要点、3ガイドへの入口、上流バージョン、最終同期日を表示する。既存の変更履歴はMarkdownへ移し、専用ページで表示する。

## 翻訳方針

見出し、本文、表、注記、リンク文言、Mermaid内の説明ラベルを日本語化する。次は原文を維持する。

- CLIコマンドとフラグ
- ファイルパスとURL
- コード
- JSON/YAMLのキー
- API名、識別子、glob
- 製品名と固有名詞

`stage`、`scope`、`sensor` などAI-DLC固有概念は用語集を基準に統一する。日本語だけでは意味が曖昧になる語は初出時に英語を併記する。

翻訳開始時に上流リポジトリの完全なコミットSHAを記録する。上流 `docs/` に未コミット変更がある場合、初回インポートを中止して翻訳基準の曖昧さを防ぐ。

## Markdown処理

Astro標準のMarkdown処理にremark/rehypeプラグインを追加し、次を扱う。

- GitHub Flavored Markdownの表
- GitHub Alerts
- 見出しアンカー
- Markdown相対リンク
- 外部リンク
- Shikiコードハイライト
- Mermaidコードフェンス

上流Markdownの相対リンクは、ビルド時に公開URLへ変換する。リポジトリルートや `plugins/` などサイト外を指すリンクは、記録された上流コミットのGitHub URLへ変換する。

翻訳で見出し文言が変わっても既存リンクを保てるよう、原文見出し由来のアンカーIDを生成する。翻訳見出しとの対応は出現順ではなく、翻訳ファイルに記録した原文IDで明示する。

Mermaidはブラウザ側で描画する。描画エラー時は図のソースを表示し、情報が失われないようにする。大型テーブルは横スクロール可能にする。

## ナビゲーションと検索

サイドバーはfrontmatterとディレクトリ構造から自動生成し、次の3系統を明確に分ける。

1. User Guide
2. Harness Engineer Guide
3. Developer Reference

番号付きファイルは番号順、それ以外は明示した `sidebarOrder` 順に並べる。エージェント、ステージ詳細、研究資料、プラグイン例は親章の配下に表示する。

Pagefindをビルド後に実行し、日本語全文検索を生成する。検索は静的資産だけで動作し、外部サービスへデータを送らない。

## 上流同期

`scripts/sync-upstream.ts` はローカルの `aidlc-workflows/docs` を読み、`translation-manifest.json` と比較する。各ソースについて次の状態を報告する。

- 追加
- 変更
- 削除
- 未翻訳
- 最新

manifestには原文パス、原文SHA-256、翻訳時コミット、翻訳先、状態を保存する。同期コマンドは翻訳ファイルを自動上書きせず、機械可読JSONと人向け要約を生成する。原文が変わったページは、翻訳更新までサイト上に「原文更新後の確認が必要」と表示できる。

JSON 3本は `public/examples/` に同期し、対応する解説ページから参照できるようにする。

## エラー処理

次の問題は検証またはビルドを失敗させる。

- frontmatterの不足または型不一致
- 重複slug
- 存在しない内部リンクまたはアンカー
- manifestに存在しない翻訳ファイル
- 上流ソースに対応しない未説明の翻訳ファイル
- Mermaidフェンスの変換失敗
- Astroビルド失敗

ブラウザでのMermaid描画失敗だけはページ全体を壊さず、ソース表示へフォールバックする。存在しないURLには日本語の404ページを表示する。

## 移行と互換性

既存の `index.html`、`architecture.html`、`workflow.html`、`agents.html`、`changelog.html` の内容を新しいAstroページへ移す。旧URLには新URLへの静的リダイレクトページを生成し、既存ブックマークを可能な範囲で維持する。

既存の `last_checked.json` は新しいmanifestへ情報を移した後に廃止する。`.nojekyll` はAstroの `public/` から継続配布する。

## デプロイ

GitHub Actionsで次を順に実行する。

1. 依存関係の固定インストール
2. 型検査とlint
3. 翻訳対応・内部リンク・アンカー検証
4. Astroビルド
5. Pagefindインデックス生成
6. スモークテスト
7. GitHub Pages artifactの公開

Astroの `site` と `base` を既存Pages URLに合わせ、サブパス配下でもCSS、JavaScript、検索、内部リンクが動作するようにする。

## テスト

- 同期スクリプトの追加・変更・削除検出を単体テストする。
- URL変換、原文アンカー保持、サイドバー順序を単体テストする。
- 全92ソースと公開コンテンツの対応を検証する。
- 全内部リンクとアンカーをビルド成果物に対して検査する。
- Playwrightでトップ、3ガイド入口、検索、Mermaid、コード、モバイルナビ、404を確認する。
- GitHub Pagesのbase pathを付けたローカルプレビューでスモークテストする。

## 完了条件

- Markdown 89本を日本語で閲覧できる。
- JSON 3本へ対応する解説ページから到達できる。
- 3ガイドの階層ナビゲーションが機能する。
- 内部リンクと見出しアンカーに切れがない。
- Mermaid、表、コード、GitHub Alertsが表示できる。
- 日本語全文検索が機能する。
- 上流との差分を1コマンドで確認できる。
- 既存要約と変更履歴が失われていない。
- GitHub Pagesへ自動デプロイできる。

## 対象外

- 英語原文の併設と言語切り替え
- 原文変更の機械翻訳と無人公開
- CMSや外部検索サービス
- 上流 `docs/` 以外のリポジトリ全体の翻訳
