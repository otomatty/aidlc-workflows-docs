---
title: はじめに
description: AI-DLC の基本概念、オーケストレーターの仕組み、ユーザーガイド全体の見取り図を説明します。
sidebarOrder: 0
sourcePath: docs/guide/00-introduction.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 64102ba82f3fcd0b40d6d449dc8c293d9b928d7b2a0f9dd601fa0082c13610a9
translationStatus: current
---

<a id="introduction"></a>
# はじめに

> [AI-DLC ドキュメント](../README.md) の一部 · **ユーザーガイド** · [ハーネスエンジニアガイド](../harness-engineering/00-overview.md) · [開発者リファレンス](../reference/00-overview.md)

<a id="what-is-ai-dlc"></a>
## AI-DLC とは何ですか？

AI-DLC（AI-Driven Development Life Cycle）は、AI 支援ソフトウェア開発を反復可能で追跡可能なフェーズへ構造化するための方法論です。これは [AWS AI-DLC methodology](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/) を起源としています。このリポジトリは、それをハーネス中立な単一の core からネイティブに実装しているため、すでに使っている CLI harness の中で動作します。現在は Claude Code、Kiro CLI、Kiro IDE、Codex CLI に対応しています。このガイド自体は harness 中立です。ハーネスごとに異なる点がある場合は、その旨を明記し、対応する章へ案内します（[他のハーネスでの実行](harnesses/README.md) を参照）。特記がない限り、例は Claude Code で示します。

呼び出しは 1 つのコマンドで行います。

```
/aidlc Build a REST API for inventory management
```

すると AI-DLC は、意図の取り込みから要件、設計、実装、テスト、デプロイまでの構造化されたワークフローを案内しながら、あらゆる意思決定ポイントであなたが主導権を持てるようにします。

<a id="philosophy-small-mob-broad-agents"></a>
## 哲学: 少人数のモブ、幅広い能力を持つエージェント (Small Mob, Broad Agents)

数多くの細分化された専門家に分けるのではなく（これはウォーターフォールの引き継ぎ連鎖を再現してしまいます）、AI-DLC は **11 人の広く対応可能なエージェント** を使い、それぞれが複数のステージとフェーズにまたがって参加します。各エージェントはステージをまたいでコンテキストを保持するため、引き継ぎをなくし、調整コストを減らします。

これは、効果的な人間チームの働き方を模しています。3〜5 人の mob が機能全体をカバーし、それぞれが 1 つの狭い専門領域ではなく広いスキルを持ち寄る、という考え方です。

<a id="how-the-orchestrator-works"></a>
## オーケストレーターはどう動くのか

AI-DLC の中核では、単純なループが動いています。決定論的な **engine** が次に何をするかを決め、**conductor**（`/aidlc` セッション、`SKILL.md`）がそれを実行し、次の動きを再び engine に問い合わせます。このループ全体を通して、フレームワークは次を行います。

1. **ステージファイルを読む**。5 フェーズにまたがる 32 のステージ定義があり、それぞれに inputs、steps、outputs、lead agent が定義されています
2. **エージェントペルソナを読み込む**。domain-expert の視点（architect、developer、product manager など）と専用 knowledge を有効化します
3. **状態と監査を管理する**。`aidlc-state.md` で進行状況を追跡し、すべての意思決定を intent の `audit/` shards に記録して追跡可能にします
4. **サブエージェントへ委譲する**。集中的で自律的な作業が必要なステージ（reverse engineering、code generation）では subprocess を起動します
5. **承認ゲートを提示する**。各ステージの後に、あなたがレビューして承認してからワークフローが進みます

engine はルーティング（次のステージは何か、どの scope か、いつ止まるか）を担い、conductor は実行品質（ステージを適切に進めること、良い質問をすること、意思決定をあなたに見える形にすること）を担います。ほとんどのステージは **inline** で実行されます。つまり conductor が agent の視点を採用し、会話の中で直接あなたと作業します。**subagent** として動くのは 2 つのステージです。作業はバックグラウンド subprocess に委譲され、完了したら結果が提示されます。全体アーキテクチャについては、開発者リファレンスの [Engine and Skill System](../reference/17-skill-system.md) を参照してください。

