---
title: コンプライアンスエージェント
description: aidlc-compliance-agent の支援責務、規制対応の役割、連携方法、判断原則を説明します。
sidebarOrder: 6
sourcePath: docs/guide/agents/compliance-agent.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: a4d21e77e416230d7349bc22086dc80119bcae040b9f66a5f147545cf67e527a
translationStatus: current
---

<a id="compliance-agent"></a>
# コンプライアンスエージェント

> **エージェント詳細** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [詳細一覧](README.md) · 技術リファレンス: [compliance-agent](../../reference/agents/compliance-agent.md)

aidlc-compliance-agent は、あなたのガバナンス、リスク、コンプライアンス（GRC）アナリストです。ライフサイクルのあらゆるステージで、適用される規制上の義務と組織のコンプライアンスポリシーを考慮させます。初期段階で規制要件を洗い出して技術的統制へ対応付け、リスク、前提、課題、依存関係をまとめる RAID ログを維持し、設計が監査上の期待を満たしていることを検証します。

aidlc-compliance-agent は支援役に専念し、主導ステージはありません。代わりに、アイデア創出、構築、運用にまたがる 4 つのステージでコンプライアンスの専門知識を提供します。

<a id="stages-led"></a>
## 主導ステージ

aidlc-compliance-agent が主導するステージはありません。

<a id="stages-supported"></a>
## 支援ステージ

| ステージ | フェーズ | 貢献内容 |
|-------|-------|-------------|
| 1.3 Feasibility & Constraints | アイデア創出 | 規制制約の特定、コンプライアンス上の実現可能性評価、RAID ログの初期化 |
| 3.2 NFR Requirements | 構築 | 規制要件と NFR の対応付け、コンプライアンス統制要件、データ分類 |
| 3.4 Infrastructure Design | 構築 | データ所在地の検証、暗号化要件、IAM コンプライアンス統制 |
| 4.2 Environment Provisioning | 運用 | コンプライアンス統制の検証、監査ログ、規制設定チェック |

<a id="what-to-expect"></a>
## 期待できること

aidlc-compliance-agent が有効なときは（主担当を支える支援エージェントとして）、規制フレームワーク、データ分類、統制マッピングに焦点を当てます。適用される規制（GDPR、HIPAA、PCI-DSS、SOC 2）、データの機微区分、既存のコンプライアンスポリシーについて質問します。コンプライアンス統制マトリクスを作成し、是正が必要なギャップを示します。

<a id="how-it-collaborates"></a>
## 連携方法

aidlc-compliance-agent は、aidlc-architect-agent からシステム設計とデータフロー情報を、aidlc-devsecops-agent からセキュリティ統制の詳細を受け取ります。設計へ反映すべきコンプライアンス要件と制約を aidlc-architect-agent へ返し、実装すべきセキュリティ統制仕様を aidlc-devsecops-agent へ提供します。

<a id="key-principles"></a>
## 主要原則

- コンプライアンスは制約であり後付けではない。リリース段階で見つかるギャップはプロジェクトの失敗である
- あらゆる統制判断はデータ分類が起点になる
- コンプライアンス上の主張には監査可能な証拠が必要であり、証明できない統制は存在しないのと同じである
- 是正は、もっとも機微なデータともっとも罰則の重い規制から優先する
- 規制リテラシーはチーム全体の取り組みであり、aidlc-compliance-agent は教育し、チームが実行する
