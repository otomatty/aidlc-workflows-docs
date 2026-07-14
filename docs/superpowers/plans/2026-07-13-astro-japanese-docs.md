# AI-DLC Japanese Documentation Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static five-page watcher site with a custom Astro site that renders all 89 upstream Markdown documents in Japanese, preserves three JSON examples, detects upstream drift, and deploys to the existing GitHub Pages URL.

**Architecture:** Astro Content Collections own translated Markdown and metadata. Focused TypeScript modules build navigation, rewrite upstream-relative links, validate source anchors, and compare a translation manifest with a local `aidlc-workflows` checkout. Static Astro pages reuse the current dark visual language, while Pagefind, Mermaid, Vitest, Playwright, and GitHub Actions provide search, diagrams, validation, and deployment.

**Tech Stack:** Astro, TypeScript, Bun, Vitest, Playwright, Pagefind, Mermaid, remark-gfm, unist-util-visit, Biome, GitHub Pages.

## Global Constraints

- Translate only `aidlc-workflows/docs`; do not modify the upstream repository.
- Publish Japanese only.
- Preserve commands, flags, paths, URLs, code, JSON/YAML keys, API names, identifiers, globs, product names, and proper nouns.
- Preserve the upstream directory shape below `src/content/docs/`.
- Store the complete upstream commit SHA and SHA-256 source hash for every translated page.
- Never overwrite a translation during synchronization; report added, changed, deleted, untranslated, and current states.
- Keep imports at module top level.
- Use a `never` assertion in every switch over a TypeScript union or enum.
- Configure the production base path as `/aidlc-workflows-docs`.
- Keep generated output out of source control.
- Do not create a Git commit unless the user explicitly requests one; task-end review checkpoints use `git diff` and tests instead.

---

## File Structure

### Project and tooling

- Create `package.json` — Bun scripts and dependency declarations.
- Create `bun.lock` — generated dependency lock.
- Create `astro.config.ts` — static output, production site URL, base path, Markdown plugins.
- Create `tsconfig.json` — Astro strict TypeScript configuration.
- Create `biome.json` — TypeScript, Astro, JSON, and CSS lint/format policy.
- Create `vitest.config.ts` — unit test discovery.
- Create `playwright.config.ts` — base-path-aware browser tests.
- Create `.gitignore` — dependencies, build output, Pagefind output, Playwright output.
- Create `public/.nojekyll` — retain GitHub Pages behavior.

### Content and metadata

- Create `src/content.config.ts` — `docs` and `site` collection schemas.
- Create `src/content/docs/index.md` — translated `docs/README.md`.
- Create `src/content/docs/guide/**` — translated User Guide.
- Create `src/content/docs/harness-engineering/**` — translated Harness Engineer Guide.
- Create `src/content/docs/reference/**` — translated Developer Reference.
- Create `src/content/site/changelog.md` — migrated Japanese watcher changelog.
- Create `src/data/translation-manifest.json` — source-to-translation records.
- Create `src/data/site.ts` — site URL, base path, repository links, labels.
- Create `src/data/glossary.ts` — required AI-DLC terminology.
- Create `public/examples/test-pro/*.json` — unchanged upstream JSON examples.

### Domain modules

- Create `src/lib/assert-never.ts` — exhaustive union helper.
- Create `src/lib/routes.ts` — source path, content ID, and public URL conversion.
- Create `src/lib/navigation.ts` — guide hierarchy and previous/next links.
- Create `src/lib/translation-manifest.ts` — manifest types and status derivation.
- Create `src/lib/markdown/remark-upstream-links.ts` — relative link conversion.
- Create `src/lib/markdown/remark-github-alerts.ts` — GitHub Alert conversion.
- Create `src/lib/markdown/remark-mermaid.ts` — Mermaid fence marking.
- Create `src/lib/markdown/source-anchors.ts` — explicit source-anchor validation.

### Astro UI

- Create `src/layouts/BaseLayout.astro` — HTML shell and metadata.
- Create `src/layouts/DocsLayout.astro` — documentation shell.
- Create `src/components/Header.astro`.
- Create `src/components/Sidebar.astro`.
- Create `src/components/MobileNav.astro`.
- Create `src/components/Breadcrumbs.astro`.
- Create `src/components/TableOfContents.astro`.
- Create `src/components/PageNavigation.astro`.
- Create `src/components/SourceStatus.astro`.
- Create `src/components/Search.astro`.
- Create `src/components/Mermaid.astro`.
- Create `src/components/GitHubAlert.astro`.
- Create `src/components/Footer.astro`.
- Create `src/pages/index.astro`.
- Create `src/pages/docs/index.astro`.
- Create `src/pages/[...slug].astro`.
- Create `src/pages/changelog.astro`.
- Create `src/pages/404.astro`.
- Create `src/styles/global.css`.
- Create `src/styles/docs.css`.
- Create `src/scripts/mermaid-client.ts`.
- Create `src/scripts/mobile-nav.ts`.
- Create `src/scripts/search.ts`.

### Synchronization and validation

- Create `scripts/sync-upstream.ts` — read-only drift report and reviewed-record mode.
- Create `scripts/validate-content.ts` — source coverage, metadata, duplicate slug, anchor validation.
- Create `scripts/check-links.ts` — built-site link and fragment checker.
- Create `scripts/migrate-static-content.ts` — one-time deterministic migration helper for current HTML.

