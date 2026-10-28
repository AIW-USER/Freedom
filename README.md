# MCQ module syntax

The **Modules** mode of the MCQ scheduler builds its schedule from one note: `Question Modules.md` at the vault root. You can change which note in **Settings → MCQ scheduler → Modules file**. This page describes how that note must be written so the plugin can read it. For the syntax of the questions themselves, see [[MCQ syntax]].

## Worked example

```markdown
# OB Concept Modules

Free text here is ignored, and so are links like [[#Trauma]].

## Trauma

*Any line that is not a heading or a module line is ignored.*

### [[acl-tear|ACL Tear]] (OB 3 · TO 1)
- **Graft choice & tunnel placement** (OB 2 · TO 1): [[OB1]], [[OB2]], [[TO17099138]]
- **Return to sport**: [[OB3]]

### Other Knee Topics (OB 1)
- **Miscellaneous** (OB 1): [[OB4]]
```

This gives three modules, in this order:

| Module key | Section | Topic | Questions |
|---|---|---|---|
| `acl-tear::Graft choice & tunnel placement` | Trauma | ACL Tear | OB1, OB2, TO17099138 |
| `acl-tear::Return to sport` | Trauma | ACL Tear | OB3 |
| `Other Knee Topics::Miscellaneous` | Trauma | Other Knee Topics | OB4 |

## The three kinds of line

The plugin reads only these three kinds of line. Everything else is ignored.

**1. Section heading.** Starts with `## `, as in `## Trauma`. It groups the topics under it. The text is free and is only used for display.

**2. Topic heading.** Starts with `### `, and has one of these forms:

| Form | Example | Topic id | Label shown |
|---|---|---|---|
| Link with a display name | `### [[acl-tear\|ACL Tear]] (OB 3)` | `acl-tear` | ACL Tear |
| Link without a display name | `### [[acl-tear]]` | `acl-tear` | acl-tear |
| Plain text | `### Other Knee Topics (OB 1)` | `Other Knee Topics` | Other Knee Topics |

The count in brackets after the heading is optional and is ignored. Link to the Orthobullets note for the topic where one exists.

**3. Module line.** A list item under a topic heading:

```
- **Module name** (optional counts): [[ID]], [[ID]], …
```

- Start the line with `- ` (or `* `), then the module name in `**bold**`.
- The counts in brackets, such as `(OB 2 · TO 1)`, are optional and ignored. The plugin counts the questions itself.
- After the colon, list the questions as wikilinks to the question notes, `[[OB505]]`, separated by commas. The id is the question's file name in `MCQ/`, without `.md`.
- A module line that comes before any `###` topic heading is ignored.

## How the plugin identifies a module

A module's identity, its **key**, is `topic id::module name`. The key is what the schedule remembers: the module's score, attempts and completed status.

| You change… | What happens |
|---|---|
| The questions listed on a module line | Nothing breaks. New ids count as unseen, so the module's next visits ask them first. |
| The order of modules or topics in the file | Nothing breaks. The schedule's order is kept separately, and you edit it in the Queue tab. |
| The counts in brackets, or text between modules | Nothing. These are ignored. |
| A section heading | Nothing. The section is only used for display. |
| **A module's name** | It becomes a **new** module. The old record is kept hidden, and comes back if you restore the name. |
| **The topic heading it sits under** (its link or text) | Every module under it becomes new, for the same reason. |

**So:** fix typos in module names before you start solving them, or accept that a renamed module starts again from zero.

Two modules with the same name under the same topic would have the same key. Give every module a unique name within its topic.

## Adding modules and questions

1. **New questions:** write them in `MCQ/` in [[MCQ syntax]], then press **Rebuild index** (↻ in the pane).
2. **Add them to a module:** list their ids on an existing module line, or add a new module line under the right topic.
3. **Open the Modules mode.** Any module the schedule hasn't seen shows in a banner: *"N new modules… Place them: Next up · End of queue · In file order · After…"*. Nothing is scheduled until you choose.

Questions listed in the file but not yet in the index are skipped. A module with no indexed questions doesn't appear in the schedule until it has some.

