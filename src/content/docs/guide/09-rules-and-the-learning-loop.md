---
title: ルールと学習ループ
description: 永続ルールの 5 層構造、学習ループ、センサーによる補完的な検証を説明します。
sidebarOrder: 9
sourcePath: docs/guide/09-rules-and-the-learning-loop.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 9d83ad4a75b22f4f8842aefc2db7acae15e4f4edc4212c1da44156f0c791e361
translationStatus: current
---

<a id="rules-and-the-learning-loop"></a>
# ルールと学習ループ

ルールは、エージェントがあなたの project でどのように働くかを形作る、永続的な prose instructions です。learning loop は、そのルールが書かれる仕組みです。ワークフロー中にエージェントを修正し、その修正をステージの承認ゲートで確認すると、framework がそれを保存するので、同じ修正を二度行う必要がなくなります。

この章は user-facing な概説です。ルールがどこにあるか、5 つの layer がどう積み上がるか、learning loop がどのように correction を取り込むか、そして Sensors がルールに並ぶ決定論的な second opinion をどう提供するかを扱います。schema-level の仕組みについては、それぞれの段階で Developer Reference へ cross-link しています。

---

<a id="rules-at-a-glance"></a>
## ルールの概要

ルールは、space memory layer の Markdown ファイル、つまり `aidlc/spaces/<space>/memory/` にあります。これは workspace root にある手で編集可能な単一セットで、各ハーネスがその native include（Claude の `@`-import stub、Kiro resources glob、Codex `AIDLC_RULES_DIR`）を通じて読み込みます。各ファイルは、そのスコープに応じて名前が付いています。

```
aidlc/spaces/<space>/memory/
├── org.md                 # framework + organization-wide defaults
├── team.md                # your team's affirmed practices
├── project.md             # this project's specialization
└── phases/
    ├── ideation.md
    ├── inception.md
    ├── construction.md
    └── operation.md
```

ファイルの中に `scope:` field はありません。スコープは filename から決まります。`org.md` は framework defaults（trunk-based development、testing posture、walking-skeleton policy）を持ちます。`team.md` にはチームが affirm した practices が入ります。`project.md` にはこの 1 つの project に固有の内容が入ります。4 つの `phases/<phase>.md` ファイルは、そのフェーズのすべてのステージに適用されるルールを持ちます。たとえば inception フェーズルールでは、すべての architecture decision が少なくとも 2 つの alternatives を記録することを要求します。

各ファイルは topical headings（`## Way of Working`、`## Testing Posture`、`## Deployment`、`## Code Style` など）の下に置かれた plain prose です。あなたが読めて、手で編集できて、framework は learning loop を通じてそこへ書き込みます。

schema、filename-to-scope table、resolver mechanics は Developer Reference の [Rule System](../reference/08-rule-system.md) に記載されています。

---

<a id="the-five-layer-chain"></a>
## 5 層チェーン

ルールは、すべてのワークフローの開始時に 5 層 chain を通じて解決されます。

```
org → team → project → phase → stage
```

この model は **strict-additive** です。適用可能なすべてのルールがエージェントの context に現れます。runtime 中に何かが黙って落ちたり上書きされたりすることはありません。org defaults、team practices、project specialization が連結され、ステージがすでに自分のフェーズを宣言しているので、対応するフェーズルールがそのまま付加されます。（5 つ目の layer、per-stage ルールは将来の release 向けに予約されています。）

