---
name: sync-confluence
description: Use when the English docs (docs/) have changed and the Japanese Confluence space needs updating, or when publishing the Confluence mirror for the first time — the user says /sync-confluence, Confluence に反映して, or Confluence 同期.
---

# sync-confluence — 原文更新の日本語 Confluence スペースへの反映

`docs/`（英語原文）の変更を、日本語ミラー `confluence-docs/` に翻訳反映してから Confluence Cloud へ push する。**ミラーが正、Confluence は出力先**。Confluence 上の本文を直接読み取って編集しない（書式が劣化するため）。訳語・文体は必ず同ディレクトリの [terminology.md](terminology.md) に従う（作業前に読むこと）。

## 前提

- このスキルは aidlc-workflows リポジトリのルートで動く。台帳は `data/confluence-manifest.json`、ヘルパーは `bun scripts/confluence-sync.ts`
- Atlassian MCP（Confluence Cloud）が接続済みであること。ページの取得・作成・更新ツール（`getConfluencePage` / `createConfluencePage` / `updateConfluencePage` 相当。正確な名前は接続済みツール一覧で確認）を使う
- 台帳の `pageId` / `confluenceVersion` が Confluence 側の状態、`sourceCommit` が「そのミラーがどの原文コミットに対応するか」を表す

## 通常同期の手順

1. **検知**
   ```
   bun scripts/confluence-sync.ts --detect --format json
   ```
   全エントリ `current` なら「更新なし」と報告して終了。`error`（sourceCommit 不在）があれば fetch 不足を疑い、解決してから続行。

2. **changed — 更新モードの判定（ファイルごと）**
   detect の `changeRatio` を使う。**0.5 未満 → 差分パッチモード**、**0.5 以上 → 全文再翻訳モード**。

3. **翻訳の実行（ミラーファイルに対して）**
   - **差分パッチモード**: `git diff <sourceCommit> HEAD -- <sourcePath>`（`<sourceCommit>` は台帳の値）の各 hunk に対応するミラーの箇所だけを更新する。hunk に対応しない箇所は 1 文字も変えない（言い回しの「ついで改善」禁止 — git diff が汚れ、レビュー不能になる）
   - **全文再翻訳モード**: 新しい原文全文と旧ミラー全文を並べ、原文が変わっていない文は旧訳の文言をそのまま再利用して全文を作り直す
   - **added**: 全文新規翻訳。ミラーの配置は原文パスのミラー（`docs/guide/foo.md` → `confluence-docs/guide/foo.md`）。frontmatter は `title:`（日本語、スペース内で一意）と任意の `description:` のみ。リンクはサイトルート形式（`/guide/foo`）のまま書く — push 時に emit が Confluence URL へ変換する
   - 原文タイトルの意味が変わった場合はミラーの `title:` も更新する（push 時のページ改名に使う）
   - 対象が 4 ファイル以上なら翻訳作業（ミラー編集まで）を並列サブエージェントに分配する（各プロンプトに terminology.md の内容とモード別指示を含める）。3 ファイル以下は自分で行う。**MCP への push は必ず自分（親）が順に行う**

4. **deleted**: Confluence ページの削除（またはアーカイブ）を**ユーザーに確認してから**行う。削除前に他ミラーからのリンク（該当 route）を grep で検出して報告する。確認後: MCP でページを処理 → `bun scripts/confluence-sync.ts --remove <sourcePath>`

5. **push（変更したページごと）**
   1. MCP でページを取得し、`version.number` を台帳の `confluenceVersion` と照合する。**ズレていたら Confluence 側で直接編集されている** — 差分内容をユーザーに報告し、上書きしてよいか確認してから進む
   2. `bun scripts/confluence-sync.ts --emit <sourcePath>` で push 用本文（リンク変換済み Markdown）を得る
   3. MCP で update（title はミラーの frontmatter の値）。新規ページは親（台帳 `parents` の該当 `pageId`、直下なら `rootPageId`）の下に create
   4. 返ってきた pageId / 新バージョン番号を記録:
      ```
      bun scripts/confluence-sync.ts --set-page <sourcePath> --page-id <id> --version <n>
      ```
   5. emit が「未解決リンク」を警告した場合（新規ページ同士の相互リンク等）、対象ページの作成が済んだあとで再 emit → 再 update して解消する

