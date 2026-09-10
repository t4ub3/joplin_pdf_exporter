// -----------------------------------------------------------------------------
// Runs as part of Joplin's own renderer - both the live note viewer and, since
// it is a registered content script, the "Export as PDF" command's export
// pipeline (which renders with every installed plugin, us included, then
// prints the result). That's what makes it possible to *not* render notes
// ourselves and still control pagination: this content script's only job is
// to (a) recognise the ///pagebreak marker and (b) inject the pagination CSS
// built from the plugin's settings into every render.
//
// Everything this script adds that would otherwise be visible in the normal
// note viewer (the title heading) is hidden by default and only revealed
// under `@media print`, in printCss.ts - see the comment on buildPrintCss().
// -----------------------------------------------------------------------------

import { CONTEXT_KEY, PAGE_BREAK_TOKEN, SETTINGS_KEY, parseJsonSetting, sanitiseContext, sanitiseSettings } from '../common/types';
import { buildPrintCss } from '../common/printCss';

const MARKER = PAGE_BREAK_TOKEN;

/** Minimal stand-in for markdown-it's Token class: the renderer only reads properties, so a plain object is enough. */
function htmlBlockToken(html: string): any {
	return {
		type: 'html_block',
		tag: '',
		attrs: null,
		map: null,
		nesting: 0,
		level: 0,
		children: null,
		content: html,
		markup: '',
		info: '',
		meta: null,
		block: true,
		hidden: false,
	};
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export default function pageBreakMarker() {
	return {
		plugin: function(markdownIt: any, ruleOptions: any) {
			markdownIt.block.ruler.before('fence', 'jpe_page_break', (state: any, startLine: number, _endLine: number, silent: boolean) => {
				const start = state.bMarks[startLine] + state.tShift[startLine];
				const max = state.eMarks[startLine];

				// Must not be indented (that would be a code block) and must be
				// the whole line.
				if (state.sCount[startLine] - state.blkIndent >= 4) return false;
				if (state.src.slice(start, max).trim() !== MARKER) return false;

				if (silent) return true;

				const token = state.push('jpe_page_break', 'div', 0);
				token.map = [startLine, startLine + 1];
				token.markup = MARKER;
				token.block = true;

				state.line = startLine + 1;
				return true;
			});

			markdownIt.renderer.rules.jpe_page_break = () => {
				// jpe-page-break drives pagination (print only); jpe-page-marker is
				// the dashed divider shown while editing, hidden again in print.
				return '<div class="jpe-page-break jpe-page-marker" aria-label="Page break"><span>page break</span></div>\n';
			};

			// Reads the plugin's settings fresh on every render and injects the
			// note title heading (print-only) and the pagination stylesheet.
			markdownIt.core.ruler.push('jpe_finalize', (state: any) => {
				// Some content scripts (e.g. HTML Blocks' `table` mode) render a
				// cell's markdown via markdownIt.renderInline(), which re-enters the
				// full core rule chain - ours included - as its own nested parse.
				// parseInline()/renderInline() always set state.inlineMode = true,
				// which a real top-level parse never does; that flag, not call
				// depth, is what actually tells "the whole document" apart from "a
				// fragment another plugin is rendering inside itself" (the nested
				// call happens sequentially after the outer parse already finished,
				// not nested inside it, so a depth counter can't tell them apart).
				if (state.inlineMode) return;

				const settingValue = ruleOptions && ruleOptions.settingValue;
				if (typeof settingValue !== 'function') return;

				const settings = parseJsonSetting(settingValue(SETTINGS_KEY), sanitiseSettings);
				const context = parseJsonSetting(settingValue(CONTEXT_KEY), sanitiseContext);

				if (settings.includeTitle && context.title) {
					const titleHtml = `<h1 class="jpe-note-title">${escapeHtml(context.title)}</h1>\n`;
					state.tokens.unshift(htmlBlockToken(titleHtml));
				}

				const styleHtml = `<style>${buildPrintCss(settings, context)}</style>\n`;
				state.tokens.push(htmlBlockToken(styleHtml));
			});
		},

		assets: function() {
			return [
				{
					inline: true,
					mime: 'text/css',
					text: `
						.jpe-page-marker {
							display: flex;
							align-items: center;
							gap: 0.6em;
							margin: 1.2em 0;
							opacity: 0.45;
							font-size: 0.8em;
							text-transform: uppercase;
							letter-spacing: 0.08em;
							user-select: none;
						}

						.jpe-page-marker::before,
						.jpe-page-marker::after {
							content: "";
							flex: 1;
							border-top: 1px dashed currentColor;
						}
					`,
				},
			];
		},
	};
}
