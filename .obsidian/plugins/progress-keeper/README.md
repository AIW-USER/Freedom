# Progress Keeper

Progress bars written as text in your notes. A bar is either **fixed** (one run from a start to a deadline) or **recurring** (a goal that repeats every day, week or any period you choose). Its colour shows whether you're ahead or behind schedule. You can pin bars to the status bar, and heat maps show how much you did over time.

The plugin never writes to your notes. You update a bar by editing its number yourself.

## Quick reference

````
```progress
Mastered: 0120/2981            ← Title: value/total (required, always first)
type: fixed                    ← fixed (default) | recurring
start: 2026:09:01:00:00        ← fixed: start · recurring: when periods begin (optional)
deadline: 2026:12:31:23:59     ← fixed only
every: 1 day                   ← recurring only: 12h, 1 day, 3 days, weekly, fortnightly, monthly…
count: reset                   ← recurring only: reset (default: note = this period's count) | running (note = running total)
window: 5                      ← on-track band in % points (default 5)
digits: 4                      ← pad numbers to at least this many digits: 0120/2981 (default 4, 0 = off)
id: mastered                   ← stable name for the status bar, heat maps and history
```
````

````
```progress-heatmap
title: MCQ activity
bars: Mastered, Questions answered   ← or "all"
unit: day                            ← hour | day | week | month
cells: 90                            ← number of boxes
measure: value                       ← value | percent
```
````

| Colour | Meaning |
|---|---|
| Green | Ahead of schedule by more than `window` |
| Blue | Within ± `window` of schedule |
| Red | Behind schedule by more than `window` |
| Theme accent | No schedule (a fixed bar without dates) |

---

## 1. Progress bars

Put a `progress` code block anywhere in a note:

````
```progress
Mastered: 0120/2981
```
````

The first line is always `Title: value/total`. Decimals and leading zeros are allowed, for example `Time spent (mins): 0012.5/0060`. To record progress, change the value (`0120` → `0150`). However you write the numbers, the bar shows them padded to 4 digits, such as `(0120/2981)`. Change this with `digits:` or in Settings.

### Optional lines

Add any of these after the first line, in any order:

| Line | Meaning | Default |
|---|---|---|
| `type: fixed` / `type: recurring` | The kind of bar (see [Bar types](#bar-types)) | `fixed` |
| `start: 2026:09:01:00:00` | Fixed: when the work starts. Recurring: when the periods begin | none |
| `deadline: 2026:12:31:23:59` | Fixed only: when it should be finished (`end:` also works) | none |
| `every: 1 day` | Recurring only: how long each period lasts | `1 day` |
| `count: reset` / `count: running` | Recurring only: whether the number is this period's count or a running total (see [Recurring](#recurring)) | `reset` |
| `window: 5` | How far from the expected progress, in percentage points, still counts as on track | 5 (set in Settings) |
| `digits: 4` | Minimum digits for the numbers in the `(0050/0100)` fraction. Shorter numbers get leading zeros. `0` turns padding off | 4 (set in Settings) |
| `id: mastered` | The name used for the status bar and heat maps | the title |

Full examples, one of each type:

````
```progress
Mastered: 0120/2981
type: fixed
start: 2026:09:01:00:00
deadline: 2026:12:31:23:59
window: 5
id: mastered
```
````

````
```progress
Questions answered: 0030/0100
type: recurring
every: 1 day
count: reset
start: 2026:09:01:05:00
window: 10
id: daily-questions
```
````

### Bar types

#### Fixed (start and finish)

A single goal with one deadline, for example "master 2981 MCQs by 31 December". The bar shows the number written in the note.

````
```progress
Mastered: 0120/2981
type: fixed
start: 2026:09:01:00:00
deadline: 2026:12:31:23:59
```
````

`type: fixed` is the default, so you can leave it out. Without `start` and `deadline`, the bar just shows the number and has no schedule.

#### Recurring

A goal that repeats, for example "100 questions every day". The total is the goal **for each period**. When a new period starts, the bar goes back to empty and the colour is judged against how much of the current period has passed.

````
```progress
Questions answered: 0030/0100
type: recurring
every: 1 day
```
````

**`every:`** sets the period length. You can write it any of these ways:

| Write | Period |
|---|---|
| `1 day`, `day`, `daily`, `1d` | each day |
| `12 hours`, `12h`, `hourly` | every 12 hours / every hour |
| `3 days`, `every 3 days` | every 3 days |
| `1 week`, `weekly`, `1w` | each week (Monday to Sunday) |
| `2 weeks`, `fortnightly` | every two weeks |
| `1 month`, `monthly`, `1mo` | each calendar month |

If you write `every:` without a `type:` line, the bar is recurring. `type: recurring` without `every:` means every day.

**When periods begin.** By default:
- day periods start at midnight;
- week periods start on Monday;
- month periods start on the 1st;
- hour periods start on the hour.

Periods longer than one unit (such as `2 weeks` or `3 days`) are counted from Monday 5 January 2026. To choose the boundary yourself, add `start:`. For example, `start: 2026:09:01:05:00` with `every: 1 day` makes each day run from 05:00 to 05:00. With `every: 2 weeks`, it makes the fortnights count from 1 September.

**Updating a recurring bar.** The plugin never writes to your notes, so it can't set the number back to 0 when a new period begins. The `count:` line chooses how the number in the note is read:

| `count:` | What the number means | What the bar shows |
|---|---|---|
| `reset` (default) | This period's count. Type today's number: `20/100` means 20 done this period. | The number in the note, as long as you set it during the current period. A number left over from an earlier period counts as **0**, and a hint below the bar says so. |
| `running` | A running total you never reset: 30 → 75 → 140 … | How much the number went up during the current period. |

With `count: reset`, you don't need to type 0 first when a new period starts. Typing the new count straight over yesterday's number works. So does setting it to 0 and counting up. Either way, yesterday's number isn't subtracted from today.

With `count: running`, lowering the number is a correction and is subtracted from the current period.

In both modes, the bar updates as soon as you leave the code block. It doesn't wait for Obsidian to save the note.

A recurring bar can't have a `deadline:`. If you add one, the bar shows an error.

### Dates

Dates use `yyyy:mm:dd:hh:mm` in local time.

- You can leave out the time: `2026:12:31` means midnight at the start of that day.
- `-`, `/` or a space also work as separators: `2026-12-31 23:59`.
- `start` and `deadline` go together. If you give only one, the bar shows an error.

### Colours

If a bar has no start and deadline, it uses your theme's accent colour.

For a **fixed** bar with both dates, and for every **recurring** bar, the plugin works out where you should be right now. It assumes steady progress from 0 at the start to the total at the end (the deadline for a fixed bar, the end of the current period for a recurring bar):

| Colour | Meaning |
|---|---|
| **Blue** | On track: within ± `window` points of where you should be |
| **Green** | Ahead: more than `window` points above |
| **Red** | Behind: more than `window` points below |

Example: halfway through the schedule you should be at 50%. With `window: 5`, anything from 45% to 55% is blue, above 55% is green and below 45% is red. For a daily recurring bar at 18:00, three quarters of the day has passed, so 75% is where you should be.

The bar also shows:
- a **thin marker** on the bar at the point where you should be now (hover it to see the value);
- a **summary line**. Fixed bars show, for example, `+8.2% ahead · 34d left · need 12/day` or `−3.1% behind · deadline passed`. Recurring bars show, for example, `−25.0% behind · 50 to go · resets in 6h` or `Done this period · resets in 6h`;
- the dates: start and deadline for a fixed bar, or the current period for a recurring bar. Recurring bars also have a small badge next to the title, such as "Every day".

Colours update every minute, so if you leave a bar alone it slowly turns from green to blue to red.

---

## 2. Status bar

You can pin any bar to the status bar at the bottom, to the left of *backlinks · words · characters*.

- **Settings → Progress Keeper → Status bar.** Every bar in the vault is listed. Turn the toggle on to pin a bar, and use the ↑/↓ arrows to change the order (left to right).
- **Command palette → "Progress Keeper: Choose status-bar progress bars".** Pick a bar to pin or unpin it. Pinned bars are marked ✓.

Each pinned bar shows as a small bar with its percentage, in its schedule colour. A recurring bar shows its progress for the current period. Hover it for the details, or click it to open the note it's in.

You can hide the titles in the status bar with **Show titles in the status bar** in Settings.

---

## 3. Heat maps

The plugin records every change to a bar's value. Heat maps show that history as a grid of boxes, like the GitHub contributions chart. You can have as many heat maps as you like, each set up differently.

````
```progress-heatmap
title: MCQ activity
bars: Mastered, Questions answered
unit: day
cells: 90
measure: value
```
````

| Line | Options | Default |
|---|---|---|
| `title:` | Any text | `Activity` |
| `bars:` | One or more bar ids or titles, separated by commas, or `all` | `all` |
| `unit:` | `hour`, `day`, `week`, `month` (the plural also works) | `day` |
| `cells:` | Number of boxes, from 1 to 2000 (`boxes:` also works) | `90` |
| `measure:` | `value` (the increase in raw numbers) or `percent` (the increase as a % of each bar's total) | `value` |

- Each box covers one unit, and the last box is the current hour, day, week or month.
- **Day** maps put one week in each column, with Monday at the top. **Hour** maps put one day in each row. **Month** maps put one year in each row. **Week** maps wrap every 26 boxes.
- The more you did, the darker the box. Shading is relative to the busiest box in that map. Hover a box to see its date and amount.
- The header shows the total for the whole map, and the footer lists the bars included.
- Use `measure: percent` when you combine bars with very different totals, such as a 0/100 bar and a 0/2981 bar. Otherwise the larger bar dominates.
- If you correct a number downwards, the lower value is subtracted, but a box never goes below zero.
- When a new period starts, the first change to a `count: reset` bar counts from 0. Going from yesterday's 50 to today's 20 logs +20 for today, and going to 0 logs nothing. Resets never show up as negative activity.
- With `measure: percent`, a recurring bar's increase is divided by its goal for one period.

Examples:

````
```progress-heatmap
title: Everything, last 4 months
bars: all
unit: day
cells: 120
measure: percent
```
````

````
```progress-heatmap
title: Today by hour
bars: Questions answered
unit: hour
cells: 24
```
````

````
```progress-heatmap
title: Mastered per week
bars: Mastered
unit: week
cells: 26
```
````

---

## How history is recorded

- Each time a note with a progress block is saved, the plugin compares each bar's value with the last value it recorded. It saves the difference with a timestamp in the plugin's `data.json`.
- **The first time the plugin sees a bar, it only records the current value.** Nothing is logged, so a bar that already reads 500/1000 doesn't count as 500 done today. Heat maps fill in from that point on.
- **Recurring bars use this log to find the current period.** A `count: reset` bar uses the time the number last changed to decide whether the number belongs to this period. A `count: running` bar shows the total of the changes logged during the current period.
- The plugin also stores when each bar's number last changed (`lastT` in `data.json`). History saved before that was added falls back to the bar's newest logged change.
- Changes made while Obsidian was closed (for example, arriving through sync) are logged the next time Obsidian starts.
- History is stored under the bar's **id** (the title unless you set `id:`). If you rename a bar without an `id:` line, it starts a fresh history. Give a bar an `id:` line if you might rename it.
- Two bars must not share an id. If they do, the bar shows a warning.
- `data.json` is gitignored, so history stays on this device and isn't in version control.

---

## Settings

| Setting | What it does |
|---|---|
| Default on-track window | The blue band for bars without a `window:` line |
| Default digits | Minimum digits in a bar's fraction (4 → `0050/0100`, 0 = no padding), for bars without a `digits:` line |
| Show titles in the status bar | Show or hide bar titles next to the status-bar bars |
| Status bar | Pin, unpin and reorder bars |

## Commands

- **Choose status-bar progress bars**: pin or unpin a bar.
- **Rescan progress bars**: re-read every note if a bar is missing from the list.

---

## Development

```sh
cd .obsidian/plugins/progress-keeper
npm test          # vitest: parsing, schedule colours, history buckets
npm run build     # type-check + bundle → main.js (commit main.js)
npm run dev       # watch mode
```

| File | Role |
|---|---|
| `src/parse.ts` | Parses `progress` / `progress-heatmap` blocks and dates |
| `src/schedule.ts` | Recurring periods, expected value, ahead/behind/on-track, summary line |
| `src/history.ts` | Change log, recurring-bar resets, period sums, grouping into hour/day/week/month boxes |
| `src/registry.ts` | Finds every bar in the vault (reads only notes that have code blocks) |
| `src/render.ts` | Bar, status-bar item and heat-map DOM |
| `src/settings.ts` | Settings tab |
| `src/main.ts` | Connects everything to Obsidian |
| `styles.css` | All styling, using only the active theme's CSS variables |