6. **記録（bless）**: すべての push が成功したら
   ```
   bun scripts/confluence-sync.ts --record <sourcePath...>
   ```
   docs ツリーが clean であることが前提。翻訳せずに `--record` だけ実行してはならない（翻訳 → push → record の順を守る）。

7. **報告して終了**: ファイルごとの分類・使用モード・push 結果（pageId / バージョン）・要レビュー箇所（訳語の判断が割れた箇所、バージョン照合で警告が出たページ、原文側の矛盾ややむを得ずテキスト化したリンク）をまとめる。

## 初回（ブートストラップ）の手順

台帳 `data/confluence-manifest.json` が存在しない場合のみ。

1. **ミラー生成**: 翻訳サイト repo（既定 `c:\Users\saedg\aidlc-workflows-docs`。ユーザー指定があればそちら）の既存日本語訳から生成する:
   ```
   bun scripts/confluence-sync.ts --bootstrap --site <翻訳サイト repo>
   ```
   出力された警告（タイトル重複の解消、仮タイトルのセクション）をユーザーに見せる。
2. **接続情報**: ユーザーに ①Confluence の baseUrl（`https://<site>.atlassian.net/wiki`）②スペースキー ③配下にページツリーを作る親ページ ID（スペースホームでも可）を確認し、台帳の `baseUrl` / `spaceKey` / `rootPageId` に記入する。
3. **親ページ作成**: 台帳 `parents` を `dir` の浅い順に処理。各 `dir` について空ページ（本文はセクション説明 1 行で可）を `parentDir` の pageId（null なら `rootPageId`）の下に create → `--set-parent <dir> --page-id <id>`
4. **1 次パス（全ページ create）**: 台帳 `records` を `sourcePath` 順に処理（番号接頭辞順 = サイトの表示順になる）。`--emit` → 親の下に create → `--set-page`。この時点では内部リンクの多くが未解決でテキスト化される（正常）。
5. **2 次パス（リンク解決）**: 全ページの pageId が揃ったら、内部リンクを含む全ページを再 emit → update → `--set-page --version <新値>`。
6. 台帳の変更内容と Confluence 側のツリーをユーザーに報告する。

## コミットしない

**このスキルは git commit を実行しない。** ミラーと台帳の変更を working tree に置いたまま報告し、ユーザーが diff を確認してからコミットを指示する。ユーザーがこのターンで明示的に「コミットまでやって」と言った場合のみ例外。

## Confluence 固有の注意

- **mermaid はコードブロックのまま**置く（標準の Confluence では図として描画されない）。ブートストラップ時に図の直後へ `*（図の説明: …）*` が入っているので、それが代替になる。ユーザーが Mermaid 用アプリを導入している場合の変換は、指示があったときだけ行う
- **ページタイトルはスペース内で一意**。新規翻訳の title が既存と衝突したら「タイトル（セクション名）」形式で回避し、報告する
- **ページ内アンカーへのリンク**（`#fragment`）は Confluence へは持ち越せない。emit がページリンクに落とす（フラグメント破棄）か、同一ページ内リンクはテキスト化する — 警告が出たら報告に含める

## よくある間違い

| 間違い | 正 |
|--------|----|
| Confluence 上の本文を取得して直接編集する | 編集は常にミラー（`confluence-docs/`）に対して行い、emit の出力で丸ごと update |
| 差分パッチモードで無関係な段落の言い回しも直す | hunk 対応箇所以外は 1 文字も変えない |
| バージョン照合をせずに update する | 照合 → ズレていたらユーザー確認。独立運用の安全装置を飛ばさない |
| `--set-page` / `--record` を忘れる | 忘れると次回、二重作成や再 changed 扱いになる。push 直後に set-page、全完了後に record |
| terminology.md を読まずに翻訳する | 訳語がばらつく。作業前に必読 |
| ミラーに Confluence URL のリンクを直書きする | ミラーはサイトルート形式（`/guide/foo`）を維持。変換は emit の仕事 |
| 検証が通ったので commit する | commit しない（上記） |
| テーブルの区切りを `\|` と書く | 区切りは `|`。`\|` はセル内でパイプ文字を表示する時だけ |
