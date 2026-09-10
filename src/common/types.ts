// Shared between the plugin script (node context) and the panel/content
// script (browser context). Keep it dependency-free so all bundles can
// import it.

export type PaperFormat = 'A4' | 'Letter';
export type PageNumberPosition = 'footer' | 'header' | 'none';

export interface ExportSettings {
	paperFormat: PaperFormat;
	/** Top and bottom margin, in cm. */
	marginVertical: number;
	/** Left and right margin, in cm. */
	marginHorizontal: number;
	pageNumbers: PageNumberPosition;
	headerText: string;
	footerText: string;
	/** Heading levels (1-6) that start on a new page. */
	breakBeforeHeadings: number[];
	includeTitle: boolean;
}

export const defaultSettings: ExportSettings = {
	paperFormat: 'A4',
	marginVertical: 2,
	marginHorizontal: 2,
	pageNumbers: 'footer',
	headerText: '',
	footerText: '',
	breakBeforeHeadings: [1, 2],
	includeTitle: true,
};

/** The note title/date for the export currently in flight, for the {title}/{date} placeholders. */
export interface ExportContext {
	title: string;
	date: string;
}

export const defaultContext: ExportContext = { title: '', date: '' };

/** Stores the sanitised ExportSettings as JSON. Not public: configured entirely from the export panel. */
export const SETTINGS_KEY = 'pdfExport.settings';

/** Stores the ExportContext (title/date) of the export currently in flight, written right before exportPdf runs. */
export const CONTEXT_KEY = 'pdfExport.context';

/**
 * The marker that starts a new page, when alone on its own line.
 *
 * Single source of truth: both the viewer's content script and the export
 * pipeline build their matcher from this.
 */
export const PAGE_BREAK_TOKEN = '///pagebreak';

/** Matches a line that consists of nothing but the page-break marker. */
export function pageBreakLinePattern(): RegExp {
	const escaped = PAGE_BREAK_TOKEN.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
	return new RegExp(`^${escaped}[ \\t]*$`);
}

/**
 * Normalises whatever came out of the settings store. Values written by an
 * older version of the plugin, or hand-edited ones, must never be able to
 * produce invalid CSS.
 */
export function sanitiseSettings(raw: any): ExportSettings {
	const input = (raw && typeof raw === 'object') ? raw : {};

	const clampMargin = (value: any, fallback: number): number => {
		const n = Number(value);
		if (!isFinite(n)) return fallback;
		return Math.min(10, Math.max(0, Math.round(n * 100) / 100));
	};

	const levels = Array.isArray(input.breakBeforeHeadings)
		? input.breakBeforeHeadings
			.map((n: any) => Number(n))
			.filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 6)
		: defaultSettings.breakBeforeHeadings;

	return {
		paperFormat: input.paperFormat === 'Letter' ? 'Letter' : 'A4',
		marginVertical: clampMargin(input.marginVertical, defaultSettings.marginVertical),
		marginHorizontal: clampMargin(input.marginHorizontal, defaultSettings.marginHorizontal),
		pageNumbers: ['footer', 'header', 'none'].includes(input.pageNumbers) ? input.pageNumbers : defaultSettings.pageNumbers,
		headerText: typeof input.headerText === 'string' ? input.headerText : '',
		footerText: typeof input.footerText === 'string' ? input.footerText : '',
		breakBeforeHeadings: Array.from(new Set<number>(levels)).sort(),
		includeTitle: input.includeTitle !== false,
	};
}

/** Normalises whatever came out of the context store. */
export function sanitiseContext(raw: any): ExportContext {
	const input = (raw && typeof raw === 'object') ? raw : {};
	return {
		title: typeof input.title === 'string' ? input.title : '',
		date: typeof input.date === 'string' ? input.date : '',
	};
}

/** Parses a JSON setting value, falling back to `fallback` on empty/invalid input. */
export function parseJsonSetting<T>(raw: unknown, sanitise: (value: any) => T): T {
	if (typeof raw !== 'string' || !raw) return sanitise({});
	try {
		return sanitise(JSON.parse(raw));
	} catch (error) {
		return sanitise({});
	}
}
