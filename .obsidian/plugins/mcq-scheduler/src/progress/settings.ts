/** Progress bar settings. Pure, so src/types.ts can import it outside Obsidian. */

export interface ProgressSettings {
	/** Default on-track band (percentage points) for bars without `window:`. */
	defaultWindow: number;
	/** Default minimum digits in a bar's fraction, e.g. 4 → `0050/0100`. */
	defaultDigits: number;
	/** Bar ids pinned to the status bar, left to right. */
	statusBars: string[];
	statusShowTitle: boolean;
	/** Lower the goal of daily bars on Sundays. */
	sundayRelief: boolean;
	/** How much lower, in percent: 50 halves the goal, 100 makes Sunday a rest day. */
	sundayReliefPercent: number;
}

export const DEFAULT_PROGRESS_SETTINGS: ProgressSettings = {
	defaultWindow: 5,
	defaultDigits: 4,
	statusBars: ["daily-questions", "daily-time"],
	statusShowTitle: true,
	sundayRelief: false,
	sundayReliefPercent: 50,
};
