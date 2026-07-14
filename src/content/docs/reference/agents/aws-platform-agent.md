---
title: aidlc-aws-platform-agent — 技術リファレンス
description: aidlc-aws-platform-agent の識別情報、ステージ担当、連携パターン、ナレッジソースを定義します。
sidebarOrder: 5
sourcePath: docs/reference/agents/aws-platform-agent.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: d8a025c69460fd342f402a4746e4583ddd1cbb01ff35d660fc18e682162814fc
translationStatus: current
---

<a id="aidlc-aws-platform-agent----technical-reference"></a>
# aidlc-aws-platform-agent -- 技術リファレンス

<a id="identity"></a>
## 識別情報

| 項目 | 値 |
|------|----|
| 名前 | aidlc-aws-platform-agent |
| 階層 | **judgment** |
| 許可される Claude Code ツール | Read, Edit, Write, Glob, Grep, Bash, AskUserQuestion |
| 許可されない Claude Code ツール | Task |

---

<a id="stage-ownership"></a>
## 担当ステージ

<a id="lead-stages"></a>
### 主担当ステージ

| ステージ | 名称 | このエージェントの役割 |
|----------|------|------------------------|
| infrastructure-design | インフラストラクチャ設計 | アプリケーションアーキテクチャを、AWS サービスの選定、CDK/CloudFormation テンプレート、VPC 設計、IAM ポリシー、コスト見積もりへと落とし込みます |
| environment-provisioning | 環境プロビジョニング | ドリフト検出と環境同等性を備えた IaC 定義から、dev/staging/production 環境をプロビジョニングします |

<a id="support-stages"></a>
### 支援ステージ

| ステージ | 名称 | このエージェントの貢献内容 |
|----------|------|------------------------------|
| feasibility | 実現可能性と制約分析 | AWS サービスの提供状況、リージョン制約、クラウドプラットフォームの制限を評価します |
| application-design | アプリケーション設計 | クラウドネイティブパターン、マネージドサービス統合、サーバーレスの選択肢について助言します |
| nfr-design | NFR 設計 | NFR をインフラ仕様、自動スケーリングポリシー、レジリエンス構成へと変換します |
| feedback-optimization | フィードバックと最適化 | 本番メトリクスに基づいて、コスト最適化の機会とインフラのチューニング項目を特定します |

---

<a id="collaboration-patterns"></a>
## 連携パターン

<a id="receives-from"></a>
### 受け取る相手

| ソース | 成果物 |
|--------|--------|
| aidlc-architect-agent | アプリケーショントポロジー、コンポーネント一覧、インフラ要件 |
| aidlc-devsecops-agent | セキュリティ要件、コンプライアンス統制、暗号化仕様 |

<a id="hands-off-to"></a>
### 引き渡す相手

| ターゲット | 成果物 |
|----------|--------|
| aidlc-pipeline-deploy-agent | デプロイ先向けの環境エンドポイント、インフラ出力 |
| aidlc-operations-agent | オブザーバビリティ設定と監視のためにプロビジョニング済みのインフラ |

---

<a id="knowledge-sources"></a>
## ナレッジソース

<a id="methodology-tier-1"></a>
### 手法論（第1層）

パス: `.claude/knowledge/aidlc-aws-platform-agent/`

| ファイル | 内容 |
|----------|------|
| cdk-best-practices.md | AWS CDK のコンストラクトパターン、スタック構成、テスト |
| cost-optimization-patterns.md | FinOps パターン、ライトサイジング、リザーブドインスタンス、Savings Plans |
| infrastructure-guide.md | インフラ設計手法と環境プロビジョニング |
| well-architected-framework.md | AWS Well-Architected Framework の 6 つの柱のリファレンス |

<a id="team-tier-2"></a>
### チーム（第2層）

パス: `aidlc/knowledge/aidlc-aws-platform-agent/`（スペースレベルのナレッジディレクトリ。ユーザー管理）

チームが内容を持つときに作成するスペースレベルのディレクトリです（エンジンは `aidlc/knowledge/` を空で提供します）。既存の VPC 設計、AWS アカウント構成、
承認済みサービスカタログ、コストベースラインなど、プロジェクト固有の
インフラ文脈をチームがここに格納します。

---

<a id="cross-references"></a>
## 相互参照

- [エージェントリファレンス概要](README.md)
- [エージェントガイド: aidlc-aws-platform-agent](../../guide/agents/aws-platform-agent.md)
- [ステージドキュメント](../04-stages/)
- 出典: [`dist/claude/.claude/agents/aidlc-aws-platform-agent.md`](../../../dist/claude/.claude/agents/aidlc-aws-platform-agent.md)
