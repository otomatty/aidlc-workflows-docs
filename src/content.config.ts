import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

export const DOC_TRANSLATION_STATUSES = ["current", "stale"] as const;

export type DocTranslationStatus =
	(typeof DOC_TRANSLATION_STATUSES)[number];

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
		translationStatus: z.enum(DOC_TRANSLATION_STATUSES),
	}),
});

const site = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/site" }),
	schema: sharedSchema,
});

export const collections = { docs, site };