## What the plugin does with a module

This is summarised here so the syntax makes sense. The detail lives in CLAUDE.md.

- **A module is one spaced-repetition card.** Each visit asks **one** of its questions, and you rate the visit Skip, Hard, Good or Easy.
- **Each visit asks a different question:** the unseen TO questions first, then the unseen OB questions, then any the source never answered. Once every question has been seen, a visit asks the module's weakest question (lowest last rating).
- **Order:** new modules come from the head of the queue, 20 a day, spread among the day's reviews.
- **Completion:** a module is completed (*mature*) once every question has been seen and its interval has reached 21 days.

## Rules checked by the tests

`test/modules.test.ts` reads the real `Question Modules.md` and checks that:
- every module key is unique
- every module has at least one question and a section
- every listed id exists in `MCQ/`
- the bank is covered exactly once

That last check means that when you add questions to `MCQ/`, you should also list each one in exactly one module. Otherwise update the counts in that test (2,981 modules and 12,528 questions).

`test/syntax.test.ts` parses the worked example above, so this page and the plugin can't drift apart.

# MCQ scheduler

**MCQ scheduler** is the plugin that turns this vault's question bank into a study tool. It lives in a side pane and lets you:

- **browse** the 12,528 questions by section and topic, and answer them with instant right/wrong feedback;
- **study by module**, with Anki-style spaced repetition: one question per module, rated Skip · Hard · Good · Easy;
- **track your progress**, with daily goals, a deadline for finishing the modules, heat maps and bars in the status bar.

The answers stay hidden in the note until you commit to an option. The plugin never changes your question notes.

This page is the overview. The exact syntax of each file is in its own note:

| Note | What it defines |
|---|---|
| [[MCQ syntax]] | How a question note is written |
| [[MCQ module syntax]] | How `Question Modules.md` groups questions into modules |
| [[Progress bars]] | Every option of the `progress` and `progress-heatmap` blocks |

---

## Getting started

1. Open the pane with the **list-checks** ribbon icon, or the command **MCQ scheduler: Open browser**.
2. Pick **Browse** or **Modules** at the top of the pane.
3. To track your progress, go to **Settings → MCQ scheduler → Activity** and press **Start monitoring**. This creates [[MCQ activity]] at the vault root. Nothing is counted until you do this.

---

## The pane

```
┌──────────────────────────────┐
│  [ Browse ] [ Modules ]      │  ← mode
│  All › Trauma › ACL Tear     │  ← where you are (click to go back)
│  [Search…] [This level] [↻]  │  ← search, scope, rebuild index
├──────────────────────────────┤
│  list: sections / topics /   │
│  questions / modules         │
├──────────────────────────────┤
│  1  Femoral tunnel posterior │
│  2  Femoral tunnel anterior  │  ← options for the open question
│  …                           │
│  Correct                     │
│  [◂ Previous] [Skip] [Next ▸]   00:42/01:15 │  ← Browse
│  [Skip] [Hard] [Good] [Easy]                │  ← Modules
│   10m     6m    10m    4d                   │
└──────────────────────────────┘
```

### Browse

Work down **Sections → Topics → Questions**. Click a question and its note opens in the main editor. You read the stem and images there, and answer in the pane.

- **Search** filters the list you're looking at. Switch **This level** to **All questions** to search the whole bank by id, topic or section.
- The breadcrumb takes you back up, and so does **Esc**.

### Answering a question

- **Pick an option.** It's marked green if right and red if wrong, and the correct option is always marked. The **Answer explanation** and **Illustrations** appear in the note straight away. Use the collapse arrows in the note to open or close them.
- **Skip** shows the answer without choosing.
- **Previous / Next** (Browse only) move through the topic. Moving on hides the last question's answer again, so a question you come back to still tests you. In Modules mode the rating buttons move you on instead (see below).
- **The clock** shows `answer time / time on question`. The first half stops when you answer. The second keeps running while you read. Both reset when you open another question.

**Keyboard shortcuts** (click in the pane first):

