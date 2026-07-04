# aidlc-workflows-docs

[awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) の **v2 ブランチ（2.x 系）** を日次でウォッチし、変更を反映し続ける非公式のドキュメントサイトです。

**公開URL:** https://otomatty.github.io/aidlc-workflows-docs/

> [!NOTE]
> 本サイトは個人が運用する非公式・自動生成のウォッチサイトです。AWS および awslabs とは無関係であり、内容の正確性は保証されません。一次情報は必ず [awslabs/aidlc-workflows (v2)](https://github.com/awslabs/aidlc-workflows/tree/v2) を参照してください。

## AI-DLC とは

AI-DLC（AI-Driven Development Life Cycle）は、AI 支援によるソフトウェア開発を反復可能・追跡可能なフェーズに構造化する AWS 発の方法論です。aidlc-workflows の v2 系は、5 フェーズ・32 ステージのワークフローを 13 のエージェントペルソナと決定論的オーケストレーションエンジンで駆動し、Claude Code / Kiro IDE / Kiro CLI / Codex CLI の複数ハーネスへ単一ソースから配布するネイティブ実装です。

## ページ構成

| ページ | 内容 |
|--------|------|
| [index.html](index.html) | 概要 — AI-DLC とは何か、主要な数値、対応ハーネス、設計哲学 |
| [architecture.html](architecture.html) | アーキテクチャ — エンジン/コンダクター分離、ディレクティブ契約、ガード機構、状態・監査 |
| [workflow.html](workflow.html) | ワークフロー — 5 フェーズ・32 ステージ、9 スコープ、深度・テスト戦略 |
| [agents.html](agents.html) | エージェント — 13 エージェントの役割・リード/サポートステージ |
| [changelog.html](changelog.html) | 変更履歴 — 2.x 系リリースと日次差分の日本語要約 |

## 更新の仕組み

このリポジトリは、ローカルの定期タスク（Claude Cowork のスケジュール実行）によって自動更新されます。

1. 上流 `awslabs/aidlc-workflows` の v2 ブランチを clone し、`last_checked.json` に記録された前回チェック時点以降の新規コミットを検知
2. 新規コミットがあれば、changelog.html に日本語要約のエントリを追加し、バージョンバッジ・最終更新日を全ページで更新
3. ステージ構成・スコープ・エージェント・ガード機構などサイト本文に影響する変更があれば、該当ページの記述も更新
4. `last_checked.json` を最新コミットに更新し、このリポジトリへ push

新規コミットが無い日は何も push されません。

### 自動更新用マーカー

HTML 内の以下のコメントマーカーが機械更新のアンカーです。手動編集する場合は壊さないでください。

- `<!-- AUTO:version-badge -->...<!-- /AUTO:version-badge -->` — バージョンバッジ（全ページ）
- `<!-- AUTO:last-updated -->...<!-- /AUTO:last-updated -->` — 最終更新日と最新コミット sha（全ページ）
- `<!-- CHANGELOG:INSERT -->` — 新しい changelog エントリの挿入位置（changelog.html）

## ファイル構成

```
├── index.html          # 概要
├── architecture.html   # アーキテクチャ
├── workflow.html       # ワークフロー
├── agents.html         # エージェント
├── changelog.html      # 変更履歴
├── style.css           # 共通スタイル（ダークテーマ）
├── last_checked.json   # ウォッチの差分基準（最終確認コミット）
└── .nojekyll           # GitHub Pages の Jekyll 処理を無効化
```

依存ライブラリやビルド工程はなく、静的な HTML/CSS のみで構成されています。ローカルでは `index.html` をブラウザで開くだけで閲覧できます。

## ライセンス / 出典

サイト本文は上流リポジトリのドキュメント（MIT-0 ライセンス）および CHANGELOG を元に要約・翻訳したものです。上流の著作権表示はそちらのリポジトリに従います。
