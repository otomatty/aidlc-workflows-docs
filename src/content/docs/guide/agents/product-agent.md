---
title: プロダクトエージェント
description: aidlc-product-agent の要件責務、主導・支援ステージ、連携方法、判断原則を説明します。
sidebarOrder: 1
sourcePath: docs/guide/agents/product-agent.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 5999b5d31a16717196bd50fa06b766b7394d55426a5234751487cb4935b0f1da
translationStatus: current
---

<a id="product-agent"></a>
# プロダクトエージェント

> **エージェント詳細** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [詳細一覧](README.md) · 技術リファレンス: [product-agent](../../reference/agents/product-agent.md)

aidlc-product-agent は、あなたのプロダクトマネージャー兼ビジネスアナリストです。生のビジネスニーズ、ユーザー要望、ドメイン知識を、構造化された要件、優先順位付きユーザーストーリー、明確なスコープ境界へ変換します。すべての下流成果物が検証済み要件へ追跡できるようにし、ステークホルダーが望むものと開発者が作るもののギャップを埋めます。

aidlc-product-agent は、アイデア創出と構想にまたがる 5 つのステージを主導します。ワークフロー初期にもっとも多く対話する主担当エージェントであり、インテントに関する明確化質問を行い、何がスコープ内か外かを定義し、その後の設計と実装を導く要件とストーリーを作成します。

<a id="stages-led"></a>
## 主導ステージ

| ステージ | フェーズ | 説明 |
|-------|-------|-------------|
| 1.1 Intent Capture & Framing | アイデア創出 | プロジェクトのインテントとステークホルダー文脈を取り込む |
| 1.2 Market Research | アイデア創出 | 競合分析と内製・購入の比較評価 |
| 1.4 Scope Definition | アイデア創出 | スコープ境界と優先順位付きインテントバックログを定義 |
| 2.3 Requirements Analysis | 構想 | 構造化された機能要件と非機能要件を作成 |
| 2.4 User Stories | 構想 | ペルソナに基づく受け入れ基準付きユーザーストーリーを作成 |

<a id="stages-supported"></a>
## 支援ステージ

| ステージ | フェーズ | 貢献内容 |
|-------|-------|-------------|
| 1.6 Rough Mockups | アイデア創出 | 取得済みインテントに照らしてモックアップを検証 |
| 1.7 Approval & Handoff | アイデア創出 | 構想概要書の完全性を検証 |
| 2.5 Refined Mockups | 構想 | ユーザーストーリーに照らしてモックアップを検証 |

<a id="what-to-expect"></a>
## 期待できること

aidlc-product-agent が有効なときは、プロジェクト目標、対象ユーザー、優先順位、制約について構造化された質問が来ると考えてください。3 つの回答方法（**Guide Me**、**Edit File**、**Chat**）を提示し、曖昧さを浮かび上がらせ、欠落を埋めるための的確な質問を行います。優先順位付けは徹底的で、必須項目と、できれば欲しい項目を切り分ける手助けをします。

<a id="how-it-collaborates"></a>
## 連携方法

aidlc-product-agent は、実現可能性と依存関係では aidlc-architect-agent と、UX 整合では aidlc-design-agent と、キャパシティとスコープ検証では aidlc-delivery-agent と密接に連携します。その出力（要件、ストーリー、スコープ）は、ほぼすべての下流エージェントに利用されます。

<a id="key-principles"></a>
## 主要原則

- すべての要件はステークホルダーの必要へ追跡できなければならず、作り話の要件を入れない
- テストで検証できないものは要件ではない
- 曖昧さは敵であり、自明に見えることほど確認する
- 量より価値を優先し、曖昧な大量バックログより、明確な少数ストーリーを選ぶ
- ストーリーは横方向ではなく、すべての層を縦断する形で切る
