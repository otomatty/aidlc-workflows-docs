# aidlc-workflows-docs

`awslabs/aidlc-workflows` の日本語ドキュメントサイトです。[Blume](https://useblume.dev) で上流 `docs/` の Markdown 翻訳を公開し、上流差分の検出と GitHub Pages デプロイまでをこのリポジトリで扱います。

**公開URL:** https://otomatty.github.io/aidlc-workflows-docs/

## 主要ルート

- `/aidlc-workflows-docs/` — 翻訳ドキュメントのトップ（上流 `docs/README.md` の翻訳）
- `/aidlc-workflows-docs/guide/…` `/harness-engineering/…` `/reference/…` — 各ガイド（ルートはファイル名の数字プレフィックスを除いた形）
- `/aidlc-workflows-docs/changelog/` — 旧 v2 ウォッチサイトの changelog アーカイブ
- `/aidlc-workflows-docs/watch-prompt/` — サイトを自動更新する定期ウォッチタスクのプロンプト全文（翻訳対象外）
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
| `bun run dev` | Blume 開発サーバー |
| `bun run check` | lint → unit test → content validation → build |
| `bun run test:e2e` | Playwright（内部で build + preview） |
| `bun run sync -- --upstream <path>` | 上流との差分レポート（追加 / 変更 / 削除 / 未翻訳 / current。changed には変更規模と推奨モード patch / retranslate が付く） |
| `bun run sync -- --upstream <path> --record [docs/…​.mdx]` | 翻訳をマニフェストへ記録（引数なしは新規のみ、既存の更新は対象パスを明示） |

内部リンク・アンカー切れは `bun run build`（Blume のリンク検証）が検出します。訳語の表記揺れ（「オーケストレータ」「サーバ」など長音符の欠落）は `bun run validate:content` が検出します。

翻訳の不変条件（フェンス本文のバイト一致・URL 集合・日本語散文）は、`--upstream` に加えて `--at-recorded` を渡すとマニフェスト記録時点の原文（`git show <sourceCommit>:<sourcePath>`）と照合されます。CI はこのモードで上流 v2 を clone して全レコードを検証します。

```bash
bun scripts/validate-content.ts --upstream <path> --at-recorded
```

## 翻訳ルール

- 読者向けの見出し・本文・表・Mermaid ラベルは自然な日本語へ翻訳する
- コマンド、フラグ、パス、ID、スキーマキー、正確な UI 文言、非 Mermaid の fence 本文は LF 正規化後にバイト一致で保持する
- 見出しの直前に、上流英語見出し由来の source-authentic `<a id="...">` を置く
- frontmatter は `title` / `description` のみ（衝突回避が必要なページのみ `slug`）。ソース対応は `data/translation-manifest.json` が唯一の真実源
- コンテンツは MDX として解釈されるため、GitHub alerts は `:::note` 形式、HTML コメントは `{/* … */}`、上流への相対リンクはルート絶対（`/guide/…`）または GitHub blob URL に書き換える。表セル内のインラインコードに含まれる `|` は `\|` にエスケープする

## 同期と更新の流れ

1. 上流を clean なピン済みコミットに置く
2. `bun run sync -- --upstream <path>` で差分を確認する（`changed` = 上流が動いたページ）
3. 該当する翻訳（`docs/**/*.mdx`）を更新する
4. `bun run sync -- --upstream <path> --record docs/<更新したページ>.mdx` で記録する（新規翻訳は引数なしの `--record` で自動記録）

マニフェストのハッシュが上流と合わないページは同期レポートで `changed` として現れ、更新されるまで `--record`（引数なし）が失敗します。上流でファイルがリネームされた場合は、旧翻訳を削除し、新パスへ再翻訳してから `--record` します。

## GitHub Pages

- base path は `/aidlc-workflows-docs`（`blume.config.ts` の `deployment.base`）
- Settings → Pages → Source を **GitHub Actions** にする
- `main` への push で `.github/workflows/deploy-pages.yml` が `dist/` をデプロイする
- PR では `.github/workflows/ci.yml` が検証のみ行い、デプロイしない

## 構成

```text
blume.config.ts         # サイト設定（タイトル・検索・deployment.base など）
components.ts           # レイアウトスロット登録（PageFooter → SourceStatus）
components/             # SourceStatus.astro（ページ下部の原文リンク）
docs/                   # 翻訳 MDX（上流 docs/ をミラー）+ 各フォルダの meta.ts
data/                   # translation-manifest.json（翻訳とソースの対応）
lib/                    # ルート変換・マニフェスト・不変条件の共有ロジック
public/                 # 静的資産・legacy redirect・JSON 例
scripts/                # sync-upstream / validate-content
tests/                  # Vitest と Playwright
.github/workflows/      # CI と Pages デプロイ
```

## 由来と方針

- changelog は旧 HTML を Markdown 化したアーカイブです
- 本文の一次情報は `awslabs/aidlc-workflows` を参照してください