これは以前の version からの意図的な変更です。`overrides:` block も `enforcement:` keyword も、もはやありません。適用されるすべての layers が同時に存在し、conflict は runtime に届く前、つまりルールが書き込まれる時点で捕捉されます（後述の [admission-time conflict checks](#admission-time-conflict-checks) を参照）。

この chain はワークフロー start 時に、framework がステージ definitions、ルール、センサーを 1 つの graph に compile するときに **一度だけ** 解決されます。ワークフロー全体を通じてエージェントが読むのは解決済み view であり、実行中に chain をたどり直すことはありません。この compile boundary は planes model が説明しているものと同じです。章末の [Planes: 全体への当てはめ方](#planes-how-it-fits-together) を参照してください。

---

<a id="the-learning-loop"></a>
## 学習ループ

learning loop は、一度きりの correction を durable ルールに変える仕組みです。ほとんどのステージ run では何も追加されません。そしてそれは健全です。この loop が動くのは、ステージ中に何かが表面化し、それを保持する価値があるとあなたが判断したときだけです。

この loop には、ユーザーから見える 4 つの瞬間があります。ステージ実行中にエージェントが diary を付け、ゲートが candidates を提示し、あなたが残すものを確認し、framework が保持された items を次回用に書き込みます。

<a id="the-memorymd-diary"></a>
### `memory.md` の日誌

ステージ実行中、framework は `<record>/<phase>/<stage>/memory.md` に observation log を継続的に残します。これは intent の記録ディレクトリ、すなわち `aidlc/spaces/<space>/intents/<YYMMDD>-<label>/` の下です。ステージ開始時に自動作成され、手で編集してはいけません。entries は 4 つの標準見出しの下に入ります。

- **解釈（Interpretations）** — ステージ prose が曖昧だったためにエージェントが行った解釈
- **逸脱（Deviations）** — エージェントが意図的にステージ prose から外れた箇所と、その理由
- **トレードオフ（Tradeoffs）** — 検討した選択肢と、その選択理由
- **未解決の質問（Open questions）** — 次回実行前に確認すべきこと、またはまだ不確かな文脈

各 entry には timestamp が付きます。この loop の中で language model が担う仕事はこれだけです。ステージの間に observations を `memory.md` へ書くこと。ステージ完了後、つまり entries のカウント、それらの提示、適切なファイルへの routing、実際の書き込みは、すべて deterministic tooling かゲートにおけるあなたの明示的な選択によって行われます。

<a id="the-gate-ritual"></a>
### ゲートの儀式

各承認ゲートの前に、framework は learning ゲートを実行します（protocol では §13 ritual と呼ばれます）。2 つの source から candidates を集め、1 つの confirm-list として提示します。

1. **エージェントの日誌を、そのまま提示する。** deterministic tool が `memory.md` を読み、4 見出しの下にある空でない各行を、source heading を添えて candidate として出力します。言い換えも、「重要そうなもの」への filtering もありません。書かれた行がそのまま見えます。
2. **必ず "Anything to add for next time?" と尋ねる free-text channel。** あなたは observation を入力し、それが 4 見出しのどれに属するかを選びます。分類として求められるのは、その heading 選択だけです。

残したい candidates にチェックを付けます。もしそのステージの `memory.md` が空なら、framework は日誌が付けられたかどうかの証明をあなたに求めません。静かにその事実を記録して先へ進みます。

<a id="where-a-kept-learning-goes"></a>
### 保持された learning はどこへ行くか

あなたがファイル path を選ぶことはありません。destination は heading によって決まります。

- Interpretations、Deviations、Tradeoffs は practices として `aidlc/spaces/<space>/memory/project.md` に入ります（確認された learning は *practice そのもの* です）。topical headings の下に配置されます。
- Open questions は昇格しません。これらは research items であり、インストールすべきルールではないからです。

既定のスコープは **project** です。lesson が 1 つの project を超えて当てはまる場合には、「promote to team」のワンクリック affordance で、保持した learning を `memory/project.md` から `memory/team.md` へ広げられます。org まで広げる path はありません。org ルールは framework が出荷するか、organization 側で別 process により著述されるので、learning loop が org スコープへ書くことはありません。最も狭いスコープを既定にすることで、1 つの project の驚きが誤って organization-wide ルールにならないようにしています。

確認された learning は *practice そのもの* です。`aidlc/spaces/<space>/memory/project.md` や `memory/team.md` といった、practices-discovery が affirm するのと同じ space memory ファイルに入ります。別個の継続的な `*-learnings.md` surface はありません。これら 2 つの経路が異なるのは lifecycle だけです。practices-discovery はセクション全体を deterministic に affirm しますが、learning loop はゲートを通じて、日付付きで topic 見出しを持つ entry を 1 つずつ追記します。

保持された learning が **センサー binding** でありルールではない場合、つまりステージ出力に対して新しい deterministic check を走らせたい場合、framework は 2 つのファイル write を原子的に行います。センサー manifest を scaffold し、新しいセンサーの id をその originating ステージの import list に追記します。diary、ゲートでの confirmation、そこから生じるファイル write はそれぞれ audit row（`RULE_LEARNED` または `SENSOR_PROPOSED`）を残すため、どんなルールも黙って install されることはありません。

<a id="admission-time-conflict-checks"></a>
### 書き込み時の競合検査（admission-time conflict checks）

保持された learning が disk に書かれる前に、framework は `memory/org.md` に対して section-level check を行います。提案された entry が同じ heading 下の org ルールと矛盾していれば、ゲートは止まり、衝突する org の sentence をその場で引用します。あなたは、その entry を修正するか、スキップするか、org-rule owner に escalate するかを選びます。矛盾したルールがそのまま landing することはありません。そのため runtime resolver は単純なままでよく、conflict check を通過したルールだけを見れば済みます。

同じ section-level check は practices-discovery affirmation ゲートも守ります。そして org policy が **後から** 変わり、すでに disk にある team または project ルールと衝突した場合は、`/aidlc --doctor` がその drift を on demand で通知します。どのファイルの、どの section が、どの org sentence と衝突しているかを名指しするので、チームは対応できます。この doctor check は advisory であり、ブロックはしません。2 つの doctor advisory rows については [CLI コマンド](12-cli-commands.md) と [トラブルシューティング](15-troubleshooting.md) で説明しています。

<a id="applies-next-workflow-not-mid-run"></a>
### 今の実行中ではなく、次のワークフローに適用される

あるゲートで記録された learning は、現在のワークフローの残りのルールを **変更しません**。今回の run については、あなたはすでに会話の中でエージェントを修正しています。ルールは次回のためのものです。新しい行は disk にありますが、進行中のワークフローは開始時に compile した view を使い続けます。

次にワークフローを開始するとき、その compile が新しいファイルを読み、ステージ 1 からそのルールが適用されます。これは router が BGP から得る安定性と同じ性質です。routes は packet が飛んでいる途中で再計算されず、AI-DLC もワークフローの途中で再 compile しません。その見返りが予測可能性です。ワークフローの前半であなたが承認したゲートは、安定したルール set に対して行われたものであり、framework は進行中 run の足元を後から変えません。

---

<a id="worked-example-the-anz-banking-project"></a>
## 実例: ANZ の銀行プロジェクト

具体的な walkthrough で、loop が端から端までどう動くかを見てみましょう。

Sam が ANZ banking project で `/aidlc feature` を実行します。ワークフローは `requirements-analysis` に到達します。Sam は stakeholder note に「the transaction shouldn't duplicate on retry」と書きました。意味していたのは banking transaction、つまり処理対象の支払いです。ところが product エージェントは "transaction" を database transaction と読み取り、ACID semantics requirement と解釈しました。Sam がそれを修正し、エージェントは成果物を更新して先へ進みます。

framework はこれを予測していませんでした。ANZ 固有の用語についてのルールもなく、generic term と domain term の衝突を捉えるセンサーもありません。エージェントが単純に曖昧さにぶつかったのです。

**1. 日誌に記録される。** framework は `<record>/inception/requirements-analysis/memory.md` の `## Interpretations` の下に次の entry を追記します。

```
- 2026-05-21T09:14:32Z — Stakeholder note used "transaction"; interpreted as
  database-transaction. Sam corrected to mean banking-transaction (the payment
  being processed, not the DB write). Worth flagging for ANZ project context.
```

この時点ではルールはまだ install されていません。これは単なるエージェントの日誌です。

**2. ゲートがそれを提示する。** ステージが完了します。承認ゲートの前に、learning ゲートが `memory.md` を読み、この解釈の行を候補として表示します。さらに「次回のために追加することはありますか？」（"Anything to add for next time?"）と尋ねます。Sam は transaction 用語の候補にチェックを入れ（Interpretation → `memory/project.md` に入る）、さらに「エージェントが AWS account の用語を既定で使い続けたため、銀行の customer entity には常に『ANZ customer』というべき」という自由記述のメモを追加します。Sam はこの追加に Deviation heading を選びます。これも同じ `memory/project.md` ファイルへ送られます。

**3. conflict check が走る。** framework は両 entry を org practices（`memory/org.md`）と比較します。"ANZ transaction" も "ANZ customer" terminology も org ルールではカバーされていないので、どちらも通過します。deterministic tool が provenance 付きで両行を `memory/project.md` に書き込み、audit log にはそれぞれ `RULE_LEARNED` event が記録されます。

**4. 現在のワークフローはそのまま続く。** ステージが approve され、ワークフローは `user-stories` へ進みます。新しい lines は disk にありますが、このワークフローの compiled view には入りません。今回の run については、Sam がすでにステージ内でエージェントを修正済みだからです。

**5. 次のワークフローで拾われる。** その日の後で Sam が `/aidlc bugfix` を実行します。ワークフロー start 時の compile が space memory layer をたどり、`memory/project.md` を拾って、すべてのステージの context に含めます。bugfix ワークフローのステージ 1 からエージェントは "transaction" が payment を意味し、customer entity が "ANZ customer" であると分かっています。

コストは 1 回だけ支払われました。1 回のゲート confirmation、1 回のファイル write。それが、ディレクトリ walk にファイルを 1 つ追加するだけの価格で、以後のすべてのワークフローへ返ってきます。

---

<a id="sensors-the-deterministic-second-opinion"></a>
## センサー: 決定論的な second opinion

ルールはエージェントが読む prose です。センサーは、エージェントがステージ出力を書いたときに自動で走る deterministic checks です。ルールが「user stories は Given/When/Then format に従う」と述べるところで、センサーは必要な headings がファイルに実際に存在するかを byte-for-byte で検証できます。ルールはステージに向けてエージェントを前に進め、センサーはエージェントが実際に何を作ったかを後ろ向きに返します。

<a id="how-sensors-fire"></a>
### センサーはどう発火するか

エージェントがステージ中に output ファイルを書くか編集すると、PostToolUse hook が、そのステージに適用されるセンサーを確認し、一致するものをそれぞれ実行します。一致判定はファイル shape によります。code-quality センサーは `**/*.{ts,js}` を解析すると宣言しているので、TypeScript と JavaScript の書き込みでのみ発火します。あらゆるステージ出力で発火する document-shape センサーは filter を省略します。ワークフロー中にあなたが手でセンサーを呼び出すことはありません。すべての Write と Edit に伴って走ります。

センサー result はこの release では **advisory** です。failing センサーは audit row と、何が欠けているかを正確に示す detail ファイルを生成しますが、ステージの承認ゲートをブロックしたりワークフローを止めたりはしません。signal は見えます。どう扱うかはあなたが決めます。

<a id="what-you-see-in-the-audit-log"></a>
### audit log で何が見えるか

センサー activity は intent の `audit/` shards に `Sensor Fired`、`Sensor Passed`、`Sensor Failed` rows として現れます。failed row は detail ファイルへのリンクを持ちます（例: `<record>/.aidlc-sensors/<stage-slug>/required-sections-<timestamp>.md`）。そこには、欠けている headings、参照されていない upstream 成果物、lint error など、具体的な gap が列挙されます。audit log については [状態管理と監査証跡](10-state-and-audit.md) で扱います。

<a id="the-four-framework-sensors"></a>
### framework に同梱される 4 つのセンサー

framework には 4 つのセンサーが出荷されます。

| センサー | 発火対象 | 検査内容 |
|--------|----------|--------|
| `required-sections` | 記録ディレクトリ内の任意の Markdown 出力 | 出力に必須の H2 見出しが含まれるか（汎用的な内容構造の検査） |
| `upstream-coverage` | 記録ディレクトリ内の任意の Markdown 出力 | 出力の本文が、ステージの `consumes` に宣言された各上流成果物を参照しているか |
| `linter` | `.ts` / `.js` のコード出力 | 設定済みのリンターを実行する（既定は ESLint） |
| `type-check` | `.ts` / `.tsx` のコード出力 | 設定済みの型チェッカーを実行する（既定は `tsc`） |

各ステージは、自分の outputs に対してどのセンサーを発火させるかを宣言します。独自のセンサーを追加することもできます。`.claude/sensors/` の下に manifest を著述し、その id を実行対象のステージに追加してください。ゲートで 1 つ確認すれば、learning loop がセンサーを install してくれることもあります。manifest format、per-stage matrix、authoring walkthrough は [Sensor System](../reference/07-sensor-system.md) にあります。自身の project へ追加する手順は [カスタマイズ](13-customization.md) を参照してください。

---

<a id="planes-how-it-fits-together"></a>
## プレーン（Planes）: 全体への当てはめ方

上の内容は、planes を意識しなくても使えます。しかし基盤となる design は networking から discipline を借りており、それに名前を与えると、「次のワークフローで適用される」という振る舞いが腑に落ちます。

現代的な router は仕事を 3 つの planes に分けます。AI-DLC も同じ分割を採ります。

- **制御プレーン（Control plane）** — 何を走らせるべきかという *schema*。ステージ definitions、ルール、センサー。networking でいえば route computation です。configuration から、何がどこに適用されるかを決めます。control plane は 1 回しか走らないので、遅くても賢くても構いません。
- **データプレーン（Data plane）** — *実際の実行*。ステージ executions、エージェント invocations、intent の記録ディレクトリにあるファイル。networking でいえば packet forwarding です。高速で、繰り返され、lookup によって動きます。data plane は解決済みの答えを読むだけで、再導出しません。
- **管理プレーン（Management plane）** — *観測と設定* の surface。`/aidlc --doctor`、audit log、`CLAUDE.md`。ここで設定し、ここで問い合わせます。人間の cadence で使う plane です。

control plane は、ワークフロー start 時にルールとセンサーを 1 度だけ graph へ compile します。data plane は、その run の残りで pre-resolved answers をその graph から読みます。だからこそワークフローの途中で捉えた learning は、次の compile を待つのです。framework は「topology change time」（ワークフロー start）で答えを計算し、「packet time」（各ステージごと）では計算しません。その結果として、再現可能な runs と、restart 後の clean な recovery が得られます。

user としては、たいてい 1 回に 1 つの horizontal slice だけに触れます。ワークフローを走らせる、learning を捉える、team practices をカスタマイズする、起きたことを audit する、といった具合です。各 slice は、その下の planes に触れつつも、あなたにそれらを意識させません。完全な model、compile boundary、recovery property は [Plane Architecture](../reference/02-plane-architecture.md) にあり、そこで生じる telemetry 成果物は [Runtime Graph](../reference/13-runtime-graph.md) に記載されています。

---

<a id="next-steps"></a>
## 次のステップ

- [ナレッジ](08-knowledge.md) — エージェントの行動を制約するのではなく、情報を与える 2 層 knowledge system
- [カスタマイズ](13-customization.md) — ルールやセンサーを追加し、loop を拡張し、ステージやエージェントを追加する
- [対話モード](07-interaction-modes.md) — ステージの中で corrections がどう起こるか
- [状態管理と監査証跡](10-state-and-audit.md) — learning loop の events がどう記録されるか
- [CLI コマンド](12-cli-commands.md) — doctor の rule-drift と paired-coverage advisory rows
- [Rule System](../reference/08-rule-system.md) · [Sensor System](../reference/07-sensor-system.md) · [Plane Architecture](../reference/02-plane-architecture.md) — schema と design の詳細リファレンス
- [用語集](glossary.md) — 用語リファレンス