### Tests and deployment

- Create `tests/unit/routes.test.ts`.
- Create `tests/unit/navigation.test.ts`.
- Create `tests/unit/translation-manifest.test.ts`.
- Create `tests/unit/markdown-links.test.ts`.
- Create `tests/unit/source-anchors.test.ts`.
- Create `tests/unit/sync-upstream.test.ts`.
- Create `tests/unit/content-coverage.test.ts`.
- Create `tests/fixtures/upstream/**`.
- Create `tests/e2e/docs.spec.ts`.
- Create `.github/workflows/ci.yml`.
- Create `.github/workflows/deploy-pages.yml`.
- Modify `README.md` — new local workflow, translation policy, synchronization, deployment.

---

### Task 1: Scaffold Astro and the verification toolchain

**Files:**
- Create: `package.json`
- Create: `astro.config.ts`
- Create: `tsconfig.json`
- Create: `biome.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.gitignore`
- Create: `public/.nojekyll`
- Generate: `bun.lock`

**Interfaces:**
- Produces scripts: `dev`, `build`, `preview`, `check`, `lint`, `test`, `test:e2e`, `search:index`, `validate:content`, `check:links`, `sync`.
- Produces canonical constants `SITE_ORIGIN` and `SITE_BASE` through `src/data/site.ts` in Task 2.

- [ ] **Step 1: Record the pre-migration baseline**

Run:

```bash
git status --short
bun --version
```

Expected: only the approved spec/plan are new; Bun prints a version and exits 0.

- [ ] **Step 2: Install the project dependencies**

Run:

```bash
bun init -y
bun add astro mermaid pagefind remark-gfm unist-util-visit github-slugger
bun add -d typescript vitest @playwright/test @biomejs/biome @astrojs/check
```

Expected: `package.json` and `bun.lock` exist and dependency installation exits 0.

- [ ] **Step 3: Define scripts and strict configuration**

Set `package.json` scripts to:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build && bun run search:index",
    "preview": "astro preview",
    "check": "bun run lint && bun run test && bun run validate:content && bun run build && bun run check:links",
    "lint": "biome check .",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "search:index": "pagefind --site dist",
    "validate:content": "bun scripts/validate-content.ts",
    "check:links": "bun scripts/check-links.ts dist",
    "sync": "bun scripts/sync-upstream.ts"
  }
}
```

Configure `astro.config.ts` with:

```ts
import { defineConfig } from "astro/config";
import remarkGfm from "remark-gfm";

export default defineConfig({
  site: "https://otomatty.github.io",
  base: "/aidlc-workflows-docs",
  output: "static",
  markdown: {
    remarkPlugins: [remarkGfm],
    shikiConfig: { theme: "github-dark" },
  },
});
```

Extend `astro/tsconfigs/strict` in `tsconfig.json`. Configure Biome to ignore `.astro/`, `dist/`, `node_modules/`, `playwright-report/`, and `test-results/`.

- [ ] **Step 4: Add the smallest Astro page**

Create `src/pages/index.astro` with a Japanese title and one link placeholder to `/docs/`. This page is replaced in Task 8.

- [ ] **Step 5: Verify the scaffold**

Run:

```bash
bun run lint
bun run astro check
bun run astro build
```

Expected: all three commands exit 0 and `dist/index.html` exists.

- [ ] **Step 6: Review checkpoint**

Run `git diff -- package.json astro.config.ts tsconfig.json biome.json vitest.config.ts playwright.config.ts .gitignore public/.nojekyll src/pages/index.astro`. Confirm no existing static page was deleted yet.

---

### Task 2: Define content schemas, routes, and site metadata

**Files:**
- Create: `src/content.config.ts`
- Create: `src/data/site.ts`
- Create: `src/data/glossary.ts`
- Create: `src/lib/assert-never.ts`
- Create: `src/lib/routes.ts`
- Test: `tests/unit/routes.test.ts`
- Create fixture: `src/content/docs/index.md`
- Create fixture: `src/content/site/changelog.md`

**Interfaces:**
- Produces `DocTranslationStatus = "current" | "stale"`.
- Produces `sourcePathToContentId(sourcePath: string): string`.
- Produces `contentIdToRoute(contentId: string): string`.
- Produces `withBase(pathname: string): string`.

- [ ] **Step 1: Write failing route tests**

Cover these exact cases:

```ts
expect(sourcePathToContentId("docs/README.md")).toBe("index");
expect(sourcePathToContentId("docs/guide/00-introduction.md")).toBe("guide/00-introduction");
expect(
  sourcePathToContentId("docs/reference/research/Codex Manifest Shape Report.md"),
).toBe("reference/research/codex-manifest-shape-report");
expect(contentIdToRoute("index")).toBe("/docs/");
expect(contentIdToRoute("guide/00-introduction")).toBe("/guide/00-introduction/");
expect(withBase("/guide/00-introduction/")).toBe(
  "/aidlc-workflows-docs/guide/00-introduction/",
);
```

- [ ] **Step 2: Run the tests and observe the expected failure**

Run: `bunx vitest run tests/unit/routes.test.ts`

Expected: FAIL because `src/lib/routes.ts` does not exist.

- [ ] **Step 3: Implement the schemas and route functions**

Use this schema shape in `src/content.config.ts`:

```ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const sharedSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  sidebarOrder: z.number().int().nonnegative(),
});

