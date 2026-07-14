---
title: aidlc-quality-agent — 技術リファレンス
description: aidlc-quality-agent の識別情報、ステージ担当、連携パターン、ナレッジソースを定義します。
sidebarOrder: 9
sourcePath: docs/reference/agents/quality-agent.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 5a36c118b26e23b69c70db4144257aa3239d69bccff476cf1cc3057a4ee13aae
translationStatus: current
---

<a id="aidlc-quality-agent----technical-reference"></a>
# aidlc-quality-agent -- 技術リファレンス

<a id="identity"></a>
## 識別情報

| 項目 | 値 |
|------|----|
| 名前 | aidlc-quality-agent |
| ティア | **judgment** |
| 使用可能な Claude Code ツール | Read, Edit, Write, Glob, Grep, Bash, AskUserQuestion |
| 使用不可の Claude Code ツール | Task |

---

<a id="stage-ownership"></a>
## 担当ステージ

<a id="lead-stages"></a>
### 主担当ステージ

| ステージ | 名称 | このエージェントの役割 |
|----------|------|--------------------------|
| build-and-test | ビルドとテスト | テスト戦略を定義し、テストスイートを生成し、受け入れ基準に照らしてカバレッジを検証し、品質ゲートを適用する |
| performance-validation | パフォーマンス検証と負荷テスト | 負荷テストを設計および実行し、NFR 目標を検証し、ボトルネックを特定し、キャパシティプランニングの推奨事項を作成する |

<a id="support-stages"></a>
### 支援ステージ

| ステージ | 名称 | このエージェントの貢献内容 |
|----------|------|------------------------------|
| practices-discovery | プラクティス発見 | テストの進め方（TDD か事後テストか）、カバレッジ下限、CI のブロックまたは警告の挙動を調査し、チームのテスト実務を明らかにする |
| nfr-requirements | NFR 要件 | テスト可能な品質特性シナリオと、測定可能な NFR 目標を定義する |

---

<a id="collaboration-patterns"></a>
## 連携パターン

<a id="receives-from"></a>
### 受け取り元

| 提供元 | 成果物 |
|--------|--------|
| aidlc-product-agent | テストケース導出のための受け入れ基準付きユーザーストーリー |
| aidlc-architect-agent | NFR 目標、設計のテスト容易性評価、テスト境界 |
| aidlc-developer-agent | テスト対象の実装済みコード |

<a id="hands-off-to"></a>
### 引き継ぎ先

| 引き継ぎ先 | 成果物 |
|------------|--------|
| aidlc-pipeline-deploy-agent | CI/CD へのテストスイート統合、品質ゲート定義 |
| aidlc-operations-agent | 本番監視のためのパフォーマンスベースライン |

---

<a id="knowledge-sources"></a>
## ナレッジソース

<a id="methodology-tier-1"></a>
### 方法論（ティア 1）

パス: `.claude/knowledge/aidlc-quality-agent/`

| ファイル | 内容 |
|----------|------|
| nfr-reliability-guide.md | 信頼性テストの方法論とレジリエンス検証 |
| nfr-validation-methods.md | NFR 検証手法（負荷テスト、パフォーマンスプロファイリング） |
| test-strategy-patterns.md | テストピラミッドのパターン、テストデータ戦略、品質ゲート設計 |
| testing-guide.md | テスト方法論とテストケース設計原則 |

<a id="team-tier-2"></a>
### チーム（ティア 2）

パス: `aidlc/knowledge/aidlc-quality-agent/`（スペースレベルのナレッジディレクトリ。ユーザー管理）

チームが内容を持つときに作成するスペースレベルのディレクトリです（エンジンは `aidlc/knowledge/` を空のまま提供します）。既存のテストフレームワーク、カバレッジ目標、パフォーマンス
ベースライン、品質ゲートしきい値など、プロジェクト固有の QA コンテキストをチームが格納します。

---

<a id="cross-references"></a>
## 関連参照

- [エージェントリファレンス概要](README.md)
- [エージェントガイド: aidlc-quality-agent](../../guide/agents/quality-agent.md)
- [ステージドキュメント](../04-stages/)
- ソース: [`dist/claude/.claude/agents/aidlc-quality-agent.md`](../../../dist/claude/.claude/agents/aidlc-quality-agent.md)