| Key | Does |
|---|---|
| `1`–`5` | Choose that option |
| `s` | Skip (in Modules: show the answer, then press again to rate Skip) |
| `h` · `g` or Space · `e` | Modules: rate Hard · Good · Easy |
| `c` | Modules: Stop (pause) / Continue |
| `n` or `→` | Next (Browse) |
| `p` or `←` | Previous (Browse) |
| `Esc` | Go up a level, or back to the Modules home |

### What hiding does

In **reading view**, a question note hides **Options** and **Correct option** at all times, and hides **Answer explanation** and **Illustrations** until you answer in the pane. **Source mode** (Ctrl/Cmd+E) always shows the whole file. The hiding happens only on screen; the file never changes.

---

## Modules: spaced repetition

`Question Modules.md` groups every question into **2,981 concept modules**, such as *"Letournel classification & fracture pattern recognition"*. The **Modules** mode schedules them for you.

It works like **Anki**, with the module as the card.

### First time

Open **Modules** and press **Create schedule**. Every module is queued in file order, none introduced yet.

### Studying

Press **Study** on the *Today* card. You get **one question from one module**:

1. Before you answer, only **Skip** is active. Pressing it shows the answer and explanation without choosing.
2. Choose an option (or Skip). The answer is revealed, and all four buttons light up. You may rate freely, even after a wrong answer.
3. Press **Skip · Hard · Good · Easy**. Under each button is the wait it would schedule. The module is scheduled, and the **next module's question opens at once**: module X → rating → module Y → rating → …

**Stop and Continue.** **⏸ Stop**, beside the clock, pauses the question:
- the clock freezes, and the paused time isn't counted as study time;
- the options and ratings lock;
- the buttons become **▶ Continue**, which carries on with the same question exactly as it was, and **End session**, which goes back to the Modules home.

The key `c` toggles Stop and Continue.

If you end the session, close the pane, or leave mid-question, the *Today* card shows **Continue**, with your choice kept.

### How the waits are worked out (Anki's SM-2 defaults)

| | Skip | Hard | Good | Easy |
|---|---|---|---|---|
| **New / learning** (steps 1 m, 10 m) | back to 1 m | repeat the step (first step: 6 m) | next step; after 10 m → 1 day | straight to 4 days |
| **Review** | lapse: ease −20, relearn in 10 m, then 1 day | interval × 1.2, ease −15 | interval × ease | interval × ease × 1.3, ease +15 |

Ease starts at 250% and never goes below 130%. A learning module comes back the same day **with a different question**.

### Which module comes next

1. A learning module that is due now.
2. Reviews due today and new modules, with the new ones spread evenly among the reviews. **New modules per day** (20) and **Maximum reviews per day** (200) cap them. New modules come from the head of the **Queue**.
3. A learning module due within 20 minutes.
4. Otherwise, **Done for today**. The card says when the next learning module is due, and offers **Start tomorrow's modules**: the schedule then acts as tomorrow, with tomorrow's reviews and a fresh 20 new modules. You can press it again later on. When the real date catches up, things carry on normally.

A study day starts at **4:00** (a setting), so studying past midnight still counts as the day before.

### Which question a module asks

1. Unseen **TO** questions, in random order.
2. Unseen **OB** questions, in random order.
3. Unseen questions the source never answered (you rate those yourself).
4. Once all have been seen, the **weakest**: lowest last rating, then lowest average rating, then longest since seen. Never the same question twice in a row while there is another.

### Completed modules

A module is **completed** (*mature*) when every question in it has been seen and its interval is **21 days or more**. It stays scheduled, with long gaps. The **Modules completed** bar in [[MCQ activity]] counts these.

### Editing the schedule

The home screen has three tabs:

| Tab | Shows | Actions |
|---|---|---|
| **Queue** | modules not yet introduced, in order | ⤒ top · ↑ up · ↓ down · ⤓ bottom · ▶ study now |
| **Learning** | introduced modules, soonest due first, with due · interval · ease · questions seen | ▶ study now · ↺ reset (back to the queue) |
| **Completed** | mature modules | ↺ un-complete (back to the queue) |