const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
  schema: sharedSchema.extend({
    sourcePath: z.string().startsWith("docs/"),
    sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
    sourceHash: z.string().regex(/^[0-9a-f]{64}$/),
    translationStatus: z.enum(["current", "stale"]),
  }),
});

const site = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/site" }),
  schema: sharedSchema,
});

export const collections = { docs, site };
```

Implement `assertNever(value: never): never` and pure route conversion functions. Slugify only path segments that cannot be safe URL segments; preserve numbered filenames.

- [ ] **Step 4: Add schema-valid fixtures**

Create a minimal translated `docs/README.md` fixture and changelog fixture using real 40-character commit and 64-character hash strings. Mark the fixture `translationStatus: current`.

- [ ] **Step 5: Run tests and type checks**

Run:

```bash
bunx vitest run tests/unit/routes.test.ts
bun run astro check
```

Expected: PASS and zero Astro diagnostics.

- [ ] **Step 6: Review checkpoint**

Confirm route functions contain no filesystem access and content schema rejects short SHAs and hashes.

---

### Task 3: Build deterministic navigation

**Files:**
- Create: `src/lib/navigation.ts`
- Test: `tests/unit/navigation.test.ts`

**Interfaces:**
- Consumes Astro document entries reduced to `DocNavInput`.
- Produces `buildNavigation(entries: DocNavInput[]): GuideNavigation[]`.
- Produces `findPageNeighbors(navigation, contentId): { previous?: NavLink; next?: NavLink }`.

- [ ] **Step 1: Write failing navigation tests**

Test:

- the three guide groups always appear in User Guide, Harness Engineer Guide, Developer Reference order;
- numbered chapters sort numerically;
- `sidebarOrder` sorts non-numbered pages;
- agents, harnesses, stage details, examples, and research nest under their parent;
- previous/next traversal does not cross guide boundaries.

- [ ] **Step 2: Verify failure**

Run: `bunx vitest run tests/unit/navigation.test.ts`

Expected: FAIL because navigation functions are missing.

- [ ] **Step 3: Implement focused navigation types**

Use:

```ts
export interface DocNavInput {
  id: string;
  title: string;
  sidebarOrder: number;
}

export interface NavLink {
  id: string;
  title: string;
  href: string;
}

export interface NavSection {
  title: string;
  links: NavLink[];
}

export interface GuideNavigation {
  id: "guide" | "harness-engineering" | "reference";
  title: string;
  sections: NavSection[];
}
```

Keep grouping, sorting, flattening, and neighbor lookup in separate pure functions.

- [ ] **Step 4: Run focused and complete unit tests**

Run:

```bash
bunx vitest run tests/unit/navigation.test.ts
bun run test
```

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Confirm every switch on `GuideNavigation["id"]` calls `assertNever` in its default branch.

---

### Task 4: Implement Markdown link, anchor, alert, and Mermaid transforms

**Files:**
- Create: `src/lib/markdown/remark-upstream-links.ts`
- Create: `src/lib/markdown/remark-github-alerts.ts`
- Create: `src/lib/markdown/remark-mermaid.ts`
- Create: `src/lib/markdown/source-anchors.ts`
- Modify: `astro.config.ts`
- Test: `tests/unit/markdown-links.test.ts`
- Test: `tests/unit/source-anchors.test.ts`

**Interfaces:**
- Produces `rewriteUpstreamHref(href, sourcePath, sourceCommit): string`.
- Produces `validateSourceAnchors(markdown): AnchorValidationResult`.
- Remark plugins annotate alerts with `data-alert-kind` and Mermaid blocks with `data-mermaid`.

- [ ] **Step 1: Write failing URL rewrite tests**

Cover:

```ts
expect(rewriteUpstreamHref("../README.md", "docs/guide/00-introduction.md", sha))
  .toBe("/aidlc-workflows-docs/docs/");
expect(rewriteUpstreamHref("../reference/01-architecture.md#planes", source, sha))
  .toBe("/aidlc-workflows-docs/reference/01-architecture/#planes");
expect(rewriteUpstreamHref("../../plugins/test-pro/.aidlc-plugin/plugin.json", source, sha))
  .toBe(`https://github.com/awslabs/aidlc-workflows/blob/${sha}/plugins/test-pro/.aidlc-plugin/plugin.json`);
