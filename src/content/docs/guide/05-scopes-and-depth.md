---
title: スコープ、深度、テスト戦略
description: 実行するステージ、成果物の詳細度、生成するテスト量を scope・depth・test strategy がどう制御するかを説明します。
sidebarOrder: 5
sourcePath: docs/guide/05-scopes-and-depth.md
sourceCommit: 3c76878775915b6dc510fa7e1ef0991ba510cd53
sourceHash: 8bf398871644606141380b370bacb8e1b85cc1a32ac84e258c5583ee996d5db7
translationStatus: current
---

<a id="scopes-depth-and-test-strategy"></a>
# スコープ、深度、テスト戦略 (Scopes, Depth, and Test Strategy)

scopes は **どの stages を実行するか** を制御します。depth は各 stage が **どれだけ詳細な成果物を出すか** を制御します。test strategy は **どれだけ多くの tests を生成するか** を制御します。これら 3 つが組み合わさることで、enterprise 向けの包括的な feature から、素早い bugfix まで、task に合わせて lifecycle を適応させます。

---

<a id="the-9-scopes"></a>
## 9 つのスコープ

すべての workflow は 9 つの named scopes のいずれかで動きます。各 scope は stage set と default depth level を定義します。

<a id="enterprise"></a>
### enterprise

**使用場面:** 完全な audit trail、compliance review、production-grade operations が必要な、規制対象の enterprise feature を構築するとき。

- **Stages:** 全 32
- **Default depth:** Comprehensive
- **Includes:** 完全な compliance、security、operations stages

<a id="feature"></a>
### feature

**使用場面:** 任意サイズの新しい feature を構築するとき。AI-DLC がより具体的な一致を判断できない場合の default scope です。

- **Stages:** 全 32
- **Default depth:** Standard
- **Includes:** すべての stages、標準的な artifact detail

<a id="mvp"></a>
### mvp

**使用場面:** greenfield の minimum viable product を構築するとき。後半の operations は skip しつつ、design と construction は完全に保持します。

- **Stages:** 32 のうち 22
- **Default depth:** Standard
- **Skips:** 7 つすべての Operation stages（deployment pipeline、environment provisioning、deployment execution、observability、incident response、performance validation、feedback）に加え、Ideation の Market Research、Team Formation、Approval Handoff（10 skipped、22 executed）

<a id="poc"></a>
### poc

**使用場面:** 実現可能性を素早く証明したいとき。Ideation と Inception の多くを skip し、素早く code に到達することを重視します。

- **Stages:** 32 のうち 8
- **Default depth:** Minimal
- **Skips:** Market Research、Feasibility、Team Formation、Mockups、User Stories、および大半の Operation stages

<a id="bugfix"></a>
### bugfix

**使用場面:** 特定の bug を修正するとき。intent capture から code generation と testing までの streamlined path を取ります。

- **Stages:** 32 のうち 7
- **Default depth:** Minimal
- **Skips:** Market Research、Feasibility、Team Formation、Mockups、大半の design/architecture stages、すべての Operation stages

<a id="refactor"></a>
### refactor

**使用場面:** 機能は変えずに既存 code を整理・再構成するとき。

- **Stages:** 32 のうち 8
- **Default depth:** Minimal
- **Skips:** bugfix に近く、code analysis、design、implementation に集中

<a id="infra"></a>
### infra

**使用場面:** infrastructure changes（新しい environments、CDK/CloudFormation updates、cost optimization）を行うとき。

- **Stages:** 32 のうち 13
- **Default depth:** Standard
- **Skips:** user-facing stages（stories、mockups、user flows）。architecture、infrastructure、deployment に集中

<a id="security-patch"></a>
### security-patch

**使用場面:** CVE や security vulnerability に対応するとき。security-relevant stages に絞った fast path を通ります。

- **Stages:** 32 のうち 10
- **Default depth:** Minimal
- **Skips:** Market Research、Team Formation、Mockups、non-security design stages

<a id="workshop"></a>
### workshop

**使用場面:** AI-DLC の workshop や training session を実行するとき。project は facilitator により事前決定され、participants は mob として inception、construction、operation を進めます。