<a id="who-this-guide-is-for"></a>
## このガイドの対象者

このガイドは、AI-DLC を **使って** ソフトウェアを構築する人のためのものです。

- **初めて使う方**: [はじめに](01-getting-started.md)、[最初のワークフロー](02-your-first-workflow.md)、[スペースとインテント](03-spaces-and-intents.md) から始めてください
- **普段使っている方**: [CLI コマンド](12-cli-commands.md)、[スコープ、深度、テスト戦略](05-scopes-and-depth.md)、[トラブルシューティング](15-troubleshooting.md) を参照してください
- **チームリード**: AI-DLC をチーム基準に合わせるには [ナレッジ](08-knowledge.md) と [ルールと学習ループ](09-rules-and-the-learning-loop.md) を参照してください

AI-DLC の振る舞いを *どのように変えるか*、つまりステージやエージェントを追加し、scope を定義し、rules や sensors を著述し、team knowledge を追加したい場合は（すべて設定でありコード変更は不要です）、[ハーネスエンジニアガイド](../harness-engineering/00-overview.md) を参照してください。AI-DLC のコードベース自体を変更する場合は、[開発者リファレンス](../reference/00-overview.md) を参照してください。

<a id="key-numbers"></a>
## 主要な数字

| 指標 | 値 |
|--------|-------|
| フェーズ | 5（Initialization、Ideation、Inception、Construction、Operation） |
| ステージ | 32 |
| エージェント | 11 の domain-expert personas |
| スコープ | 9（enterprise から workshop まで）+ auto-detect |
| 深度レベル | 3（Minimal、Standard、Comprehensive） |
| テスト戦略レベル | 3（Minimal、Standard、Comprehensive） |
| 監査イベント種別 | 68 |

<a id="guide-map"></a>
## ガイドマップ

| 章 | 学べること |
|---------|------------------|
| [はじめに](01-getting-started.md) | 前提条件、インストール、最初のヘルスチェック |
| [最初のワークフロー](02-your-first-workflow.md) | 完全な実行例を注釈付きで追うウォークスルー |
| [スペースとインテント](03-spaces-and-intents.md) | ワークスペースレイアウト。spaces と intents をまたいで複数の作業をどう進めるか |
| [フェーズとステージ](04-phases-and-stages.md) | 5 つのフェーズと 32 のステージの説明 |
| [スコープ、深度、テスト戦略](05-scopes-and-depth.md) | scope、depth、test strategy の選び方と上書き方法 |
| [エージェント](06-agents.md) | 11 エージェントの役割と参加タイミング |
| [エージェント詳細](agents/README.md) | 各エージェントの参照ページ。責務、ステージ、knowledge を掲載 |
| [対話モード](07-interaction-modes.md) | Guide Me / Edit File / Chat と承認ゲート |
| [ナレッジ](08-knowledge.md) | 会社標準や慣習の追加 |
| [ルールと学習ループ](09-rules-and-the-learning-loop.md) | 自己学習する行動ルール |
| [状態と監査](10-state-and-audit.md) | 進行状況と意思決定の追跡方法 |
| [セッション管理](11-session-management.md) | resume、redo、jump、recovery、session reporting skills |
| [CLI コマンド](12-cli-commands.md) | フラグ完全リファレンスと例 |
| [カスタマイズ](13-customization.md) | 設定、scope config、agent tuning |
| [成果物リファレンス](14-artifacts-reference.md) | intent ごとの record dir（`aidlc/spaces/<space>/intents/<YYMMDD>-<label>/`）の説明 |
| [トラブルシューティング](15-troubleshooting.md) | 症状別の問題解決 |
| [実例](16-worked-examples.md) | bugfix と feature の完全な実例ウォークスルー |
| [スキルとランナーコマンド](17-skills.md) | `/aidlc-*` の stage/scope runner commands と、自作 runner を著述する道筋 |
| [ワークショップモード](workshop-mode.md) | workshop scope 用の複数開発者向け手動レシピ（git push による claim semantics） |
| [他のハーネスでの実行](harnesses/README.md) | Kiro IDE や Codex CLI でのインストールと実行方法、およびハーネスごとの差異 |
| [用語集](glossary.md) | すべての用語の定義 |
