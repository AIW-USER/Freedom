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
| The questions listed on a module line | Nothing breaks. The next session picks from the new list. |
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

- **Each session asks** every TO question in the module, plus 40% of its OB questions (rounded up, at least one). A question whose source never recorded an answer is left out.
- **Scoring:** a right answer scores +1, **Skip** 0 and a wrong answer −1. The module's score is the session average.
- **Order:** three new modules, then one repeat of the lowest-scoring module that has waited long enough.
- **Completion:** three perfect (+1) sessions complete a module.

## Rules checked by the tests

`test/modules.test.ts` reads the real `Question Modules.md` and checks that:
- every module key is unique
- every module has at least one question and a section
- every listed id exists in `MCQ/`
- the bank is covered exactly once

That last check means that when you add questions to `MCQ/`, you should also list each one in exactly one module. Otherwise update the counts in that test (2,981 modules and 12,528 questions).

`test/syntax.test.ts` parses the worked example above, so this page and the plugin can't drift apart.
