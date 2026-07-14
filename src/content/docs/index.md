---
title: AI-DLC ドキュメント
description: AI-DLC ドキュメント全体の案内ページです。
sidebarOrder: 0
sourcePath: docs/README.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 998bdebab2affb2294b2ebd14b22ad40983693b4d303086b05351171212badca
translationStatus: current
---

<a id="ai-dlc-documentation"></a>
# AI-DLC ドキュメント

**AI-DLC は方法論です**。これは AI 支援ソフトウェア開発を、構造化され、ゲートで区切られた反復可能な進め方として定義するものです（AWS により定義されています）。**このリポジトリは、そのネイティブなマルチハーネス実装です。** 方法論は、ハーネス中立な単一の `core/` から skills、agents、hooks、tools として具現化されるため、あなたがすでに使っている CLI harness の中でネイティブに動作します。現在は Claude Code、Kiro CLI、Kiro IDE、Codex CLI に対応しており、移植先の任意の対応 CLI でも動作します。方法論が *what*、各 harness distribution がそれぞれの実行環境における *how* を担い、すべての distribution は同じソースから生成されます。

初めての方は、インストールの Quick Start と "pick your harness" 表がある [README](../README.md) を参照してください。このページはドキュメント自体の地図です。

<a id="three-guides-one-per-reader"></a>
## 読者ごとの 3 つのガイド

何を変えたいかで選んでください。

| ガイド | あなたは… | 変更するのは… |
|-------|----------|-------------|
| <a id="user-guide" aria-hidden="true"></a>**[ユーザーガイド](guide/00-introduction.md)** | AI-DLC *を使って* ソフトウェアを構築する人 | フレームワーク自体は何も変えません。`/aidlc` を実行し、ゲートで回答し、成果物をレビューします |
| <a id="harness-engineer-guide" aria-hidden="true"></a>**[ハーネスエンジニアガイド](harness-engineering/00-overview.md)** | チーム向けに AI-DLC の振る舞いを *どう変えるか* を設計する人 | フレームワークが読む **データ**、つまり stages、agents、scopes、rules、sensors、knowledge と、新しい harness への移植 |
| <a id="developer-reference" aria-hidden="true"></a>**[開発者リファレンス](reference/00-overview.md)** | AI-DLC *そのもの* を変更する人 | そのデータを読む **コード**、つまり engine、hooks、CLI tools、compile pipeline、test suite |

ハーネスエンジニアガイドと開発者リファレンスの境界は **data と code**、ユーザーガイドとそれ以外の境界は **using** と **shaping** です。

<a id="running-on-a-specific-harness"></a>
## 特定のハーネスで動かす

各ガイドは harness 中立です。インストール手順と、ハーネスごとに異なるわずかな振る舞いは [他のハーネスでの実行](guide/harnesses/README.md) にまとめています（Claude Code はユーザーガイド全体で扱っており、例もそれに基づいています）。

<a id="building-and-contributing"></a>
## ビルドとコントリビュート

メンテナーは `core/` で著述し、`bun scripts/package.ts` で `dist/<harness>/` ツリーを再生成します。完全なビルドとテストの流れは [コントリビューションガイド](reference/11-contributing.md)、新しい harness を追加する方法は [新しいハーネスへの移植](harness-engineering/09-porting-to-a-new-harness.md) を参照してください。