expect(rewriteUpstreamHref("https://bun.sh", source, sha)).toBe("https://bun.sh");
```

- [ ] **Step 2: Write failing source-anchor tests**

Define explicit source anchors as HTML anchors immediately before translated headings:

```markdown
<a id="configuration-layers"></a>
## 設定レイヤー
```

Test duplicate IDs, invalid IDs, and links to missing IDs.

- [ ] **Step 3: Verify failures**

Run:

```bash
bunx vitest run tests/unit/markdown-links.test.ts
bunx vitest run tests/unit/source-anchors.test.ts
```

Expected: both fail because modules are missing.

- [ ] **Step 4: Implement pure rewrite and validation functions**

Resolve relative links from `sourcePath`. Route `docs/**/*.md` through `sourcePathToContentId`, `contentIdToRoute`, and `withBase`. Route paths outside `docs/` to a commit-pinned GitHub blob URL. Leave `http:`, `https:`, `mailto:`, and hash-only links unchanged.

- [ ] **Step 5: Implement remark plugins**

Transform:

- `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` blockquotes into typed alert nodes;
- fenced `mermaid` code into marked nodes without evaluating diagram content at build time;
- Markdown links through `rewriteUpstreamHref`.

Register the plugins after `remark-gfm` in `astro.config.ts`.

- [ ] **Step 6: Run tests and a fixture build**

Run:

```bash
bun run test
bun run astro build
```

Expected: PASS; fixture links contain the production base path after rendering.

- [ ] **Step 7: Review checkpoint**

Inspect generated fixture HTML. Confirm external links are untouched, source anchors exist, and failed Mermaid evaluation cannot occur during build.

---

### Task 5: Build the custom documentation UI

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/layouts/DocsLayout.astro`
- Create: `src/components/Header.astro`
- Create: `src/components/Sidebar.astro`
- Create: `src/components/MobileNav.astro`
- Create: `src/components/Breadcrumbs.astro`
- Create: `src/components/TableOfContents.astro`
- Create: `src/components/PageNavigation.astro`
- Create: `src/components/SourceStatus.astro`
- Create: `src/components/Footer.astro`
- Create: `src/pages/docs/index.astro`
- Create: `src/pages/[...slug].astro`
- Create: `src/pages/404.astro`
- Create: `src/styles/global.css`
- Create: `src/styles/docs.css`
- Create: `src/scripts/mobile-nav.ts`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes `GuideNavigation[]`, rendered Astro content, headings, source metadata, and page neighbors.
- Produces all static document routes returned by `getStaticPaths()`.

- [ ] **Step 1: Add an end-to-end test for the fixture route**

In `tests/e2e/docs.spec.ts`, assert:

- `/aidlc-workflows-docs/docs/` returns 200;
- Japanese page title is visible;
- sidebar contains all three guide labels;
- source commit link is commit-pinned;
- mobile menu opens at a 390px viewport;
- `/aidlc-workflows-docs/missing/` displays the Japanese 404 page.

- [ ] **Step 2: Verify the browser test fails**

Run:

```bash
bun run build
bunx playwright test tests/e2e/docs.spec.ts
```

Expected: FAIL because layouts and routes do not exist.

- [ ] **Step 3: Implement layouts and route generation**

`[...slug].astro` must:

1. call `getCollection("docs")`;
2. exclude `index`;
3. map every entry through `contentIdToRoute`;
4. render the selected entry;
5. pass headings, navigation, source status, and neighbors to `DocsLayout`.

`docs/index.astro` renders the translated root document with the same layout.

- [ ] **Step 4: Port and expand the visual system**

Move current CSS variables and reusable styles from `style.css` into `src/styles/global.css`. Add a three-column desktop documentation grid, sticky sidebar and table of contents, visible focus states, skip link, reduced-motion support, table overflow, and the existing 800px mobile breakpoint behavior.

- [ ] **Step 5: Implement mobile navigation without framework hydration**

Use a top-level TypeScript module that:

- toggles `aria-expanded`;
- traps no focus;
- closes on Escape and route link selection;
- restores focus to the trigger.

- [ ] **Step 6: Run accessibility-oriented smoke tests**

Run:

```bash
bun run build
bunx playwright test tests/e2e/docs.spec.ts
```

Expected: PASS for fixture routes and mobile interactions.

- [ ] **Step 7: Review checkpoint**

At 390px, 800px, and 1440px widths, confirm no horizontal page overflow except inside tables and code blocks.

---

### Task 6: Add Mermaid and Pagefind search

**Files:**
- Create: `src/components/Mermaid.astro`
- Create: `src/components/Search.astro`
- Create: `src/scripts/mermaid-client.ts`
- Create: `src/scripts/search.ts`
- Modify: `src/layouts/DocsLayout.astro`
- Modify: `src/styles/docs.css`
- Modify: `tests/e2e/docs.spec.ts`

**Interfaces:**
- Mermaid source remains in a `<pre>` fallback until successful rendering.
- Search loads `${SITE_BASE}/pagefind/pagefind.js` only when opened.

- [ ] **Step 1: Extend failing browser tests**

Add fixture Mermaid content and searchable Japanese text. Assert the SVG appears, fallback remains on forced Mermaid failure, search returns the fixture page, and keyboard activation works.

- [ ] **Step 2: Verify expected failure**

Run: `bunx playwright test tests/e2e/docs.spec.ts`

Expected: FAIL because Mermaid and search components are absent.

- [ ] **Step 3: Implement resilient Mermaid rendering**

Initialize Mermaid once with `startOnLoad: false` and `securityLevel: "strict"`. For each marked block, render into a sibling container. On success hide the fallback; on error retain the source and append a Japanese error label.

- [ ] **Step 4: Implement lazy Pagefind search**

Load Pagefind on first dialog open, debounce input, render title and excerpt, and prefix result URLs with `SITE_BASE` exactly once.

