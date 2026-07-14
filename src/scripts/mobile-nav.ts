const DESKTOP_BREAKPOINT = 800;

function main(): void {
	const trigger = document.querySelector<HTMLButtonElement>(
		"[data-mobile-nav-trigger]",
	);
	const panel = document.querySelector<HTMLElement>("[data-mobile-nav]");
	const closeButton = document.querySelector<HTMLButtonElement>(
		"[data-mobile-nav-close]",
	);

	if (!trigger || !panel) {
		return;
	}

	const close = (restoreFocus: boolean): void => {
		panel.hidden = true;
		trigger.setAttribute("aria-expanded", "false");

		if (restoreFocus) {
			trigger.focus();
		}
	};

	const open = (): void => {
		panel.hidden = false;
		trigger.setAttribute("aria-expanded", "true");
	};

	trigger.addEventListener("click", () => {
		if (panel.hidden) {
			open();
			return;
		}

		close(true);
	});

	closeButton?.addEventListener("click", () => {
		close(true);
	});

	panel.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Element)) {
			return;
		}

		if (target.closest("a[href]")) {
			close(true);
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !panel.hidden) {
			event.preventDefault();
			close(true);
		}
	});

	window.addEventListener("resize", () => {
		if (window.innerWidth > DESKTOP_BREAKPOINT && !panel.hidden) {
			close(false);
		}
	});
}

main();
