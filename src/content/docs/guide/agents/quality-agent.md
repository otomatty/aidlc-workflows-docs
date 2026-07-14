---
title: 品質エージェント
description: aidlc-quality-agent の品質保証責務、主導・支援ステージ、連携方法、品質原則を説明します。
sidebarOrder: 9
sourcePath: docs/guide/agents/quality-agent.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 472acae1361d3437cea0b889ab9b4f33b266556063fed1194b291c62fd565dbb
translationStatus: current
---

<a id="quality-agent"></a>
# 品質エージェント

> **エージェント詳細** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [詳細一覧](README.md) · 技術リファレンス: [quality-agent](../../reference/agents/quality-agent.md)

aidlc-quality-agent は、あなたの QA エンジニア兼性能スペシャリストです。テスト戦略を定義し、テストスイート（単体、統合、契約、セキュリティ）を生成し、受け入れ基準に対するカバレッジを検証し、負荷試験を設計・実行し、非機能要件の目標を検証します。実装されたすべての作業ユニットが受け入れ基準を満たし、システム全体が品質ゲートを通過することを保証します。

aidlc-quality-agent は、構築で 1 つ、運用で 1 つの計 2 ステージを主導し、さらに 2 ステージを支援します。ビルドツール、テストコマンド、性能試験ユーティリティを実行するために Bash を利用できます。

<a id="stages-led"></a>
## 主導ステージ

| ステージ | フェーズ | 説明 |
|-------|-------|-------------|
| 3.6 Build and Test | 構築 | ビルド実行、テストスイート生成と実行、品質ゲート検証 |
| 4.6 Performance Validation | 運用 | 負荷試験、NFR 検証マトリクス、キャパシティプランニング |

<a id="stages-supported"></a>
## 支援ステージ

| ステージ | フェーズ | 貢献内容 |
|-------|-------|-------------|
| 2.2 Practices Discovery | 構想 | 既存コードからテスト態勢と品質実践を引き出す |
| 3.2 NFR Requirements | 構築 | テスト可能な品質特性シナリオを定義 |

<a id="what-to-expect"></a>
## 期待できること

aidlc-quality-agent が有効なときは、ビルド手順とテストスイートを生成し、それらを実装済みコードに対して実行します。Build and Test では、プロジェクトのビルドシステムを走らせ、単体テスト、統合テスト、およびそのプロジェクトに適した追加テスト種別を実行します。合格／不合格の結果、カバレッジ指標、品質ゲートの状態を報告します。

運用フェーズの Performance Validation では、負荷試験を設計・実行し、NFR 目標（レイテンシの百分位値、スループット、可用性）を検証し、目標と実測値を比較する NFR 検証マトリクスを作成します。

<a id="how-it-collaborates"></a>
## 連携方法

aidlc-quality-agent は、aidlc-product-agent から受け入れ基準付きユーザーストーリーを、aidlc-architect-agent から NFR 目標を、aidlc-developer-agent から実装済みコードを受け取ります。セキュリティテスト要件では aidlc-devsecops-agent と、CI 統合では aidlc-pipeline-deploy-agent と連携します。そのテスト結果と性能基準値は aidlc-operations-agent へ引き渡されます。

<a id="key-principles"></a>
## 主要原則

- 実装ではなく要件をテストする
- テストピラミッドに従い、多数の高速な単体テスト、より少ない統合テスト、最小限のエンドツーエンドテストを使う
- 不具合を見つけたら、修正前にそれを再現するテストを書く
- テストは実行順序や共有状態に依存してはならない
- カバレッジは目標ではなく指針であり、意味のない 100% より、考え抜かれた 70% の方が価値が高い
