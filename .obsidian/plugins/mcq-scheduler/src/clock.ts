/**
 * The per-question clock shown beside Previous / Next: `answer/total`.
 *
 * The first half is the time taken to answer. It runs from when the question
 * opens until an option is chosen, then stops. The second half is the whole
 * time spent on the question, reading the explanation included. Both restart
 * when another question opens.
 *
 * State is kept as timestamps rather than a counter ticked up by an interval,
 * so a late or skipped tick cannot make it drift, and redrawing the pane loses
 * nothing. `now` is injected, so tests can drive it without real time.
 */

/** `mm:ss`, seconds floored. Minutes do not wrap at 60: 75 min 3 s is `75:03`. */
export function formatClock(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	const mm = Math.floor(seconds / 60);
	const ss = seconds % 60;
	return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export class QuestionClock {
	private startedAt: number;
	private answeredAt: number | null = null;

	constructor(private now: () => number) {
		this.startedAt = now();
	}

	/** Restart both halves at zero, for a newly opened question. */
	start(): void {
		this.startedAt = this.now();
		this.answeredAt = null;
	}

	/** Stop the answer half. Only the first call counts. */
	markAnswered(): void {
		if (this.answeredAt === null) this.answeredAt = this.now();
	}

	answerMs(): number {
		return (this.answeredAt ?? this.now()) - this.startedAt;
	}

	totalMs(): number {
		return this.now() - this.startedAt;
	}

	text(): string {
		return `${formatClock(this.answerMs())}/${formatClock(this.totalMs())}`;
	}
}
