import { normalizePath, Notice, TFile } from "obsidian";

import type McqSchedulerPlugin from "./main";
import { activityTemplate } from "./activity";

/** At the vault root. */
export const DEFAULT_ACTIVITY_PATH = "MCQ activity.md";
/** Where the note used to live, when it held generated numbers only. */
const OLD_ACTIVITY_PATH = "Progress/MCQ activity.md";

/**
 * Records what you do in the pane — questions answered and time spent — into
 * the progress history, and creates the MCQ activity note that shows it.
 *
 * The note is written once, on "Start monitoring", and never rewritten:
 * its bars read their numbers live through `source:` lines.
 */
export class ActivityLog {
	private listeners = new Set<() => void>();

	constructor(private plugin: McqSchedulerPlugin) {}

	/** Monitoring is on: answers and time are being counted. */
	get enabled(): boolean {
		return this.plugin.settings.activityPath !== "";
	}

	/** Whether the MCQ activity note is in the vault. */
	get noteExists(): boolean {
		return this.enabled && this.plugin.app.vault.getAbstractFileByPath(this.path) instanceof TFile;
	}

	/** Start is offered until monitoring is on and its note exists. */
	get canStart(): boolean {
		return !this.enabled || !this.noteExists;
	}

	get path(): string {
		return this.plugin.settings.activityPath;
	}

	/**
	 * Start monitoring: counting begins now, and the MCQ activity note is
	 * created from the template (or an existing one is adopted). Also
	 * recreates the note if it was deleted while monitoring was on.
	 */
	async start(): Promise<void> {
		const s = this.plugin.settings;
		if (!s.activityPath) s.activityPath = normalizePath(DEFAULT_ACTIVITY_PATH);
		await this.plugin.saveSettings();
		await this.ensureNote();
		this.notify();
		new Notice(`Monitoring MCQ activity in ${s.activityPath}`);
	}

	/** Tell the pane and settings that the note or monitoring state changed. */
	notify(): void {
		for (const fn of this.listeners) fn();
	}

	/**
	 * Move a log started before the note became a template: the old file held
	 * only generated numbers, so it is replaced rather than kept.
	 */
	async migrate(): Promise<void> {
		const s = this.plugin.settings;
		if (s.activityPath !== OLD_ACTIVITY_PATH) return;
		const old = this.plugin.app.vault.getAbstractFileByPath(OLD_ACTIVITY_PATH);
		if (old instanceof TFile) await this.plugin.app.fileManager.trashFile(old);
		s.activityPath = DEFAULT_ACTIVITY_PATH;
		await this.plugin.saveSettings();
		await this.ensureNote();
	}

	private async ensureNote(): Promise<void> {
		const { vault } = this.plugin.app;
		if (vault.getAbstractFileByPath(this.path)) return;
		const modules = this.plugin.schedule.defs.length || 2981;
		await vault.create(this.path, activityTemplate(modules));
	}

	/** Reset the activity: questions answered and time spent, heat maps included. */
	reset(): void {
		this.plugin.progress.clearSource("mcq-solved");
		this.plugin.progress.clearSource("mcq-time");
		new Notice("Activity reset.");
	}

	/** Counted only while monitoring is on. */
	recordSolved(): void {
		if (this.enabled) this.plugin.progress.addSource("mcq-solved", 1);
	}

	recordTime(ms: number): void {
		if (this.enabled && ms > 0) this.plugin.progress.addSource("mcq-time", ms / 60_000);
	}

	async open(): Promise<void> {
		if (!this.noteExists) return;
		const file = this.plugin.app.vault.getFileByPath(this.path);
		if (file) await this.plugin.app.workspace.getLeaf(false).openFile(file);
	}

	onChange(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}
}
