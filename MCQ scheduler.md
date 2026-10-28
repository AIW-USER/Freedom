# MCQ scheduler

**MCQ scheduler** is the plugin that turns this vault's question bank into a study tool. It lives in a side pane and lets you:

- **browse** the 12,528 questions by section and topic, and answer them with instant right/wrong feedback;
- **study by module**, with spaced repetition that brings back the concepts you get wrong;
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
│  [◂ Previous] [Skip] [Next ▸]   00:42/01:15 │
└──────────────────────────────┘
```

### Browse

Work down **Sections → Topics → Questions**. Click a question and its note opens in the main editor. You read the stem and images there, and answer in the pane.

- **Search** filters the list you're looking at. Switch **This level** to **All questions** to search the whole bank by id, topic or section.
- The breadcrumb takes you back up, and so does **Esc**.

### Answering a question

- **Pick an option.** It's marked green if right and red if wrong, and the correct option is always marked. The **Answer explanation** and **Illustrations** appear in the note straight away. Use the collapse arrows in the note to open or close them.
- **Skip** shows the answer without choosing. In a module it scores 0.
- **Previous / Next** move through the topic, or through the module's questions. Moving on hides the last question's answer again, so a question you come back to still tests you.
- **The clock** shows `answer time / time on question`. The first half stops when you answer. The second keeps running while you read. Both reset when you open another question.

**Keyboard shortcuts** (click in the pane first):

| Key | Does |
|---|---|
| `1`–`5` | Choose that option |
| `s` | Skip |
| `n` or `→` | Next |
| `p` or `←` | Previous |
| `Esc` | Go up a level, or back to the Modules home |

### What hiding does

In **reading view**, a question note hides **Options** and **Correct option** at all times, and hides **Answer explanation** and **Illustrations** until you answer in the pane. **Source mode** (Ctrl/Cmd+E) always shows the whole file. The hiding happens only on screen; the file never changes.

---

## Modules: spaced repetition

`Question Modules.md` groups every question into **2,981 concept modules**, such as *"Letournel classification & fracture pattern recognition"*. The **Modules** mode schedules them for you.

### First time

Open **Modules** and press **Create schedule**. Every module is queued in file order, from the first module to the last, all at score 0 and 0 attempts.

### A session

Press **Start** on the *Up next* card. A session asks:

- **every TO question** in the module, and
- **40% of its OB questions** (rounded up, at least one). Questions you weren't asked last time come first.

Each answer scores **+1** if right, **0** if skipped and **−1** if wrong. When the last question has an answer, **Next** becomes **Finish**, and you see the module's score: the average, from −1 to +1. Then choose **Next module** or **Back**.

If you leave halfway, the home screen shows **Resume** with your answers kept.

### What comes next

- **Three new modules, then one repeat.** The repeat is the lowest-scoring module you've solved (ties go to fewer attempts, then the longest wait).
- **A module comes back after a gap** of `2 + 2 × attempts × (score + 1)` other modules. A module you scored −1 on returns after 2. One you scored +1 on twice waits 10. At the very start, until a first module has waited its gap, you may see up to 7 new modules in a row. After that it's 3 new to 1 repeat.
- **Three perfect (+1) sessions**, in any order, **complete** a module. It then leaves the repeats.

### Editing the schedule

The home screen has three tabs:

| Tab | Shows | Actions |
|---|---|---|
| **Queue** | modules not yet solved, in serving order | ⤒ top · ↑ up · ↓ down · ⤓ bottom · ▶ start now |
| **Solved** | solved modules, worst score first, with score · attempts · ★ perfect sessions | ▶ start now · ↺ reset |
| **Completed** | completed modules | ↺ reset (un-complete) |

The search box filters the tab you're on. A module started out of turn is scored the same way, but it doesn't use up a new or repeat slot.

### Adding questions and modules

1. Write new questions in `MCQ/` ([[MCQ syntax]]), then press **↻** (Rebuild index).
2. Add their ids to a module line in `Question Modules.md`, or add a new module line ([[MCQ module syntax]]).
3. **New ids on an existing module:** nothing more to do. The next session can pick them.
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
| Module schedule | plugin folder `schedule.json` | Scores, attempts, queue, the unfinished session |
| Every answer in a module | plugin folder `responses.jsonl` | One line per answer, never rewritten |
| Activity history | plugin folder `progress.json` | Feeds the bars and heat maps |

The plugin folder is `.obsidian/plugins/mcq-scheduler/`. The only file the plugin ever creates in your notes is **MCQ activity.md**, and only when you press Start monitoring.

## Troubleshooting

- **A new question doesn't appear.** Press **↻**. The notice names any note that breaks [[MCQ syntax]], with the reason.
- **A new module doesn't appear.** Check its line follows [[MCQ module syntax]], then look for the placement banner in **Modules**.
- **Bars read 0.** Monitoring may be off: see **Settings → Activity → Monitoring**.
- **A `progress` block shows an error.** The message says which line is wrong. See [[Progress bars]].
- **The old Progress Keeper plugin** must stay disabled, because both plugins use the `progress` block.
