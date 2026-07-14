# 翻訳規約 — aidlc-workflows-docs

この訳語・規則はサイト全体で確立済み。逸脱すると既訳と衝突する。文体の見本は
`docs/reference/03-orchestrator.mdx` と `docs/harness-engineering/06-sensors.mdx`。

## 対訳表(日本語/カタカナに統一)

| 原語 | 訳語 |
|------|------|
| scope / stage / phase | スコープ / ステージ / フェーズ |
| gate / approval gate | ゲート / 承認ゲート |
| sensor / rule / hook / skill | センサー / ルール / フック / スキル |
| agent / subagent | エージェント / サブエージェント |
| orchestrator / engine / conductor | オーケストレーター / エンジン / コンダクター |
| workflow / harness | ワークフロー / ハーネス |
| intent / space / workspace | インテント / スペース / ワークスペース |
| knowledge / artifact | ナレッジ / 成果物 |
| depth / test strategy | 深度 / テスト戦略 |
| lifecycle / swarm / shard | ライフサイクル / スウォーム / シャード |
| audit / audit trail | 監査 / 監査証跡 |
| record directory | 記録ディレクトリ |
| domain-expert / persona | ドメイン専門家 / ペルソナ |
| review-only | レビュー専任 |
| tier | ティア |
| directive | ディレクティブ |

## フェーズ名の正式訳

| フェーズ | 訳 |
|----------|-----|
| Initialization | 初期化 |
| Ideation | アイデア創出 |
| Inception | インセプション |
| Construction | フェーズ名としては「コンストラクション」(既存文中の「構築フェーズ」も許容。一般動詞の「構築する」はそのまま) |
| Operation | 運用 |

## 英語のまま残すもの

- コマンド・フラグ(`/aidlc`, `--status`, `--record` …)、ファイルパス、コード識別子、JSON/YAML フィールド名、環境変数名
- イベント名(`SENSOR_FIRED`, `HUMAN_TURN` …)
- スコープ値: enterprise / feature / mvp / poc / bugfix / refactor / infra / security-patch / workshop
- 深度・テスト戦略値: Minimal / Standard / Comprehensive、ティア値: judgment / balanced / templated
- 製品名・モデル ID: Claude Code, Kiro CLI/IDE, Codex CLI, AWS Bedrock, bun, AI-DLC, `claude-sonnet-4.5` 等(モデル ID をカタカナにしない)
- エージェント正式 ID(`aidlc-architect-agent` …)、ステージスラッグ(`code-generation` …)、ステージの英語正式名(括弧で日本語を添えるのは可)
- URL、バッククォート内のコード全般
- 対話モード名: Guide Me / Edit File / Chat

## 構造規則

- `<a id="...">` の id 値、リンクの URL 部分、コードブロックの中身、frontmatter のキーは変更しない(frontmatter の title/description の**値**は日本語)
- mermaid のノード表示ラベルと `{/* Text fallback: ... */}` の説明文は日本語化してよい。mermaid の構文・スタイル定義は不変
- テーブルのセル区切りは `|`。`\|` はセル内で意図的にパイプ文字を表示する場合のみ(例: `` `Write\|Edit` ``)
- 数値・件数・パーセンテージは原文どおり(勝手に再計算しない。原文側の矛盾に気付いたら翻訳はそのままにして報告)
- 半角英数と日本語の間のスペース、括弧は既訳の慣行(全角括弧)に合わせる
