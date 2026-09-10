import joplin from 'api';
import { ContentScriptType, SettingItemType, ToolbarButtonLocation } from 'api/types';
import { CONTEXT_KEY, SETTINGS_KEY, sanitiseSettings } from './common/types';
import { panelHtml } from './panelHtml';

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

/**
 * Writes the {title, date} of the note about to be exported, then runs
 * Joplin's own "Export as PDF" command (native save dialog, full renderer
 * with every installed plugin). The content script picks the context back up
 * via settingValue() when it renders the export.
 */
async function exportCurrentNote(): Promise<{ ok: boolean; message?: string }> {
	const note = await joplin.workspace.selectedNote();
	if (!note) return { ok: false, message: 'Select a note first, then export.' };

	await joplin.settings.setValue(CONTEXT_KEY, JSON.stringify({
		title: note.title || '',
		date: new Date().toLocaleDateString(),
	}));

	await joplin.commands.execute('exportPdf', [note.id]);
	return { ok: true };
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
