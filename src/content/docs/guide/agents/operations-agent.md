---
title: オペレーションズエージェント
description: aidlc-operations-agent の運用責務、主導ステージ、連携方法、運用原則を説明します。
sidebarOrder: 11
sourcePath: docs/guide/agents/operations-agent.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: a442c5322f0f55908f8150c3803410151cdf25fbbf898a1718e8ac129620cec9
translationStatus: current
---

<a id="operations-agent"></a>
# オペレーションズエージェント

> **エージェント詳細** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [詳細一覧](README.md) · 技術リファレンス: [operations-agent](../../reference/agents/operations-agent.md)

aidlc-operations-agent は、あなたのサイト信頼性エンジニア（SRE）兼インシデント管理者です。デプロイ済みシステムが可観測で、レジリエントで、継続的に改善される状態を保証します。CloudWatch のダッシュボードとアラームから、X-Ray のトレーシング、SLO の追跡、インシデント対応手順書、カオスエンジニアリングによる検証まで、運用レイヤー全体を担います。とくに重要なのは、本番環境の知見を次の反復のためにアイデア創出へ戻し、フィードバックループを閉じることです。

aidlc-operations-agent は、運用フェーズの 3 つのステージを主導します。監視設定コマンド、運用手順書のスクリプト、診断ツールを実行するために Bash を利用できます。

<a id="stages-led"></a>
## 主導ステージ

| ステージ | フェーズ | 説明 |
|-------|-------|-------------|
| 4.4 Observability Setup | 運用 | ダッシュボード、アラーム、トレーシング、構造化ログ、カスタムメトリクス |
| 4.5 Incident Response | 運用 | SSM 運用手順書、インシデント計画、エスカレーションマトリクス、オンコール体制 |
| 4.7 Feedback & Optimization | 運用 | SLO レポート、コスト分析、ドリフト検知、フィードバックループ |

aidlc-quality-agent が 4.6 Performance Validation を主導します。このエージェントが 4.4 で整備する運用テレメトリと基準値は、その作業へ非公式には流れ込みますが、4.6 における正式な支援エージェントではありません。

<a id="stages-supported"></a>
## 支援ステージ

ありません。aidlc-operations-agent は主導専任のエージェントであり、ほかのエージェントのステージは支援しません。主導ステージはすべて運用フェーズにあり、そこでライフサイクルのループを閉じます。

<a id="what-to-expect"></a>
## 期待できること

aidlc-operations-agent が有効なときは、監視の好み、SLO 目標、インシデント対応の流れ、オンコール体制について質問します。CloudWatch ダッシュボード設定、しきい値と通知先を備えたアラーム定義、X-Ray トレーシング設定、一般的なシナリオ（サービス再起動、キャッシュフラッシュ、フェイルオーバー）向けの SSM 運用手順書、そしてエスカレーション経路付きのインシデント重大度定義を作成します。

最終ステージである Feedback & Optimization では、本番メトリクスを分析し、最適化の機会を見つけ、運用上の知見を次の開発サイクルのために aidlc-product-agent へ戻すフィードバックループ文書を作成します。

<a id="how-it-collaborates"></a>
## 連携方法

aidlc-operations-agent は、aidlc-aws-platform-agent からプロビジョニング済みインフラを、aidlc-pipeline-deploy-agent からデプロイ済みサービスを受け取ります。性能基準値と SLO 検証では aidlc-quality-agent と、アプリケーションレベルのログ改善では aidlc-developer-agent と連携します。そのフィードバックレポートは、運用フェーズからアイデア創出へ戻る橋渡しとなり、ライフサイクルループを完成させます。

<a id="key-principles"></a>
## 主要原則

- テレメトリは広く収集しつつ、ユーザー影響のある問題だけにアラートを出す。過剰なアラートは対応品質を下げる
- 信頼性目標は SLO が定義し、ほかの運用判断はそこから導く
- すべてのインシデントは学習機会であり、個人を責めない事後検証で改善へ変換する
- テストしていないレジリエンス機構は仮説にすぎず、カオスエンジニアリングで検証する
- 本番の知見がアイデア創出へ戻らなければ、学習は無駄になる
- 手作業の運用負荷は排除し、繰り返せる運用手順はすべて自動化する