- **Stages:** 32 のうち 25
- **Default depth:** Standard
- **Default test strategy:** Minimal（Nyquist）。workshop の pace を速く保つためです
- **Skips:** すべての Ideation stages（1.1-1.7）。project scope は事前に決まっています

複数開発者向けの手動レシピと claim semantics は [ワークショップモード](workshop-mode.md) を参照してください。

---

<a id="scope-routing-table"></a>
## スコープのルーティング表 (Scope Routing Table)

権威あるデータは `.claude/scopes/aidlc-<name>.md` files（scope identity）と、各 stage の `scopes:` frontmatter（membership）にあり、それが `.claude/tools/data/scope-grid.json` へ compile されます。live な compiled table は `bun .claude/tools/aidlc-utility.ts scope-table`、user-facing な one-liners は `bun .claude/tools/aidlc-utility.ts help` で確認できます。

| スコープ | EXECUTE / 合計 | 深度 | テスト戦略 | 用途 |
|-------|-----------------|-------|---------------|----------|
| `enterprise` | 32 / 32 | Comprehensive | Comprehensive | 規制対象の enterprise feature、完全な audit trail |
| `feature` | 32 / 32 | Standard | Standard | 新機能の default |
| `mvp` | 22 / 32 | Standard | Standard | Greenfield、後半の operations を省略 |
| `poc` | 8 / 32 | Minimal | Minimal | 素早く feasibility を証明 |
| `bugfix` | 7 / 32 | Minimal | Minimal | 特定の bug を修正 |
| `refactor` | 8 / 32 | Minimal | Minimal | 既存 code の整理 |
| `infra` | 13 / 32 | Standard | Standard | infrastructure change |
| `security-patch` | 10 / 32 | Minimal | Minimal | CVE response |
| `workshop` | 25 / 32 | Standard | **Minimal** | AI-DLC workshop または training session |
| (auto-detect) | Varies | Varies | Varies | AI が freeform intent から決定 |

scopes の ceremony の差は桁違いです。`poc` は 8 stages・5 approval gates で動きますが、`feature` は 32 stages すべてと 29 gates を持ち、Construction では 5 つの design stages が Unit of Work ごとに fan out します。そのため scope confirmation line では、workflow 開始前に何へ同意しているのかが正確に分かるよう、compiled grid から得た exact numbers、つまり stage count、approval-gate count、per-unit fan-out が必ず表示されます。推定値は使いません。

