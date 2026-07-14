# aidlc-workflows-docs

`awslabs/aidlc-workflows` の日本語ドキュメントサイトです。Astro で上流 `docs/` の Markdown を翻訳公開し、上流差分の検出と GitHub Pages デプロイまでをこのリポジトリで扱います。

**公開URL:** https://otomatty.github.io/aidlc-workflows-docs/

## 主要ルート

- `/aidlc-workflows-docs/` — 日本語ランディングページ
- `/aidlc-workflows-docs/docs/` — 翻訳ドキュメントの一覧とナビゲーション
- `/aidlc-workflows-docs/changelog/` — 旧 v2 ウォッチサイトの changelog アーカイブ
- 旧 `architecture.html` / `workflow.html` / `agents.html` / `changelog.html` は静的リダイレクト

## ローカル開発

```bash
bun install
bun run dev
bun run check
bun run sync -- --upstream "../../aidlc-workflows"
```

| コマンド | 用途 |
|---|---|
| `bun run dev` | Astro 開発サーバー |
| `bun run check` | lint → unit test → content validation → build → link check |
| `bun run test:e2e` | Playwright（内部で build + preview） |
| `bun run sync -- --upstream <path>` | 上流との差分レポート（追加 / 変更 / 削除 / 未翻訳 / current） |
| `bun run sync -- --upstream <path> --record` | レビュー済み翻訳のハッシュをマニフェストへ記録 |

CI と同じ一連のコマンド:

```bash
bun install --frozen-lockfile
bun run lint
bun run test
bun run validate:content
bun run build
bun run check:links
bun run test:e2e
```

## 翻訳ルール

- 読者向けの見出し・本文・表・Mermaid ラベルは自然な日本語へ翻訳する
- コマンド、フラグ、パス、ID、スキーマキー、正確な UI 文言、非 Mermaid の fence 本文は LF 正規化後にバイト一致で保持する
- 見出しの直前に、上流英語見出し由来の source-authentic `<a id="...">` を置く
- frontmatter の `sourcePath` / `sourceCommit` / `sourceHash` / `translationStatus` を真実のソースに合わせる

## 同期と stale

1. 上流を clean なピン済みコミットに置く
2. `bun run sync -- --upstream <path>` で差分を確認する
3. 翻訳を更新し、構造・リンク・文言を確認する
4. `bun run sync -- --upstream <path> --record` でレビュー済みとして記録する

上流が動いて翻訳が追いついていないページは `translationStatus: stale` になります。サイトには掲載されますが、同期レポートでは stale として扱われます。上流でファイルがリネームされた場合は、旧翻訳を削除または `sourcePath` を更新し、新パスへ再翻訳してから `--record` します。

## GitHub Pages

- base path は `/aidlc-workflows-docs`
- Settings → Pages → Source を **GitHub Actions** にする
- `main` への push で `.github/workflows/deploy-pages.yml` が `dist/` をデプロイする
- PR では `.github/workflows/ci.yml` が検証のみ行い、デプロイしない

## 構成

```text
public/                 # 静的資産・legacy redirect・JSON 例
scripts/                # sync / validate / check-links
src/content/docs/       # 翻訳 Markdown（89）
src/content/site/       # サイト固有コンテンツ（changelog など）
src/data/               # translation-manifest.json など
src/pages/              # Astro ページ
tests/                  # Vitest と Playwright
.github/workflows/      # CI と Pages デプロイ
```

## 由来と方針

- ランディングページは旧要約サイトの要点を再構成したものです
- changelog は旧 HTML を Markdown 化したアーカイブです
- 本文の一次情報は `awslabs/aidlc-workflows` を参照してください
