/**
 * Markup for the export panel. Kept apart from index.ts so the plugin script
 * stays about wiring, and so the form and the code that reads it (panel.ts)
 * are easy to compare side by side.
 */
export function panelHtml(): string {
	const levels = [1, 2, 3, 4, 5, 6].map(level => `
					<label>
						<input type="checkbox" class="jpe-heading-level" value="${level}"> H${level}
					</label>`).join('');

	return `
		<div id="jpe-panel">
			<h3>Export as PDF</h3>

			<form id="jpe-form" onsubmit="return false;">
				<div class="jpe-field">
					<label for="jpe-paper-format">Paper format</label>
					<select id="jpe-paper-format">
						<option value="A4">A4</option>
						<option value="Letter">Letter</option>
					</select>
				</div>

				<div class="jpe-field jpe-row">
					<div>
						<label for="jpe-margin-vertical">Margin top/bottom (cm)</label>
						<input type="number" id="jpe-margin-vertical" min="0" max="10" step="0.1">
					</div>
					<div>
						<label for="jpe-margin-horizontal">Margin left/right (cm)</label>
						<input type="number" id="jpe-margin-horizontal" min="0" max="10" step="0.1">
					</div>
				</div>

				<div class="jpe-field">
					<label for="jpe-page-numbers">Page numbers</label>
					<select id="jpe-page-numbers">
						<option value="footer">In the footer</option>
						<option value="header">In the header</option>
						<option value="none">No page numbers</option>
					</select>
				</div>

				<div class="jpe-field">
					<label for="jpe-header-text">Header text</label>
					<input type="text" id="jpe-header-text" placeholder="empty">
				</div>

				<div class="jpe-field">
					<label for="jpe-footer-text">Footer text</label>
					<input type="text" id="jpe-footer-text" placeholder="empty">
					<div class="jpe-hint">
						Header and footer accept <code>{page}</code>, <code>{pages}</code>,
						<code>{title}</code> and <code>{date}</code>.
					</div>
				</div>

				<fieldset class="jpe-fieldset">
					<legend>Start a new page before</legend>
					<div class="jpe-levels">${levels}</div>
					<div class="jpe-hint">
						Write <code>///pagebreak</code> on a line of its own for a manual page break.
					</div>
				</fieldset>

				<div class="jpe-checkbox">
					<label>
						<input type="checkbox" id="jpe-include-title"> Put the note title at the top
					</label>
				</div>

				<button type="button" id="jpe-export">Export PDF…</button>
				<div class="jpe-status" id="jpe-status"></div>
			</form>
		</div>
	`;
}
