# MCQ activity

Progress bars fed by the MCQ scheduler. Edit any goal, date or layout here — the plugin
wrote this note once and never rewrites it. See [[Progress bars]] for every option.

## Today

```progress
Questions answered: 60
source: mcq-solved
every: 1 day
id: daily-questions
```

```progress
Time spent (mins): 60
source: mcq-time
every: 1 day
id: daily-time
```

## Modules

```progress
Modules completed: auto
source: modules-completed
start: 2026:10:30:00:00
deadline: 2026:12:01:23:59
id: modules-completed
```

## Totals

```progress
MCQs solved: auto
source: mcq-solved
id: mcqs-solved
```

```progress
Time spent, total (mins): 6000
source: mcq-time
id: minutes-total
```

## Activity

```progress-heatmap
title: MCQs, daily
bars: daily-questions
unit: day
cells: 120
```

```progress-heatmap
title: Minutes, daily
bars: daily-time
unit: day
cells: 120
```

```progress-heatmap
title: Modules completed, weekly
bars: modules-completed
unit: week
cells: 26
```
