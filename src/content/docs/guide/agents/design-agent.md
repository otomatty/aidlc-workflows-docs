---
title: デザインエージェント
description: aidlc-design-agent の UX/UI 責務、主導・支援ステージ、連携方法、設計原則を説明します。
sidebarOrder: 2
sourcePath: docs/guide/agents/design-agent.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: dac0ea9be8112b982aa28c508f8040460fe2e487b2543d1b3aabd68dfd9fb8ef
translationStatus: current
---

<a id="design-agent"></a>
# デザインエージェント

> **エージェント詳細** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [詳細一覧](README.md) · 技術リファレンス: [design-agent](../../reference/agents/design-agent.md)

aidlc-design-agent は、あなたの UX/UI デザイナーです。アイデア創出ではワイヤーフレームとコンセプトスケッチを作成し、構想ではそれらをインタラクション仕様付きの高精細モックアップへ発展させます。情報アーキテクチャ、ナビゲーション設計、レスポンシブ挙動、アクセシビリティ要件を定義します。UI を伴わないプロジェクトでは、システムコンテキスト図と API 体験設計を作成します。

aidlc-design-agent は 2 つのステージを主導し、さらに 2 つのステージを支援します。すべてのユーザー向けインターフェースが、使いやすく、アクセシブルで、デザインシステム標準と整合していることを保証します。

<a id="stages-led"></a>
## 主導ステージ

| ステージ | フェーズ | 説明 |
|-------|-------|-------------|
| 1.6 Rough Mockups | アイデア創出 | 低忠実度のワイヤーフレームとコンセプト可視化 |
| 2.5 Refined Mockups | 構想 | インタラクション仕様とアクセシビリティを備えた高忠実度モックアップ |

<a id="stages-supported"></a>
## 支援ステージ

| ステージ | フェーズ | 貢献内容 |
|-------|-------|-------------|
| 2.4 User Stories | 構想 | ストーリーにインタラクション詳細と UX 受け入れ基準を補う |
| 2.6 Application Design | 構想 | UI コンポーネント仕様を提供 |

<a id="what-to-expect"></a>
## 期待できること

aidlc-design-agent が有効なときは、画面レイアウト、ユーザーフロー、インタラクションパターンを Markdown で詳細に記述します。対象デバイス、アクセシビリティ要件、デザインシステムの好みについて質問します。インタラクションは、読み込み中、成功、エラー、空、一部表示といった具体的な画面状態と遷移として記述します。

<a id="how-it-collaborates"></a>
## 連携方法

aidlc-design-agent は、aidlc-product-agent からインテントとユーザーストーリーを、aidlc-architect-agent からコンポーネント制約を受け取ります。そのモックアップとインタラクション仕様は、実装のために aidlc-developer-agent へ、UX 受け入れテストのために aidlc-quality-agent へ引き渡されます。

<a id="key-principles"></a>
## 主要原則

- ひと目で把握できることを重視し、重要な操作はすぐ見えるようにする
- 一貫性は認知負荷を下げる。すべての操作パターンは予測可能であるべきである
- エラーメッセージよりエラー予防を優先し、ミスしにくい設計にする
- WCAG への準拠は目標ではなく最低条件である
- 空状態、エラー状態、低速回線など、最悪条件を前提に設計する
