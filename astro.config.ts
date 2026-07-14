import { unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";
import remarkGfm from "remark-gfm";

import { SITE_BASE, SITE_ORIGIN } from "./src/data/site";
import { remarkGithubAlerts } from "./src/lib/markdown/remark-github-alerts";
import { remarkMermaid } from "./src/lib/markdown/remark-mermaid";
import { remarkUpstreamLinks } from "./src/lib/markdown/remark-upstream-links";
import { remarkValidateSourceAnchors } from "./src/lib/markdown/source-anchors";

export default defineConfig({
	site: SITE_ORIGIN,
	base: SITE_BASE,
	output: "static",
	markdown: {
		processor: unified({
			remarkPlugins: [
				remarkGfm,
				remarkValidateSourceAnchors,
				remarkUpstreamLinks,
				remarkGithubAlerts,
				remarkMermaid,
			],
		}),
		shikiConfig: { theme: "github-dark" },
	},
});