- [ ] **Step 5: Build the search index and run tests**

Run:

```bash
bun run build
bunx playwright test tests/e2e/docs.spec.ts
```

Expected: `dist/pagefind/` exists and all tests pass.

- [ ] **Step 6: Review checkpoint**

Disable JavaScript and confirm all document text, links, code, tables, and Mermaid source remain readable.

---

### Task 7: Implement source manifest, synchronization, and content validation

**Files:**
- Create: `src/lib/translation-manifest.ts`
- Create: `src/data/translation-manifest.json`
- Create: `scripts/sync-upstream.ts`
- Create: `scripts/validate-content.ts`
- Create: `tests/unit/translation-manifest.test.ts`
- Create: `tests/unit/sync-upstream.test.ts`
- Create: `tests/fixtures/upstream/docs/current.md`
- Create: `tests/fixtures/upstream/docs/changed.md`
- Create: `tests/fixtures/upstream/docs/added.md`

**Interfaces:**
- Produces `TranslationManifest`, `TranslationRecord`, and `SyncStatus`.
- Produces `compareUpstream(upstreamRoot, manifest): Promise<SyncReport>`.
- CLI supports `--upstream <path>`, `--format text|json`, and `--record`.

- [ ] **Step 1: Write failing drift-classification tests**

Use:

```ts
type SyncStatus = "added" | "changed" | "deleted" | "untranslated" | "current";

interface TranslationRecord {
  sourcePath: string;
  translationPath: string;
  sourceCommit: string;
  sourceHash: string;
}
```

Test all five statuses, a dirty upstream `docs/` tree rejection in `--record` mode, and no translation-file writes in report mode.

- [ ] **Step 2: Verify failure**

Run:

```bash
bunx vitest run tests/unit/translation-manifest.test.ts tests/unit/sync-upstream.test.ts
```

Expected: FAIL because the manifest module and CLI do not exist.

- [ ] **Step 3: Implement hashing and status comparison**

Use Web Crypto SHA-256 and normalize only line endings before hashing. Do not trim whitespace. Sort records by `sourcePath` before JSON serialization.

Use an exhaustive switch:

```ts
switch (status) {
  case "added":
  case "changed":
  case "deleted":
  case "untranslated":
  case "current":
    return labels[status];
  default:
    return assertNever(status);
}
```

- [ ] **Step 4: Implement safe record mode**

Before `--record`:

1. verify upstream is a Git repository;
2. run `git status --short -- docs`;
3. reject non-empty output;
4. resolve `git rev-parse HEAD`;
5. validate every translated file exists and has matching metadata;
6. atomically replace the manifest through a temporary file.

- [ ] **Step 5: Implement content validation**

`validate-content.ts` must fail for:

- any source record without a translation;
- any translation without a record;
- duplicate public route;
- invalid frontmatter;
- source metadata differing from its manifest record;
- duplicate or invalid explicit source anchor;
- missing JSON example.

- [ ] **Step 6: Run tests against fixtures and the real checkout**

Run:

```bash
bun run test
bun run sync -- --upstream "../../aidlc-workflows" --format text
```

Expected before translation: a deterministic report listing untranslated files, not a stack trace.

- [ ] **Step 7: Review checkpoint**

Confirm report mode leaves `git status --short` unchanged.

---

### Task 8: Migrate the existing Japanese summary and changelog

**Files:**
- Create: `scripts/migrate-static-content.ts`
- Modify: `src/pages/index.astro`
- Replace fixture: `src/content/site/changelog.md`
- Create: `src/pages/changelog.astro`
- Create: `public/architecture.html`
- Create: `public/workflow.html`
- Create: `public/agents.html`
- Create: `public/changelog.html`
- Read then remove after parity: `index.html`
- Read then remove after parity: `architecture.html`
- Read then remove after parity: `workflow.html`
- Read then remove after parity: `agents.html`
- Read then remove after parity: `changelog.html`
- Read then remove after parity: `style.css`
- Remove after manifest migration: `last_checked.json`
- Modify: `README.md`

**Interfaces:**
- Top page owns curated summary content.
- `/changelog/` owns migrated historical entries.
- Old `.html` files contain static redirect markup only.

- [ ] **Step 1: Add parity assertions**

Extend browser tests to assert the top page contains the current quick-start command, phase count, supported harnesses, and links to all three guides. Assert `/changelog/` contains versions `2.3.3`, `2.2.0`, and `2.0.0`.

- [ ] **Step 2: Verify tests fail**

Run: `bunx playwright test tests/e2e/docs.spec.ts`

Expected: FAIL because the content is not migrated.

- [ ] **Step 3: Convert HTML content deterministically**

Use `migrate-static-content.ts` only as a one-time parser to extract changelog entry headings, metadata, paragraphs, and lists. Review the generated Markdown against `changelog.html`; do not retain a runtime dependency on old HTML.

- [ ] **Step 4: Build the new landing page**

Combine the existing overview, architecture, workflow, and agents summaries into concise sections and cards. Correct stale counts from the pinned upstream version rather than copying conflicting values from old HTML.

- [ ] **Step 5: Add old-URL redirects**

Each redirect file uses a canonical link, immediate meta refresh, and normal anchor fallback to its new route. `index.html` needs no redirect because Astro owns the same public root.

