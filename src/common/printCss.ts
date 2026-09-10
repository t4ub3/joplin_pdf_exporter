import { ExportSettings } from './types';

export interface PrintContext {
	/** Note title, for the {title} placeholder and the injected title heading. */
	title: string;
	/** Localised date, for the {date} placeholder. */
	date: string;
}

/** Escapes a literal for use inside a CSS string. */
function cssString(value: string): string {
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`;
}

/**
 * Turns a header/footer template into a CSS `content` value.
 *
 * `{page}` and `{pages}` become live page counters; `{title}` and `{date}` are
 * substituted at export time. Anything else is kept verbatim.
 *
 * Returns an empty string when the template produces nothing, so that the
 * caller can leave the margin box out entirely.
 */
export function contentValue(template: string, context: PrintContext): string {
	if (!template) return '';

	const parts: string[] = [];
	const pattern = /\{(page|pages|title|date)\}/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	const pushLiteral = (text: string) => {
		if (text) parts.push(cssString(text));
	};

	while ((match = pattern.exec(template)) !== null) {
		pushLiteral(template.slice(lastIndex, match.index));
		if (match[1] === 'page') parts.push('counter(page)');
		else if (match[1] === 'pages') parts.push('counter(pages)');
		else if (match[1] === 'title') pushLiteral(context.title);
		else pushLiteral(context.date);
		lastIndex = pattern.lastIndex;
	}
	pushLiteral(template.slice(lastIndex));

	return parts.join(' ');
}

function marginBox(name: string, content: string): string {
	if (!content) return '';
	return `
		@${name} {
			content: ${content};
			font-family: sans-serif;
			font-size: 9pt;
			color: #444;
			vertical-align: middle;
		}`;
}

/**
 * Builds the stylesheet that turns the rendered note into pages.
 *
 * Header, footer and page numbers are drawn by Chromium's CSS page margin
 * boxes (supported from Chromium 131), which is what makes them repeat on
 * every page and lets `counter(page)` work without paginating by hand.
 *
 * This stylesheet is injected by the content script into every render - the
 * live note viewer as well as a PDF export - so every rule that has a visual
 * effect outside of pagination is guarded by `@media print`. `@page` and
 * `break-*` rules are inert outside of print/pagination contexts on their
 * own, so they are left unguarded.
 */
export function buildPrintCss(settings: ExportSettings, context: PrintContext): string {
	const headerNumbers = settings.pageNumbers === 'header';
	const footerNumbers = settings.pageNumbers === 'footer';

	const headerContent = contentValue(settings.headerText, context);
	const footerContent = contentValue(settings.footerText, context);
	const numberContent = 'counter(page) " / " counter(pages)';

	const boxes = [
		marginBox('top-left', headerContent),
		marginBox('top-right', headerNumbers ? numberContent : ''),
		marginBox('bottom-left', footerContent),
		marginBox('bottom-right', footerNumbers ? numberContent : ''),
	].filter(Boolean).join('');

	const headingSelectors = settings.breakBeforeHeadings
		.map(level => `h${level}`)
		.join(',\n\t\t');

	const headingRule = headingSelectors ? `
		${headingSelectors} {
			break-before: page;
		}` : '';

	return `
	@page {
		size: ${settings.paperFormat};
		margin: ${settings.marginVertical}cm ${settings.marginHorizontal}cm;${boxes}
	}

	/* An explicit ///pagebreak marker. */
	.jpe-page-break {
		break-after: page;
		height: 0;
		margin: 0;
		border: 0;
	}
${headingRule}

	/* Never start the document with a blank page: a heading (or our own
	   injected title) that opens the document keeps its break suppressed,
	   regardless of the breakBeforeHeadings selection above. */
	h1:first-child,
	h2:first-child,
	h3:first-child,
	h4:first-child,
	h5:first-child,
	h6:first-child,
	.jpe-note-title:first-child {
		break-before: avoid !important;
	}

	/* The injected note title only exists to appear in print; the live note
	   viewer already shows the title in Joplin's own UI. */
	.jpe-note-title {
		display: none;
	}

	@media print {
		.jpe-note-title {
			display: block;
		}

		/* The page-break markers are editor decoration only. */
		.jpe-page-marker {
			display: none !important;
		}

		/* Code blocks, table shading and diagram colours are part of the
		   document, not decoration, so they print without the user having to
		   tick "Background graphics". */
		* {
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}

		/* Chromium prints form controls without their default decoration, so the
		   checkboxes of a task list are drawn explicitly. */
		input[type="checkbox"] {
			appearance: none;
			-webkit-appearance: none;
			width: 0.95em;
			height: 0.95em;
			margin: 0 0.4em 0 0;
			border: 1px solid #555;
			border-radius: 2px;
			display: inline-block;
			vertical-align: -0.12em;
			position: relative;
			background: #fff;
		}

		input[type="checkbox"]:checked::after {
			content: "";
			position: absolute;
			left: 0.28em;
			top: 0.04em;
			width: 0.22em;
			height: 0.5em;
			border: solid #333;
			border-width: 0 2px 2px 0;
			transform: rotate(45deg);
		}

		/* Joplin pins diagrams to a fixed width for the viewer; on paper they
		   should keep the size they were rendered at. */
		.mermaid {
			width: auto !important;
			break-inside: avoid;
		}

		img,
		video {
			max-width: 100% !important;
			height: auto !important;
			break-inside: avoid;
		}

		/* SVG (Mermaid, ABC notation) carries its own intrinsic size, usually as
		   an inline max-width, so it is not forced to 100% here. */
		svg {
			break-inside: avoid;
		}

		pre,
		blockquote,
		table {
			break-inside: avoid;
		}

		pre {
			white-space: pre-wrap !important;
			word-break: break-word !important;
		}

		thead {
			display: table-header-group;
		}

		p,
		li {
			orphans: 2;
			widows: 2;
		}

		h1,
		h2,
		h3,
		h4,
		h5,
		h6 {
			break-after: avoid;
		}

		/* Attachment icons need Joplin's icon font, which is not loaded here. */
		.resource-icon {
			display: none !important;
		}
	}
`;
}
