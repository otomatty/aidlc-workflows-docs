---
title: DevSecOps エージェント
description: aidlc-devsecops-agent の支援責務、セキュリティ役割、連携方法、判断原則を説明します。
sidebarOrder: 7
sourcePath: docs/guide/agents/devsecops-agent.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 7a74c92539f05f2d01491a576c222b27b70bf9acd6857ff9e00ddfa6b7d101ff
translationStatus: current
---

<a id="devsecops-agent"></a>
# DevSecOps エージェント

> **エージェント詳細** · [ユーザーガイド](../00-introduction.md) › [エージェント](../06-agents.md) › [詳細一覧](README.md) · 技術リファレンス: [devsecops-agent](../../reference/agents/devsecops-agent.md)

aidlc-devsecops-agent は、あなたのセキュリティエンジニアです。セキュリティをライフサイクルの最後に付け足すのではなく、すべてのフェーズへ組み込みます。アイデア創出で特定されたコンプライアンス要件を、セキュリティ統制、脅威モデル、スキャンパイプライン、実行時監視として実装します。対象はアプリケーションセキュリティ、クラウドセキュリティ、パイプラインセキュリティです。

aidlc-compliance-agent と同様に、aidlc-devsecops-agent も支援役に専念します。構想、構築、運用にまたがる 5 つのステージでセキュリティの専門知識を提供します。セキュリティスキャンツールを実行するために Bash を利用できます。

<a id="stages-led"></a>
## 主導ステージ

aidlc-devsecops-agent が主導するステージはありません。

<a id="stages-supported"></a>
## 支援ステージ

| ステージ | フェーズ | 貢献内容 |
|-------|-------|-------------|
| 2.2 Practices Discovery | 構想 | 確認対象となるセキュリティ実践とスキャン慣行を抽出 |
| 3.2 NFR Requirements | 構築 | セキュリティ統制、脅威モデル、STRIDE 分析 |
| 3.4 Infrastructure Design | 構築 | IAM ポリシーレビュー、セキュリティグループ検証 |
| 3.6 Build and Test | 構築 | SAST/DAST スキャン、依存関係の脆弱性、IaC の静的検査 |
| 4.2 Environment Provisioning | 運用 | セキュリティ態勢の検証（Security Hub、Inspector、GuardDuty） |

<a id="what-to-expect"></a>
## 期待できること

aidlc-devsecops-agent が有効なときは（支援エージェントとして）、攻撃面、信頼境界、セキュリティ統制に注目します。設計にセキュリティ上のアンチパターンがないかをレビューし、機微なデータフローが暗号化されアクセス制御されているかを検証し、サードパーティ依存関係に既知の脆弱性がないかを評価します。

<a id="how-it-collaborates"></a>
## 連携方法

aidlc-devsecops-agent は、aidlc-compliance-agent から規制要件を、aidlc-architect-agent からシステム設計を受け取ります。安全なコーディング実践では aidlc-developer-agent と、インフラの堅牢化では aidlc-aws-platform-agent と、セキュリティテスト要件では aidlc-quality-agent と連携します。そのセキュリティゲートとスキャン設定は aidlc-pipeline-deploy-agent へ引き渡されます。

<a id="key-principles"></a>
## 主要原則

- 多層防御を徹底し、単一のセキュリティ統制を単一障害点にしない
- 最小権限を徹底し、すべての利用者、サービス、プロセスに必要最小限の権限だけを与える
- 侵害を前提に設計し、内部コンポーネント同士でも認証と認可を行う
- 既定設定は安全でなければならない
- すべての入力は検証されるまで悪意あるものとみなし、外部データはサニタイズされるまで汚染済みとみなす
- セキュリティは要件であり、後回しにできる機能ではない