> **プロジェクトごとの既定スコープ:** team は `.claude/settings.json` に `AWS_AIDLC_DEFAULT_SCOPE` を設定することで、project の default scope を事前に固定できます。workshop のように、全 participant が flag を覚えなくても `workshop` で始まってほしい場合に便利です。詳しくは [カスタマイズ § プロジェクトごとの既定スコープ](13-customization.md#per-project-default-scope) を参照してください。

---

<a id="auto-detection-from-freeform-intent"></a>
## 自由記述のインテントからの自動検出

scope を明示指定する必要はありません。何をしたいかを説明すれば、orchestrator が keywords から適切な scope を検出します。

```
/aidlc Build a REST API for inventory management
```

engine は、あなたの intent を keyword patterns と照合して解析します。

| キーワード | 検出されるスコープ |
|----------|---------------|
| "fix", "bug", "broken" | `bugfix` |
| "refactor", "clean up", "simplify" | `refactor` |
| "infrastructure", "deploy", "infra" | `infra` |
| "security", "CVE", "vulnerability", "patch" | `security-patch` |
| "proof of concept", "prototype", "poc", "spike" | `poc` |
| "mvp", "minimum viable" | `mvp` |
| "workshop", "lab", "training" | `workshop` |
| それ以外すべて | `feature` |

**曖昧さの解消ルール:** 入力に scope keyword と、5 語を超える project description の両方が含まれている場合、その一致は incidental とみなされ、代わりに compose offer が発火します。これにより、たとえば "Fix the infrastructure monitoring dashboard" のような入力が、より tailored な plan を出すべき場面で `infra` に機械的に routed されるのを防ぎます。

明確な keyword match の後には、MATCHED scope と、それが持つ ceremony が、compiled grid から引いた 1 行の confirmation として表示されます。

```
Starting a "bugfix" workflow for: "fix login bug" - 7 of 32 stages, 4 approval gates, 1 stage repeats per unit of work in Construction. Confirm to proceed,
name a different scope, or say "compose" for a tailored plan.
```

そのまま続行するには confirm し、開始前に course-correct したければ別の scope（または `compose`）で返答してください。

---

<a id="the-adaptive-composer"></a>
## 適応型コンポーザー (The Adaptive Composer)

stock scope が明確に合わない場合（rich prose、keyword hit なし、または長い説明の中に keyword が埋もれている場合）、`/aidlc` は無言で `feature` に default せず、tailored plan を **COMPOSE** する提案を出します。これを強制することもできます。

```
/aidlc compose "harden the deployment pipeline and add observability"
/aidlc-compose "same thing, as a typeable shortcut"
/aidlc compose --report sonar.json     # compose from a scan report
/aidlc --new-scope "..."               # force a custom scope even on a stock match
```

composer agent は、task と workspace scan（brownfield/greenfield、languages）を読み、適切な EXECUTE/SKIP grid を、skip する各 stage の理由付きで提案します。あなたは gate でそれを approve、edit、reject できます。explicit approval があるまでは何も書き込まれず、workflow も開始されません。approve すると次のいずれかになります。

- 提案が stock scope と MATCH していた場合、その scope で workflow が直接 birth されます（code-level findings を多く含む scan report は、よく `bugfix` や `security-patch` に route されます）
- CUSTOM grid の場合、composer は実際の scope（`scopes/aidlc-<name>.md` と `scope-grid.json` entry）を著述し、同じ turn の中でその scope で workflow を birth します。compose された scope は以後 stock scope と同じように解決され（`/aidlc --scope <name>`）、graph recompile 後も保持されます。`aidlc-graph.ts compile` は、composed grid entries を regenerated `scope-grid.json` に折り込み、stage frontmatter だけから grid を再構築し直すわけではありません

**キーワードの健全性:** composed scopes は `keywords: []` で出荷されるため、1 回限りの plan が将来の keyword auto-detection に参加することはありません。将来の prompts にも反応させるかは、gate で明示的に確認される質問であり、副作用ではありません。

**実行中の再構成 (In-flight recompose):** workflow の途中でも、`/aidlc compose` は実行中 workflow の PENDING stages を組み替える提案を出せます。不要になったものを skip し、やはり必要だと気づいた pending stage を add back する形です。flip は pending かつ cursor より先の stages にのみ適用され、completed と in-progress の stages は凍結されます。残る stages が必要 input を失わないよう validation され、audit lock の下で決定論的な `recompose` verb により適用され、`RECOMPOSED` audit event が記録されます。Construction の最初の EXECUTE stage（walking-skeleton gate anchor）は flip できません。

literal verb を使う必要はありません。workflow の途中で "can we skip market research? we already know this market" のように会話すると、それも reshape request として認識され、同じ gate と同じ `recompose` verb に route されます。stages 名を自分で挙げた場合（"drop market-research and team-formation" など）は、conductor が composer agent を dispatch せずに直接 gate を提示することもあります。その場合でも approval gate と validation は同一です。Kiro と Codex では、確実な documented path として literal な `/aidlc compose "<request>"` を使うのが推奨です。

---

<a id="the-3-depth-levels"></a>
## 3 つの深度レベル

depth は、各 stage が生成する artifacts の詳細度を制御します。scope が default depth を定めますが、上書きできます。

| 深度 | 成果物の詳細度 | 使用場面 |
|-------|----------------|-------------|
| **Minimal** | 必須の core のみ。短い documents、主要な意思決定、最小限の supporting analysis。 | quick fixes、patches、proofs of concept |
| **Standard** | バランスのよい詳細度。完全な requirements、rationale 付きの architecture decisions、十分な test plans。 | ほとんどの features と MVPs |
| **Comprehensive** | enterprise 向けの完全な詳細。網羅的な requirements、compliance matrices、詳細な NFR specifications、完全な audit documentation。 | 規制対象 features、enterprise deployments |

<a id="how-depth-affects-stages"></a>
### 深度がステージに与える影響

各 stage で、agent は active depth に応じて出力を調整します。

- **Minimal:** 1〜2 ページの artifact、主要な意思決定のみ、optional sections は skip
- **Standard:** 完全な artifact、required sections をすべて含み、rationale は簡潔
- **Comprehensive:** expanded artifact、optional sections も含み、詳細な justification と compliance cross-references を付ける

<a id="overriding-depth"></a>
### 深度を上書きする

depth は 3 つの地点で変更できます。

1. **`--depth` CLI flag を使う**。invocation 時に上書きします:
   ```
   /aidlc --depth comprehensive
   /aidlc --scope bugfix --depth standard
   /aidlc --stage code-generation --depth minimal
   ```
2. **scope confirmation 時**。detected scope を orchestrator が確認するとき、単に confirm する代わりに `--depth <level>` と返答します
3. **任意の approval gate**。フィードバックの一部として別の depth level を要求します

各 session の最初の completion message では、次のことが再確認されます。

```
**Project depth**: Standard — depth adapts artifact detail.
**Test strategy**: Standard — test strategy controls test volume.
You can request different depth or test strategy at any approval gate.
```

---

<a id="specifying-scope-directly"></a>
## スコープを直接指定する

<a id="explicit-scope"></a>
### スコープを明示する

```
/aidlc feature
/aidlc bugfix
/aidlc enterprise
```

<a id="scope-with-description"></a>
### スコープと説明を一緒に指定する

```
/aidlc bugfix Fix the login timeout issue
/aidlc poc Build a quick prototype for the search feature
```

<a id="override-scope-with-utility-command"></a>
### ユーティリティコマンドでスコープを上書きする

```
/aidlc --scope bugfix
/aidlc --scope enterprise --stage code-generation
```

`--scope` flag は、jump operations のために `--stage`、`--phase`、`--depth` と組み合わせて使えます。

<a id="override-depth"></a>
### 深度を上書きする

```
/aidlc --depth minimal
/aidlc --scope bugfix --depth comprehensive
/aidlc --scope enterprise --depth standard --stage code-generation
```

`--depth` flag は scope の default depth level を上書きします。有効値は `minimal`、`standard`、`comprehensive`（case-insensitive）です。

<a id="override-test-strategy"></a>
### テスト戦略を上書きする

```
/aidlc --test-strategy minimal
/aidlc --depth standard --test-strategy minimal
```

`--test-strategy` flag は、depth とは独立に test strategy を上書きします。完全な説明は下の [3 つのテスト戦略レベル](#the-3-test-strategy-levels) を参照してください。

---

<a id="the-3-test-strategy-levels"></a>
## 3 つのテスト戦略レベル

test strategy は **どれだけ多くの tests を生成するか** と **どの test types を含めるか** を制御します。これは depth とは独立です。depth が制御するのは artifact detail（documents、diagrams、questions）であり、test strategy が制御するのは test volume のみです。この分離により、speed を優先したいときに、Standard-depth の full workflow を Minimal testing で実行できます。

<a id="minimal-nyquist-model"></a>
### 最小 (Minimal) — ナイキストモデル

signal processing の Nyquist rate に着想を得ています。signal を再構成するのに必要な最小 sampling frequency です。Minimal test strategy は、すべての requirement を検証するために必要最小限の tests を生成します。多くも少なくもありません。

- **特定された requirement ごとに 1 test**（component-driven ではなく requirement-driven）
- **Happy-path floor:** requirement が対応していなくても、各 component に最低 1 つは happy-path unit test を付ける
- **Unit tests only**。integration、E2E、performance、security tests は skip
- 一般的な project で **合計約 5〜15 tests**
- hard rule ではなく soft guideline。safety-critical context であれば agent はこれを超えてもよい

**適した場面:** workshops、training sessions、proofs of concept、quick bugfixes。つまり、完全な test suite に投資するよりも、正しさの確認を素早く済ませたい文脈です。

<a id="standard-per-component-model"></a>
### 標準 (Standard) — コンポーネント単位モデル

components 間の境界を検証する、バランスの取れた test coverage です。

- **component ごとに 5〜8 tests**
- **Unit + integration tests**（components 間の主要な境界）
- E2E、performance、security tests は、NFR requirements が明示的に要求する場合のみ含める
- **Test pyramid proportions:** 約 75% unit / 20% integration / 5% E2E
- soft guideline

**適した場面:** ほとんどの features と MVPs。testing に過剰投資せず、十分な coverage を得たい場合です。

<a id="comprehensive-full-coverage-model"></a>
### 包括的 (Comprehensive) — フルカバレッジモデル

すべての test types をまたぐ、徹底した test coverage です。

- **component ごとに 10〜15 tests**
- **All test types:** unit + integration + E2E + performance（NFRs がある場合）+ security（NFRs がある場合）
- **Test pyramid proportions** は全 types を横断して適用
- soft guideline

**適した場面:** enterprise features、regulated systems、または test coverage の audit trail が必要なあらゆる文脈です。

<a id="how-test-strategy-defaults-work"></a>
### テスト戦略の既定値の仕組み

ほとんどの scopes では、test strategy は **depth level** と同じ値になります。depth が Standard なら、test strategy も Standard です。ただし、一部の scopes は独自の default を宣言します。

| スコープ | 深度 | テスト戦略 | 異なる理由 |
|-------|-------|---------------|----------------|
| `workshop` | Standard | **Minimal** | 学習のために artifacts は full にしつつ、pace を維持するため testing は fast な Nyquist にする |

その他すべての scopes では、test strategy は depth を継承します。必要なら常に `--test-strategy` で上書きできます。

<a id="overriding-test-strategy"></a>
### テスト戦略を上書きする

test strategy は 3 つの地点で変更できます。

1. **`--test-strategy` CLI flag を使う**。invocation 時に上書きします:
   ```
   /aidlc --test-strategy minimal
   /aidlc --depth standard --test-strategy minimal
   /aidlc --scope bugfix --test-strategy comprehensive
   ```
2. **workflow の途中**。active workflow の test strategy を変更します:
   ```
   /aidlc --test-strategy comprehensive
   ```
3. **任意の approval gate**。フィードバックの一部として別の test strategy を要求します

<a id="common-depth-test-strategy-combinations"></a>
### よくある深度とテスト戦略の組み合わせ

| 深度 | テスト戦略 | 効果 | 使用場面 |
|-------|--------------|--------|-------------|
| Standard | Standard | Full artifacts、balanced tests | ほとんどの features（default） |
| Standard | Minimal | Full artifacts、Nyquist tests | workshops、time-boxed sessions |
| Minimal | Minimal | Lean artifacts、lean tests | quick bugfixes、patches |
| Comprehensive | Comprehensive | Full everything | 規制対象の enterprise features |
| Comprehensive | Standard | Full artifacts、balanced tests | pragmatic testing を行う enterprise |
| Minimal | Comprehensive | Lean artifacts、thorough tests | confidence が必要な critical bugfix |

---

<a id="choosing-the-right-scope"></a>
## 適切なスコープを選ぶ

| 状況 | 推奨スコープ |
|-----------|------------------|
| production application 向けの新しい feature | `feature` |
| greenfield product をゼロから作る | `mvp` または `feature` |
| approach の素早い検証 | `poc` |
| 既知の bug を修正 | `bugfix` |
| 振る舞いを変えずに code cleanup | `refactor` |
| 新しい AWS environment や CDK changes | `infra` |
| CVE または security vulnerability への対応 | `security-patch` |
| compliance が必要な regulated feature | `enterprise` |
| AI-DLC workshop または training lab | `workshop` |

迷ったら `feature` から始めてください。32 の stages すべてを含み、各 approval gate で個別 stages を skip できます。

---

<a id="next-steps"></a>
## 次のステップ

- [フェーズとステージ](04-phases-and-stages.md) — 各 stage が何をするか
- [エージェント](06-agents.md) — どの agents がどの scopes に参加するか
- [スキルとランナーコマンド](17-skills.md) — bugfix、feature、mvp、security-patch 用の 1 語 `/aidlc-<scope>` runners
- [CLI コマンド](12-cli-commands.md) — 完全な command reference
- [用語集](glossary.md) — 用語リファレンス
