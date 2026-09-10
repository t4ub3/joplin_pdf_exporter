import joplin from 'api';
import { ContentScriptType, SettingItemType, ToolbarButtonLocation } from 'api/types';
import { CONTEXT_KEY, SETTINGS_KEY, sanitiseSettings } from './common/types';
import { panelHtml } from './panelHtml';

// Node built-in, external in the webpack bundle, provided by Electron at runtime.
import * as fs from 'fs';

async function registerSettings(): Promise<void> {
	// Deliberately not public: everything is configured in the export panel, so
	// nothing should show up under Settings > Plugins.
	await joplin.settings.registerSettings({
		[SETTINGS_KEY]: {
			value: '',
			type: SettingItemType.String,
			public: false,
			label: 'PDF export settings',
		},
		[CONTEXT_KEY]: {
			value: '',
			type: SettingItemType.String,
			public: false,
			label: 'PDF export context',
		},
	});
}

async function loadSettings(): Promise<unknown> {
	try {
		const raw = await joplin.settings.value(SETTINGS_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch (error) {
		console.warn('PDF Export: could not read stored settings, falling back to defaults', error);
		return {};
	}
}

async function saveSettings(settings: unknown): Promise<void> {
	await joplin.settings.setValue(SETTINGS_KEY, JSON.stringify(sanitiseSettings(settings)));
}

/** Selects the note to export/preview, or an error message if none is selected. */
async function selectedNoteOrError(): Promise<{ note: { id: string; title: string } } | { message: string }> {
	const note = await joplin.workspace.selectedNote();
	if (!note) return { message: 'Select a note first, then export.' };
	return { note };
}

/** Writes the {title, date} of the note about to be exported/previewed. */
async function writeExportContext(title: string): Promise<void> {
	await joplin.settings.setValue(CONTEXT_KEY, JSON.stringify({
		title: title || '',
		date: new Date().toLocaleDateString(),
	}));
}

/**
 * A rough equivalent of Joplin's own friendlySafeFilename(): not
 * byte-for-byte identical, but close enough to produce the same filename for
 * an ordinary note title, which is what lets the Save and "select the PDF to
 * preview" dialogs default to the same file.
 */
function safePdfFilename(title: string): string {
	const blacklist = /[/\n\r<>:'"\\|?*#\x00-\x1f]/g;
	const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];

	let output = (title || '').replace(blacklist, '_').slice(0, 100);
	output = output.replace(/[ .]+$/, '').replace(/^ +/, '');
	if (output.length <= 4 && reservedNames.includes(output.toUpperCase())) output = '___';
	if (!output) output = 'Untitled';

	return `${output}.pdf`;
}

/**
 * Writes the {title, date} of the note about to be exported, then runs
 * Joplin's own "Export as PDF" command (native save dialog, full renderer
 * with every installed plugin). The content script picks the context back up
 * via settingValue() when it renders the export.
 */
async function exportCurrentNote(): Promise<{ ok: boolean; message?: string }> {
	const selected = await selectedNoteOrError();
	if ('message' in selected) return { ok: false, message: selected.message };

	await writeExportContext(selected.note.title);
	await joplin.commands.execute('exportPdf', [selected.note.id]);
	return { ok: true };
}

/**
 * Same export as exportCurrentNote(), plus a second dialog asking the user
 * to point at the PDF they just saved (the exportPdf command never reports
 * back the chosen path - see the "Preview PDF" plan for why), then reads it
 * and returns it as a data: URI for the panel to display inline.
 */
async function previewCurrentNote(): Promise<{ ok: boolean; message?: string; dataUri?: string }> {
	const selected = await selectedNoteOrError();
	if ('message' in selected) return { ok: false, message: selected.message };

	await writeExportContext(selected.note.title);
	const defaultPath = safePdfFilename(selected.note.title);

	await joplin.commands.execute('exportPdf', [selected.note.id]);

	const picked = await joplin.views.dialogs.showOpenDialog({
		filters: [{ name: 'PDF', extensions: ['pdf'] }],
		defaultPath,
		properties: ['openFile'],
	});
	if (!picked || !picked.length) return { ok: false, message: 'Preview cancelled.' };

	try {
		const bytes = await fs.promises.readFile(picked[0]);
		return { ok: true, dataUri: `data:application/pdf;base64,${bytes.toString('base64')}` };
	} catch (error) {
		console.error('PDF Export: could not read the file selected for preview', error);
		return { ok: false, message: 'Could not read the selected file.' };
	}
}

joplin.plugins.register({
	onStart: async function() {
		await registerSettings();

		await joplin.contentScripts.register(
			ContentScriptType.MarkdownItPlugin,
			'pdfExportPageBreakMarker',
			'./contentScript/pageBreakMarker.js',
		);

		const panel = await joplin.views.panels.create('pdfExportPanel');
		await joplin.views.panels.setHtml(panel, panelHtml());
		await joplin.views.panels.addScript(panel, './webview/panel.css');
		await joplin.views.panels.addScript(panel, './webview/panel.js');
		await joplin.views.panels.hide(panel);

		await joplin.views.panels.onMessage(panel, async (message: any) => {
			try {
				if (message?.type === 'getSettings') return await loadSettings();
				if (message?.type === 'saveSettings') {
					await saveSettings(message.settings);
					return true;
				}
				if (message?.type === 'export') return await exportCurrentNote();
				if (message?.type === 'preview') return await previewCurrentNote();
			} catch (error) {
				console.error('PDF Export: message handler failed', error);
				throw error;
			}
			return null;
		});

		await joplin.commands.register({
			name: 'pdfExport.togglePanel',
			label: 'Export as PDF',
			iconName: 'fas fa-file-pdf',
			execute: async () => {
				const visible = await joplin.views.panels.visible(panel);
				await joplin.views.panels.show(panel, !visible);
			},
		});

		await joplin.views.toolbarButtons.create(
			'pdfExportToolbarButton',
			'pdfExport.togglePanel',
			ToolbarButtonLocation.NoteToolbar,
		);
	},
});