- [ ] **Step 6: Remove replaced root files and update README**

Delete old root HTML/CSS and `last_checked.json` only after parity tests pass. Document:

```bash
bun install
bun run dev
bun run check
bun run sync -- --upstream "../../aidlc-workflows"
```

- [ ] **Step 7: Run migration tests**

Run:

```bash
bun run check
bun run test:e2e
```

Expected: PASS, including legacy redirects.

- [ ] **Step 8: Review checkpoint**

Compare the old and new sites side by side. Confirm no unique changelog entry or core summary topic was lost.

---

### Task 9: Translate the root and User Guide

**Files:**
- Create/replace: `src/content/docs/index.md`
- Create: `src/content/docs/guide/00-introduction.md`
- Create: `src/content/docs/guide/01-getting-started.md`
- Create: `src/content/docs/guide/02-your-first-workflow.md`
- Create: `src/content/docs/guide/03-spaces-and-intents.md`
- Create: `src/content/docs/guide/04-phases-and-stages.md`
- Create: `src/content/docs/guide/05-scopes-and-depth.md`
- Create: `src/content/docs/guide/06-agents.md`
- Create: `src/content/docs/guide/07-interaction-modes.md`
- Create: `src/content/docs/guide/08-knowledge.md`
- Create: `src/content/docs/guide/09-rules-and-the-learning-loop.md`
- Create: `src/content/docs/guide/10-state-and-audit.md`
- Create: `src/content/docs/guide/11-session-management.md`
- Create: `src/content/docs/guide/12-cli-commands.md`
- Create: `src/content/docs/guide/13-customization.md`
- Create: `src/content/docs/guide/14-artifacts-reference.md`
- Create: `src/content/docs/guide/15-troubleshooting.md`
- Create: `src/content/docs/guide/16-worked-examples.md`
- Create: `src/content/docs/guide/17-skills.md`
- Create: `src/content/docs/guide/glossary.md`
- Create: `src/content/docs/guide/workshop-mode.md`
- Create: `src/content/docs/guide/agents/README.md`
- Create: `src/content/docs/guide/agents/architect-agent.md`
- Create: `src/content/docs/guide/agents/aws-platform-agent.md`
- Create: `src/content/docs/guide/agents/compliance-agent.md`
- Create: `src/content/docs/guide/agents/delivery-agent.md`
- Create: `src/content/docs/guide/agents/design-agent.md`
- Create: `src/content/docs/guide/agents/developer-agent.md`
- Create: `src/content/docs/guide/agents/devsecops-agent.md`
- Create: `src/content/docs/guide/agents/operations-agent.md`
- Create: `src/content/docs/guide/agents/pipeline-deploy-agent.md`
- Create: `src/content/docs/guide/agents/product-agent.md`
- Create: `src/content/docs/guide/agents/quality-agent.md`
- Create: `src/content/docs/guide/harnesses/README.md`
- Create: `src/content/docs/guide/harnesses/codex-cli.md`
- Create: `src/content/docs/guide/harnesses/kiro-cli.md`
- Create: `src/content/docs/guide/harnesses/kiro-ide.md`
- Modify: `src/data/glossary.ts`
- Modify: `src/data/translation-manifest.json`

**Interfaces:**
- Every page conforms to the Task 2 schema and explicit source-anchor convention.
- Every source code block is byte-identical after newline normalization.

- [ ] **Step 1: Pin the clean upstream commit**

Run:

```bash
git -C "../../aidlc-workflows" status --short -- docs
git -C "../../aidlc-workflows" rev-parse HEAD
```

Expected: first command has no output; second returns a 40-character SHA.

- [ ] **Step 2: Translate one page at a time**

For each exact file above:

1. copy structural Markdown into its matching translation path;
2. add schema-valid frontmatter;
3. translate prose, headings, tables, alerts, and Mermaid labels;
4. preserve code, commands, paths, identifiers, and URLs;
5. add explicit source anchors before translated headings referenced by upstream links;
6. calculate and record the source SHA-256;
7. mark the page `current`.

- [ ] **Step 3: Enforce terminology**

Add canonical Japanese display terms and English source terms to `src/data/glossary.ts`. Run a terminology scan that rejects known inconsistent alternatives in prose while excluding code blocks.

- [ ] **Step 4: Validate after each directory**

Run after root chapters, agents, and harnesses respectively:

```bash
bun run validate:content
bun run astro check
```

Expected: only not-yet-translated later groups may be reported by sync; translated files have no metadata, anchor, or route errors.

- [ ] **Step 5: Render-review representative pages**

Review:

- `guide/00-introduction`;
- `guide/04-phases-and-stages` for Mermaid;
- `guide/12-cli-commands` for large tables and code;
- `guide/agents/architect-agent`;
- `guide/harnesses/kiro-ide`.

- [ ] **Step 6: Record reviewed hashes**

Run:

```bash
bun run sync -- --upstream "../../aidlc-workflows" --record
bun run sync -- --upstream "../../aidlc-workflows" --format text
```

Expected: User Guide files report `current`.

- [ ] **Step 7: Review checkpoint**

Diff only translated prose and metadata. Confirm no source code fence or JSON/YAML key was translated.

---

