---
name: sync-docs
description: Use when the upstream English docs (aidlc-workflows/docs) have changed and the Japanese translation site needs updating — the user says 原文が更新された / 翻訳を同期して / /sync-docs, or sync-upstream reports added, changed, deleted, or untranslated files.
---

# sync-docs — 原文更新の翻訳サイトへの反映

原文の変更だけを訳文に反映し、既存の日本語訳は最大限保全する。訳語・文体は必ず同ディレクトリの [terminology.md](terminology.md) に従う(作業前に読むこと)。

## 手順

1. **検知**
   ```
   bun scripts/sync-upstream.ts --upstream <原文リポジトリ> --format json
   ```
   原文リポジトリの既定は `c:\Users\saedg\aidlc-workflows`(ユーザー指定があればそちら)。全ファイル `current` なら「更新なし」と報告して終了。

2. **changed — 更新モードの判定(ファイルごと)**
   手順 1 のレポートで `changed` エントリには `diffStat`(変更規模)が自動で付く。`diffStat.recommendedMode` が **`patch` → 差分パッチモード**、**`retranslate` → 全文再翻訳モード**(判定基準: churn 率 = (追加行+削除行) ÷ 原文総行数 が 50% 未満なら patch)。
   `diffStat` が付かない場合(上流が git リポジトリでない、`sourceCommit` が clone に無い等)のみ手動で測る:
   ```
   git -C <原文リポジトリ> diff <sourceCommit> HEAD --numstat -- <sourcePath>
   ```

3. **翻訳の実行**
   - **差分パッチモード**: `git -C <原文リポジトリ> diff <sourceCommit> HEAD -- <sourcePath>` の各 hunk に対応する訳文箇所だけを更新する。hunk に対応しない箇所は 1 文字も変えない(言い回しの「ついで改善」禁止 — git diff が汚れ、レビュー不能になる)。
   - **全文再翻訳モード**: 新しい原文全文と旧訳全文を並べ、原文が変わっていない文は旧訳の文言をそのまま再利用して全文を作り直す。
   - **added / untranslated**: 全文新規翻訳。配置は原文パスのミラー(`docs/guide/foo.md` → `docs/guide/foo.mdx`)。frontmatter(title/description は日本語)、`<a id>` アンカー、リンク形式(サイト内ルート)は同じディレクトリの既訳ファイルに倣う。
   - 対象が 4 ファイル以上なら並列サブエージェントに分配する(各プロンプトに terminology.md の内容とモード別指示を含める)。3 ファイル以下は自分で行う。

4. **deleted**: 対応する訳文の削除を**ユーザーに確認してから**行う。削除前に他ページからのリンクを grep で検出して報告する。

5. **検証**: `bun run validate:content` → `bun run build`。失敗したら該当ファイルを修正してから進む。

6. **マニフェスト更新(bless)**: 検証が通ったら
   ```
   bun scripts/sync-upstream.ts --upstream <原文リポジトリ> --record <translationPath...>
   ```
   原文リポジトリの docs ツリーが clean であることが前提。翻訳せずに `--record` だけ実行するとスクリプトが拒否する(正しいガード。翻訳→検証→record の順を守る)。

7. **報告して終了**: ファイルごとの分類・使用モード・要レビュー箇所(訳語の判断が割れた箇所、原文側の矛盾に気付いた場合はそれも)をまとめる。

## コミットしない

**このスキルは git commit を実行しない。** 変更を working tree に置いたまま報告し、ユーザーが diff を確認してからコミットを指示する。「検証も通ったしコミットまで済ませた方が親切」は誤り — 翻訳の質はユーザーのレビューが最終ゲートであり、無断コミットはそれを飛ばす。ユーザーがこのターンで明示的に「コミットまでやって」と言った場合のみ例外。

## よくある間違い

| 間違い | 正 |
|--------|----|
| 差分パッチモードで無関係な段落の言い回しも直す | hunk 対応箇所以外は 1 文字も変えない |
| `--record` を忘れる | 次回の実行で同じファイルがまた changed 扱いになる。検証後は必ず record |
| terminology.md を読まずに翻訳する | 訳語がばらつく。作業前に必読 |
| 検証が通ったので commit する | commit しない(上記) |
| テーブルの区切りを `\|` と書く | 区切りは `|`。`\|` はセル内でパイプ文字を表示する時だけ |
