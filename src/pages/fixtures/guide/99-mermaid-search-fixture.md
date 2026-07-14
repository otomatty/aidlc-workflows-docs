---
layout: ../../../layouts/FixtureLayout.astro
title: Mermaid と検索の検証
description: Mermaid 描画と Pagefind 検索の動作確認に使う検証ページです。
---

# Mermaid と検索の検証

このページは Mermaid 描画と検索機能の回帰確認に使います。銀河横断検索確認語という固有語を含め、検索結果が正しいページへ戻ることを確認します。

[ドキュメント一覧](/aidlc-workflows-docs/docs/)へ戻るための内部リンクです。

```bash
bun run build
```

| 実行条件 | 表示結果 |
|---|---|
| JavaScript 無効 | 読み取り可能 |

## 正常な Mermaid

```mermaid
flowchart TD
    start[開始] --> review[レビュー]
    review --> release[公開]
```

## 失敗する Mermaid

```mermaid
flowchart TD
    broken[開始] -->
```
