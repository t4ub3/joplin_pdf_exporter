// -----------------------------------------------------------------------------
// The panel is settings UI only - it never renders or prints a note itself.
// The Export button just tells the plugin script (index.ts) to run, which
// hands off to Joplin's own "Export as PDF" command; the pagination CSS is
// contributed separately, by contentScript/pageBreakMarker.ts.
// -----------------------------------------------------------------------------

import { ExportSettings, sanitiseSettings } from '../common/types';

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

let currentSettings: ExportSettings = sanitiseSettings({});
let exporting = false;

function readForm(): ExportSettings {
	const levels: number[] = [];
	document.querySelectorAll<HTMLInputElement>('.jpe-heading-level').forEach(input => {
		if (input.checked) levels.push(Number(input.value));
	});

	return sanitiseSettings({
		paperFormat: el<HTMLSelectElement>('jpe-paper-format').value,
		marginVertical: el<HTMLInputElement>('jpe-margin-vertical').value,
		marginHorizontal: el<HTMLInputElement>('jpe-margin-horizontal').value,
		pageNumbers: el<HTMLSelectElement>('jpe-page-numbers').value,
		headerText: el<HTMLInputElement>('jpe-header-text').value,
		footerText: el<HTMLInputElement>('jpe-footer-text').value,
		breakBeforeHeadings: levels,
		includeTitle: el<HTMLInputElement>('jpe-include-title').checked,
	});
}

function writeForm(settings: ExportSettings): void {
	el<HTMLSelectElement>('jpe-paper-format').value = settings.paperFormat;
	el<HTMLInputElement>('jpe-margin-vertical').value = String(settings.marginVertical);
	el<HTMLInputElement>('jpe-margin-horizontal').value = String(settings.marginHorizontal);
	el<HTMLSelectElement>('jpe-page-numbers').value = settings.pageNumbers;
	el<HTMLInputElement>('jpe-header-text').value = settings.headerText;
	el<HTMLInputElement>('jpe-footer-text').value = settings.footerText;
	el<HTMLInputElement>('jpe-include-title').checked = settings.includeTitle;
	document.querySelectorAll<HTMLInputElement>('.jpe-heading-level').forEach(input => {
		input.checked = settings.breakBeforeHeadings.includes(Number(input.value));
	});
}

let saveTimer: any = null;
function onFormChanged(): void {
	currentSettings = readForm();
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(() => {
		webviewApi.postMessage({ type: 'saveSettings', settings: currentSettings });
	}, 250);
}

function setStatus(message: string, kind: 'info' | 'error' = 'info'): void {
	const status = el('jpe-status');
	status.textContent = message;
	status.className = kind === 'error' ? 'jpe-status jpe-status--error' : 'jpe-status';
}

async function exportPdf(): Promise<void> {
	if (exporting) return;
	exporting = true;
	el<HTMLButtonElement>('jpe-export').disabled = true;
	setStatus('Opening the export dialog…');

	try {
		const result = await webviewApi.postMessage({ type: 'export' });
		if (result && result.ok) setStatus('');
		else setStatus((result && result.message) || 'Export failed.', 'error');
	} catch (error) {
		setStatus(`Export failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
	} finally {
		exporting = false;
		el<HTMLButtonElement>('jpe-export').disabled = false;
	}
}

let booted = false;
async function main(): Promise<void> {
	if (booted) return;
	booted = true;

	const stored = await webviewApi.postMessage({ type: 'getSettings' });
	currentSettings = sanitiseSettings(stored);
	writeForm(currentSettings);

	el('jpe-form').addEventListener('change', onFormChanged);
	el('jpe-form').addEventListener('input', onFormChanged);
	el('jpe-export').addEventListener('click', () => { void exportPdf(); });

	setStatus('');
}

document.addEventListener('DOMContentLoaded', () => { void main(); });
if (document.readyState !== 'loading') void main();