### Task 10: Translate the Harness Engineer Guide

**Files:**
- Create: `src/content/docs/harness-engineering/00-overview.md`
- Create: `src/content/docs/harness-engineering/01-anatomy-of-a-stage.md`
- Create: `src/content/docs/harness-engineering/02-adding-a-stage.md`
- Create: `src/content/docs/harness-engineering/03-adding-an-agent.md`
- Create: `src/content/docs/harness-engineering/04-scopes.md`
- Create: `src/content/docs/harness-engineering/05-rules-and-the-loop.md`
- Create: `src/content/docs/harness-engineering/06-sensors.md`
- Create: `src/content/docs/harness-engineering/07-team-knowledge.md`
- Create: `src/content/docs/harness-engineering/08-construction-and-swarm.md`
- Create: `src/content/docs/harness-engineering/09-porting-to-a-new-harness.md`
- Create: `src/content/docs/harness-engineering/10-authoring-a-plugin.md`
- Modify: `src/data/glossary.ts`
- Modify: `src/data/translation-manifest.json`

**Interfaces:**
- Same translation and anchor contracts as Task 9.

- [ ] **Step 1: Confirm upstream commit still matches Task 9**

Run: `git -C "../../aidlc-workflows" rev-parse HEAD`

Expected: exact same SHA recorded by Task 9. If different, stop and rerun sync report before translating.

- [ ] **Step 2: Translate all eleven files**

Apply the seven per-file operations from Task 9 Step 2. Preserve all frontmatter examples, stage fields, glob syntax, plugin manifests, and shell commands.

- [ ] **Step 3: Validate alerts and cross-guide links**

Run:

```bash
bun run validate:content
bun run build
bun run check:links
```

Expected: PASS for all translated Harness Engineer pages and links into User Guide and Reference.

- [ ] **Step 4: Render-review high-risk pages**

Review `06-sensors`, `08-construction-and-swarm`, `09-porting-to-a-new-harness`, and `10-authoring-a-plugin`.

- [ ] **Step 5: Record reviewed hashes**

Run record mode, then report mode. Expected: all eleven files report `current`.

- [ ] **Step 6: Review checkpoint**

Confirm GitHub Alerts render as alerts and repository-outside links point to commit-pinned GitHub URLs.

---

### Task 11: Translate the Developer Reference

**Files:**
- Create: `src/content/docs/reference/00-overview.md`
- Create: `src/content/docs/reference/01-architecture.md`
- Create: `src/content/docs/reference/02-plane-architecture.md`
- Create: `src/content/docs/reference/03-orchestrator.md`
- Create: `src/content/docs/reference/04-stage-protocol.md`
- Create: `src/content/docs/reference/05-agent-system.md`
- Create: `src/content/docs/reference/06-hooks-and-tools.md`
- Create: `src/content/docs/reference/07-sensor-system.md`
- Create: `src/content/docs/reference/08-rule-system.md`
- Create: `src/content/docs/reference/09-testing.md`
- Create: `src/content/docs/reference/10-knowledge-system.md`
- Create: `src/content/docs/reference/11-contributing.md`
- Create: `src/content/docs/reference/12-state-machine.md`
- Create: `src/content/docs/reference/13-runtime-graph.md`
- Create: `src/content/docs/reference/14-claude-features.md`
- Create: `src/content/docs/reference/15-stage-definition.md`
- Create: `src/content/docs/reference/16-artifact-vocabulary.md`
- Create: `src/content/docs/reference/17-skill-system.md`
- Create: `src/content/docs/reference/18-plugin-mechanism.md`
- Create: `src/content/docs/reference/diagrams.md`
- Create: `src/content/docs/reference/kiro-ide-hook-payload.md`
- Create: `src/content/docs/reference/04-stages/initialization.md`
- Create: `src/content/docs/reference/04-stages/ideation.md`
- Create: `src/content/docs/reference/04-stages/inception.md`
- Create: `src/content/docs/reference/04-stages/construction.md`
- Create: `src/content/docs/reference/04-stages/operation.md`
- Create: `src/content/docs/reference/agents/README.md`
- Create: `src/content/docs/reference/agents/architect-agent.md`
- Create: `src/content/docs/reference/agents/aws-platform-agent.md`
- Create: `src/content/docs/reference/agents/compliance-agent.md`
- Create: `src/content/docs/reference/agents/delivery-agent.md`
- Create: `src/content/docs/reference/agents/design-agent.md`
- Create: `src/content/docs/reference/agents/developer-agent.md`
- Create: `src/content/docs/reference/agents/devsecops-agent.md`
- Create: `src/content/docs/reference/agents/operations-agent.md`
- Create: `src/content/docs/reference/agents/pipeline-deploy-agent.md`
- Create: `src/content/docs/reference/agents/product-agent.md`
- Create: `src/content/docs/reference/agents/quality-agent.md`
- Create: `src/content/docs/reference/examples/test-pro/README.md`
- Create: `src/content/docs/reference/research/codex-manifest-shape-report.md`
- Create: `src/content/docs/reference/research/cross-tool-plugin-comparison.md`
- Copy unchanged: `public/examples/test-pro/aidlc.lock.json`
- Copy unchanged: `public/examples/test-pro/managed-settings.json`
- Copy unchanged: `public/examples/test-pro/marketplace.json`
- Modify: `src/data/glossary.ts`
- Modify: `src/data/translation-manifest.json`