The search box filters the tab you're on. **Study now** serves that module straight away. A queued one counts as one of today's new modules.

### Adding questions and modules

1. Write new questions in `MCQ/` ([[MCQ syntax]]), then press **↻** (Rebuild index).
2. Add their ids to a module line in `Question Modules.md`, or add a new module line ([[MCQ module syntax]]).
3. **New ids on an existing module:** nothing more to do. They count as unseen, so the module's next visits ask them first.
4. **A new module line:** a banner in Modules asks where to put it: **Next up**, **End of queue**, **In file order** or **After…**.

The schedule remembers each module by *topic + module name*. Renaming a module, or the topic heading above it, makes it a new module that starts from zero.

---

## Progress and activity

### Monitoring

**Start monitoring** (in Settings → Activity, or the command palette) begins counting three things:

| Source | Counts |
|---|---|
| `mcq-solved` | each question you answer (Skip doesn't count) |
| `mcq-time` | the question clock's total, at most 15 minutes per question |
| `modules-completed` | +1 when a module completes, −1 if you reset a completed one |

It also creates **[[MCQ activity]]** at the vault root, once, from a template:

- **Today:** questions answered (goal 100 a day) and minutes spent (goal 60 a day). Both empty at midnight.
- **Modules:** modules completed out of 2,981, running from a start date to a deadline, coloured ahead / on track / behind.
- **Overall:** a manual bar that you update by typing the number.
- **Totals:** all-time questions and minutes.
- **Activity:** heat maps of questions per day, minutes per day and modules per week.

The plugin never rewrites this note. Change any goal, `start:` or `deadline:`, or rearrange it, and the bars follow.

**Sunday relief** (Settings → Progress bars) lowers every daily goal on Sundays by a percentage you set. At 50%, 100 questions become 50; at 100%, Sunday is a rest day. A bar's own `sunday: 30%` line overrides it. See [[Progress bars#Sunday relief]].

### Progress bars anywhere

`progress` and `progress-heatmap` code blocks work in any note:

````
```progress
Questions answered: 100
source: mcq-solved
every: 1 day
id: daily-questions
```
````

- **With `source:`**, the scheduler supplies the number. On a recurring bar that's this period's amount; on a fixed bar it's the total since `start`.
- **Without `source:`**, you type the number: `Progress: 045/100`.
- **Colours:** **green** means ahead of schedule, **blue** on track and **red** behind. A thin marker shows where you should be now.

The full options are in [[Progress bars]].

### Status bar

Pin any bar to the bottom bar, next to backlinks and word count:
- **Settings → MCQ scheduler → Status bar:** a toggle for each bar, with ↑/↓ to reorder.
- **Or** the command **Choose status-bar progress bars**.

### Reset

**Reset activity…** (Settings → Activity, or the command palette) clears all questions answered and minutes spent, heat maps included, after you confirm. Modules completed come from the module schedule and are kept.

---

## Commands

| Command | Does |
|---|---|
| Open browser | Opens the pane |
| Reveal the answer in the open note | Shows the explanation without answering |
| Start monitoring (create the MCQ activity note) | Starts counting and creates [[MCQ activity]] (or recreates it if deleted) |
| Open the MCQ activity note | Opens it |
| Reset activity… | Clears questions and minutes, after you confirm |
| Rebuild the index | Re-reads the bank and names any note that breaks [[MCQ syntax]] |
| Choose status-bar progress bars | Pins or unpins a bar |
| Rescan progress bars | Re-reads every note for `progress` blocks |

## Settings

| Section | Setting | What it does |
|---|---|---|
| General | MCQ folder | Where the question notes live (`MCQ`) |
| Reading view | Hide answers in reading view | The hiding described above; off shows every note in full |
| Answering | Open the note when a question is selected | Opens each question's note automatically |
| | Option size | Size of the option buttons, 80–200% |
| | Maximum search results | How many rows a search shows |
| Activity | MCQs solved · Time spent · Modules completed | Totals and today |
| | Monitoring | Start monitoring, recreate the note, or open it |
| | Reset activity | Clears questions and minutes (after you confirm) |
| Progress bars | Default on-track window | The blue band, in percentage points (5) |
| | Default digits | Padding in a bar's numbers: 4 shows `0050/0100` |
| | Show titles in the status bar | Titles next to the status-bar bars |
| | Sunday relief · Sunday relief (%) | Lower daily goals on Sundays by this percentage (100 = rest day) |
| | Status bar | Pin, unpin and order bars |
| Modules | Modules file | The modules note (`Question Modules.md`) |
| | New modules per day | New modules introduced each study day (20) |
| | Maximum reviews per day | Reviews beyond this wait for the next day (200) |
| | Next day starts at (hour) | When a new study day begins (4) |
| | Delete the module schedule | Forgets every module's progress so you can create it afresh (press twice) |
| Maintenance | Rebuild the index | Same as ↻ in the pane |

---

## Where things are stored

| What | Where | Notes |
|---|---|---|
| Questions | `MCQ/*.md` | Never changed by the plugin |
| Modules | `Question Modules.md` | Yours to edit |
| Activity note | `MCQ activity.md` | Written once, then yours |
| Settings | plugin folder `data.json` | |
| Module schedule | plugin folder `schedule.json` | Each module's interval, ease and question history, the queue, the question on screen |
| Every answer in a module | plugin folder `responses.jsonl` | One line per answer with its rating, never rewritten |
| Activity history | plugin folder `progress.json` | Feeds the bars and heat maps |

The plugin folder is `.obsidian/plugins/mcq-scheduler/`. The only file the plugin ever creates in your notes is **MCQ activity.md**, and only when you press Start monitoring.

## Troubleshooting

- **A new question doesn't appear.** Press **↻**. The notice names any note that breaks [[MCQ syntax]], with the reason.
- **A new module doesn't appear.** Check its line follows [[MCQ module syntax]], then look for the placement banner in **Modules**.
- **Bars read 0.** Monitoring may be off: see **Settings → Activity → Monitoring**.
- **A `progress` block shows an error.** The message says which line is wrong. See [[Progress bars]].
- **The old Progress Keeper plugin** must stay disabled, because both plugins use the `progress` block.

# Progress bars

Progress bars written as text in your notes, drawn by the **MCQ scheduler** plugin (it absorbed the old Progress Keeper plugin). A bar is either **fixed** (one run from a start to a deadline) or **recurring** (a goal that repeats every day, week or any period you choose). Its colour shows whether you're ahead or behind schedule. You can pin bars to the status bar, and heat maps show how much you did over time.

A bar's number comes from one of two places:

- **The scheduler**, with a `source:` line: questions answered, minutes spent and modules completed update by themselves as you work in the MCQ pane. See [Bars fed by the scheduler](#bars-fed-by-the-scheduler).
- **You**, for anything else: edit the number in the note and the bar follows.

[[MCQ activity]] at the vault root is a ready-made note of scheduler bars and heat maps. It is created once by **Start monitoring** (in Settings → MCQ scheduler → Activity, or the command palette) and never rewritten, so change its goals, dates and layout freely.

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
source: mcq-solved             ← optional: the scheduler supplies the number (see below)
sunday: 50%                    ← daily bars only: this bar's Sunday relief (see below)
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

## Bars fed by the scheduler

Add a `source:` line and the bar takes its number from the MCQ scheduler instead of from the note:

| `source:` | Counts | Added when |
|---|---|---|
| `mcq-solved` | questions answered | you pick an option in the MCQ pane (Browse or Modules). **Skip** doesn't count |
| `mcq-time` | minutes spent | you answer or leave a question: the question clock's total, at most 15 minutes per question |
| `modules-completed` | modules completed | a module becoming mature — every question seen, interval ≥ 21 days (+1); resetting a completed module takes it back off (−1) |

The first line can then be just `Title: total`, because there is no number to type. `Title: value/total` also works; the value is ignored.

- **Recurring** (`every:`): the bar shows how much was added **this period**. `Questions answered: 100` with `every: 1 day` is a daily goal of 100 that empties at midnight.
- **Fixed with `start:` and `deadline:`**: the bar shows everything added **since `start`**, coloured against the deadline. Change either date and the bar re-colours at once.
- **Fixed without dates**: the bar shows the all-time total.

````
```progress
Questions answered: 100
source: mcq-solved
every: 1 day
id: daily-questions
```
````

````
```progress
Modules completed: 2981
source: modules-completed
start: 2026:09:01:00:00
deadline: 2026:12:31:23:59
id: modules-completed
```
````

Heat maps show scheduler bars like any other: `bars: daily-questions, daily-time`. Two bars with the same `source:` share one history, so a daily bar and a total bar never double-count.

**Settings → MCQ scheduler → Activity** shows the same totals and has **Reset activity…** (also in the command palette), which clears the questions and minutes history after you confirm. Nothing is counted until you press **Start monitoring**.

### Sunday relief

To ask less of yourself on Sundays, turn on **Sunday relief** in **Settings → MCQ scheduler → Progress bars** and set **Sunday relief (%)**:

- It applies to every **daily** bar (`every: 1 day`), typed or scheduler-fed. Weekly, monthly, hourly and fixed bars are unchanged.
- On Sunday the goal is lowered by that percentage, rounded up: at 50%, `100` becomes `50` and `60` becomes `30`. At **100%** Sunday is a rest day, and the bar reads *Rest day*.
- The bar shows the lower goal, with a line such as *"Sunday relief −50%: goal 50 instead of 100"*. The colour, the expected-now marker and "N to go" all use the lower goal, and so does the status bar.
- A bar with its own start time, such as `start: 2026:09:01:05:00`, has its Sunday from Sunday 05:00 to Monday 05:00.
- A bar's own `sunday: 30%` line overrides the setting, even when the toggle is off. `sunday: 0` exempts that bar.
- Heat maps are unchanged: they count what you actually did.

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
| `sunday: 50%` | Daily bars only: lower the goal by this much on Sundays, overriding the setting. `0` turns relief off for this bar | the setting |

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

- **Settings → MCQ scheduler → Status bar.** Every bar in the vault is listed. Turn the toggle on to pin a bar, and use the ↑/↓ arrows to change the order (left to right).
- **Command palette → "MCQ scheduler: Choose status-bar progress bars".** Pick a bar to pin or unpin it. Pinned bars are marked ✓.

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

- **Bars you type.** Each time a note with a progress block is saved, the plugin compares each bar's value with the last value it recorded, and saves the difference with a timestamp.
- **The first time the plugin sees a typed bar, it only records the current value.** Nothing is logged, so a bar that already reads 500/1000 doesn't count as 500 done today. Heat maps fill in from that point on.
- **Scheduler bars** are logged as you work, merged into at most one entry per source per hour.
- Recurring typed bars use this log to find the current period: a `count: reset` bar uses the time the number last changed; a `count: running` bar shows the total of the changes logged during the current period.
- Changes made while Obsidian was closed (for example, arriving through sync) are logged the next time Obsidian starts.
- History is stored under the bar's **id** (the title unless you set `id:`); scheduler bars under their source. If you rename a typed bar without an `id:` line, it starts a fresh history. Give a bar an `id:` line if you might rename it.
- Two bars must not share an id. If they do, the bar shows a warning.
- The history lives in `progress.json` in the plugin folder, not in your notes.

---

## Settings

In **Settings → MCQ scheduler → Progress bars**:

| Setting | What it does |
|---|---|
| Default on-track window | The blue band for bars without a `window:` line |
| Default digits | Minimum digits in a bar's fraction (4 → `0050/0100`, 0 = no padding), for bars without a `digits:` line |
| Show titles in the status bar | Show or hide bar titles next to the status-bar bars |
| Sunday relief | Lower daily goals on Sundays |
| Sunday relief (%) | How much lower: 50 halves the goal, 100 makes Sunday a rest day |
| Status bar | Pin, unpin and reorder bars |

## Commands

- **Choose status-bar progress bars**: pin or unpin a bar.
- **Rescan progress bars**: re-read every note if a bar is missing from the list.
