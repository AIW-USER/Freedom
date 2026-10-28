import { describe, expect, it } from "vitest";

import { QuestionClock, formatClock } from "../src/clock";

/** A clock whose time only moves when the test says so. */
function fakeTime() {
	let t = 1_000_000;
	return {
		now: () => t,
		advance: (ms: number) => {
			t += ms;
		},
	};
}

describe("formatClock", () => {
	it("formats as mm:ss with seconds floored", () => {
		expect(formatClock(0)).toBe("00:00");
		expect(formatClock(999)).toBe("00:00");
		expect(formatClock(59_999)).toBe("00:59");
		expect(formatClock(61_000)).toBe("01:01");
	});

	it("does not wrap minutes at an hour", () => {
		expect(formatClock((75 * 60 + 3) * 1000)).toBe("75:03");
	});

	it("never shows a negative time", () => {
		expect(formatClock(-500)).toBe("00:00");
	});
});

describe("QuestionClock", () => {
	it("runs both halves together until the question is answered", () => {
		const time = fakeTime();
		const clock = new QuestionClock(time.now);
		clock.start();
		time.advance(42_000);
		expect(clock.text()).toBe("00:42/00:42");
	});

	it("stops the answer half on answering while the total keeps running", () => {
		const time = fakeTime();
		const clock = new QuestionClock(time.now);
		clock.start();
		time.advance(42_000);
		clock.markAnswered();
		time.advance(33_000);
		expect(clock.text()).toBe("00:42/01:15");
	});

	it("keeps the first answer time if answered again", () => {
		const time = fakeTime();
		const clock = new QuestionClock(time.now);
		clock.start();
		time.advance(10_000);
		clock.markAnswered();
		time.advance(20_000);
		clock.markAnswered();
		expect(clock.answerMs()).toBe(10_000);
	});

	it("restarts both halves at zero for the next question", () => {
		const time = fakeTime();
		const clock = new QuestionClock(time.now);
		clock.start();
		time.advance(30_000);
		clock.markAnswered();
		time.advance(30_000);

		clock.start();
		expect(clock.text()).toBe("00:00/00:00");
		// ...and the answer half runs again, because the answered mark is gone.
		time.advance(5_000);
		expect(clock.text()).toBe("00:05/00:05");
	});
});