**Interfaces:**
- Same translation and anchor contracts as Task 9.
- Research filenames map through the stable route slugs defined in Task 2.

- [ ] **Step 1: Confirm the pinned upstream commit**

Run the same clean-tree and SHA checks as Task 9. Stop if the SHA changed.

- [ ] **Step 2: Translate direct reference chapters**

Translate `00-overview.md` through `18-plugin-mechanism.md`, plus `diagrams.md` and `kiro-ide-hook-payload.md`. Validate after every five files.

- [ ] **Step 3: Translate stage detail chapters**

Translate the five `04-stages/` files one at a time. After each file, compare code fence count, table count, Mermaid count, and source-anchor count with the source.

- [ ] **Step 4: Translate agent references**

Translate `agents/README.md` and all eleven agent files. Keep tier names, agent IDs, frontmatter keys, and harness model values unchanged.

- [ ] **Step 5: Translate examples and research**

Translate the test-pro README and two research reports. Copy all three JSON files byte-for-byte and link them from the translated example README.

- [ ] **Step 6: Validate diagrams and duplicate content**

Build and review `reference/diagrams` plus the chapters containing duplicated inline diagrams. Confirm translated labels are consistent in both locations.

- [ ] **Step 7: Run full content checks**

Run:

```bash
bun run validate:content
bun run build
bun run check:links
bun run test:e2e
```

Expected: PASS.

- [ ] **Step 8: Record reviewed hashes**

Run record mode and then text report mode.

Expected: all 89 Markdown and 3 JSON sources report `current`.

- [ ] **Step 9: Review checkpoint**

Sample every content class: overview, architecture, protocol, stage, agent, diagram index, example, payload, and research report.

---

### Task 12: Add built-output integrity checks

**Files:**
- Create: `scripts/check-links.ts`
- Modify: `scripts/validate-content.ts`
- Modify: `tests/e2e/docs.spec.ts`
- Create: `tests/unit/content-coverage.test.ts`

**Interfaces:**
- `check-links.ts <dist-path>` returns 0 only when all internal pages, assets, and fragments exist.
- Coverage test expects exactly the manifest counts, not hard-coded undocumented filesystem assumptions.

- [ ] **Step 1: Write failing integrity tests**

Create temporary built HTML fixtures containing a missing page, missing fragment, missing asset, and external URL. Assert only the first three fail.

- [ ] **Step 2: Implement the checker**

Parse built HTML, normalize base-prefixed URLs, ignore external protocols, resolve directory indexes, and index every `id` before checking fragments. Print source page, broken href, and reason on failure.

- [ ] **Step 3: Add translation invariants**

For every Markdown source/translation pair, compare:

- fenced code block count and exact normalized contents;
- raw URL set;
- explicit source-anchor uniqueness;
- Mermaid block count;
- non-empty Japanese prose outside code blocks.

- [ ] **Step 4: Run the complete local gate**

Run:

```bash
bun run check
bun run test:e2e
bun run sync -- --upstream "../../aidlc-workflows" --format text
```

Expected: all commands pass; sync reports 89 Markdown and 3 JSON sources current.

- [ ] **Step 5: Review checkpoint**

Open the built root, one page from each guide, the largest stage page, search, changelog, all redirects, and 404.

---

### Task 13: Configure CI and GitHub Pages deployment

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `README.md`

**Interfaces:**
- Pull requests run validation without deployment.
- Pushes to `main` deploy only after the complete gate passes.

- [ ] **Step 1: Add CI workflow**

Use `oven-sh/setup-bun`, cache through Bun's lockfile, run:

```bash
bun install --frozen-lockfile
bun run lint
bun run test
bun run validate:content
bun run build
bun run check:links
```

Do not require a sibling upstream checkout in CI; manifest validation is self-contained.

- [ ] **Step 2: Add Pages workflow**

Grant only `contents: read`, `pages: write`, and `id-token: write`. Build once, upload `dist/` with `actions/upload-pages-artifact`, and deploy with `actions/deploy-pages`. Serialize deployments through a `pages` concurrency group.

- [ ] **Step 3: Add Playwright CI coverage**

Install Chromium with dependencies, serve `dist/` under the configured base path, and run `bun run test:e2e`.

- [ ] **Step 4: Update operator documentation**

Document:

- local setup and commands;
- translation rules;
- explicit source anchors;
- sync report and reviewed record mode;
- stale-page behavior;
- GitHub Pages repository setting;
- how to recover from a broken upstream rename.

- [ ] **Step 5: Run the same commands as CI**

Run:

```bash
bun install --frozen-lockfile
bun run lint
bun run test
bun run validate:content
bun run build
bun run check:links
bun run test:e2e
```

Expected: all commands exit 0.

- [ ] **Step 6: Final review checkpoint**

Run `git status --short` and `git diff --stat`. Confirm:

- no `dist/`, `.astro/`, `node_modules/`, Playwright report, or test result is tracked;
- 89 translated Markdown files and 3 unchanged JSON examples exist;
- old static content has corresponding new content or redirects;
- no commit or push has occurred without explicit user authorization.
