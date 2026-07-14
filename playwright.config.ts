import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "tests/e2e",
	use: {
		baseURL: "http://127.0.0.1:4321/aidlc-workflows-docs/",
	},
	webServer: {
		command: "bun run build && bun run preview --host 127.0.0.1 --port 4321",
		port: 4321,
		reuseExistingServer: !process.env.CI,
	},
});
