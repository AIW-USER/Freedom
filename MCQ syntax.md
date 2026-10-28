# MCQ syntax

Every question in `MCQ/` is one note written in the syntax below. The MCQ scheduler plugin reads only this syntax. A note that departs from it is named when you press **Rebuild index**, with the reason.

To group questions into study modules for the scheduler's **Modules** mode, see [[MCQ module syntax]].

## Adding a question

1. Create a note in `MCQ/`. Its file name is its id, for example `MY001.md`. Any id works, but keep a common prefix per source so the questions sort together.
2. Copy the template below and fill it in.
3. Put images in `MCQ/attachments/` and embed them with `![[file.png]]`.
4. Press **Rebuild index**, using the ↻ button in the MCQ pane or the button in the plugin's settings. The notice gives the question count and names any note that doesn't follow this syntax.

## Worked example

```markdown
# MY001

#MY #kneesports #acltear
Topic: [[acl-tear]]
Exam: Mock exam 2026 | Question 1
Source: https://www.orthobullets.com/knee-and-sports/3008/acl-tear
Chapter: Sports Medicine MCQs — ACL Tear

## Question

During ACL reconstruction, a graft that is tight in flexion but lax in extension is most likely due to which error?

![[my001-question.png]]

## Options

1. Femoral tunnel too posterior
2. Femoral tunnel too anterior
3. Tibial tunnel too anterior
4. Tibial tunnel too medial

## Correct option

**2. Femoral tunnel too anterior**

## Answer explanation

An anterior femoral tunnel tightens the graft in flexion because of the cam effect of the femoral condyle.

Answer: 2

## Illustrations

![[my001-illustration.png]]
*Illustration A*
```

## The rules, line by line

**Title.** Line 1 is `# <id>`, which must equal the file name without `.md`.

**Tag line.** This is one line of tags, in this order:

| Position | Tag | Notes |
|---|---|---|
| 1st | source | `#OB` (Orthobullets), `#TO`, or a new code of 2–5 letters, such as `#MY`. It shows as the badge in the question list. |
| 2nd | section | One of the ten below. Case doesn't matter. |
| 3rd | topic | An Orthobullets topic tag, such as `#acltear`. |
| after | extras | Optional. `#AAOS` marks AAOS questions. |

Sections: `#basics` `#footankle` `#hand` `#kneesports` `#pathology` `#pediatrics` `#recon` `#shoulderelbow` `#spine` `#trauma`

To find the topic tag, open any existing question on that topic and copy its third tag. Topics are the 761 Orthobullets topics. A new tag works, but it will appear as a new topic under its raw tag name.

**Fields.** These are optional, go under the tag line, and must come before `## Question`. They are the only lines allowed there:

| Field | Meaning |
|---|---|
| `Topic: [[slug]]` | Link to the note in `Orthobullets/` for this topic. |
| `Exam: …` | Which exam or test the question came from. |
| `Source: <url>` | Web address of the original question. |
| `Chapter: …` | Book or chapter the question came from. |

**Sections of the note.** Use exactly these `##` headings, in this order:

| Heading | Required | Contents |
|---|---|---|
| `## Question` | yes | The stem. Images go inline here. |
| `## Options` | yes | 2–5 lines, `1. text`, `2. text` … numbered from 1 with no gaps. |
| `## Correct option` | yes | One line, `**N. text**`, copying the option exactly. Write `Not provided by the source.` if the answer is unknown. |
| `## Answer explanation` | yes | Free markdown. It may end with `Answer: N`. |
| `## Illustrations` | no | Images with captions. |

**Keep it plain.** Don't wrap answers in callouts (`> [!success]-`). The plugin hides the options, the correct option, the explanation and the illustrations in reading view by itself, and shows the explanation and illustrations once you answer. Source mode always shows the whole note.
