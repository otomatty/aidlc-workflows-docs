---
title: アーキテクトエージェント
description: aidlc-architect-agent が担う設計責務、主導・支援ステージ、連携方法、判断原則を説明します。
sidebarOrder: 4
sourcePath: docs/guide/agents/architect-agent.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 993cf02e9f01db6f7f83f4aa7afe62ecea60784baa9ee487d6574362715ad2a2
translationStatus: current
---

<a id="architect-agent"></a>
# アーキテクトエージェント

> **エージェント詳細** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [詳細一覧](README.md) · 技術リファレンス: [architect-agent](../../reference/agents/architect-agent.md)

aidlc-architect-agent は、あなたのソリューションアーキテクトです。要件を堅牢なシステムアーキテクチャへ変換し、アーキテクチャ判断記録（ADR）を作成し、ドメインモデルを設計し、プロジェクトを実装可能な作業ユニットへ分解します。パターンとトレードオフの観点で考え、開発者がそのまま実装に移せる設計を生み出します。

aidlc-architect-agent は、ライフサイクル全体でもっとも多くのステージを主導します。合計 6 ステージを担当し、アイデア創出、構想、構築にまたがります。このエージェントは主要な設計責任者であり、高度な判断を要するほかの 7 エージェントと同様に `judgment` ティアを担います。そのため特定のモデルを固定せず、あなたのセッションで選択したモデルと推論強度を継承します。`templated` ティア（推論強度を抑えた中規模モデル）を担うのは、デリバリー、パイプラインとデプロイ、オペレーションズの各エージェントだけです。これらの出力は、主として定型化された計画や設定だからです。

<a id="stages-led"></a>
## 主導ステージ

| ステージ | フェーズ | 説明 |
|-------|-------|-------------|
| 1.3 Feasibility & Constraints | アイデア創出 | 技術的実現可能性の評価と制約分析 |
| 2.6 Application Design | 構想 | コンポーネント設計、API 契約、ADR |
| 2.7 Units Generation | 構想 | 設計を実装可能な作業ユニットへ分解 |
| 3.1 Functional Design | 構築 | 詳細なドメインモデルとビジネスロジック（ユニットごと） |
| 3.2 NFR Requirements | 構築 | 測定可能な目標を持つ非機能要件（ユニットごと） |
| 3.3 NFR Design | 構築 | キャッシュ、レジリエンス、セキュリティに対する技術的アプローチ（ユニットごと） |

加えて、ステージ 2.1（Reverse Engineering）の統合ステップも主導します。ここでは aidlc-developer-agent からコードスキャン結果を受け取り、9 個のアーキテクチャ成果物を作成します。

<a id="stages-supported"></a>
## 支援ステージ

| ステージ | フェーズ | 貢献内容 |
|-------|-------|-------------|
| 1.1 Intent Capture | アイデア創出 | 技術的な文脈を提供 |
| 2.1 Reverse Engineering（統合ステップ） | 構想 | コードスキャン結果を一貫したアーキテクチャモデルへ統合 |
| 2.8 Delivery Planning | 構想 | アーキテクチャ依存関係に照らしてビルド順序を検証 |

<a id="what-to-expect"></a>
## 期待できること

aidlc-architect-agent が有効なときは、境界、パターン、トレードオフに重点を置きます。既存システムの制約、技術選好、スケーラビリティ要件、運用上の懸念について質問します。明示的な判断根拠を添えた構造化された設計文書、Markdown で記述したコンポーネント図、そして重要な選択ごとの ADR を生成します。

<a id="how-it-collaborates"></a>
## 連携方法

aidlc-architect-agent は、aidlc-product-agent から要件を、aidlc-developer-agent からコードスキャン結果を受け取ります。AWS サービスへの割り当てでは aidlc-aws-platform-agent と、安全な設計では aidlc-devsecops-agent と、規制制約では aidlc-compliance-agent と連携します。その出力（ユニット仕様、API 契約、NFR 目標）は aidlc-developer-agent、aidlc-quality-agent、aidlc-aws-platform-agent によって利用されます。

<a id="key-principles"></a>
## 主要原則

- すべての設計成果物は、明示的な根拠を伴う判断に追跡できなければならない
- コンポーネント境界を正しく定めることは、内部詳細より重要である
- コンポーネント間依存は徹底して最小化する
- 再利用より変更容易性を優先して設計する
- 暗黙の前提は明示する。データフロー、所有者、失敗モードを表に出す
- 元に戻しやすい判断を優先し、戻せない判断は特に慎重に扱う
