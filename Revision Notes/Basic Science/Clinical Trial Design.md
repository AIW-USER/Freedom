# Clinical Trial Design

*Basic Science · 25 / 108*

## 1 Basics

### Observational vs experimental

```
Clinical study
├─ Observational (no allocation) → DESCRIPTIVE or ANALYTIC
│      ├─ Descriptive → CASE REPORT · CASE SERIES · CROSS-SECTIONAL
│      └─ Analytic → CASE-CONTROL · COHORT · META-ANALYSIS
└─ Experimental (researcher allocates) → RCT
       └─ Double-blind prospective RCT → GOLD STANDARD
```

**Internal validity** — methodological rigour (↓ bias, confounding) · **external validity** — generalisability · homogeneous, tightly controlled populations ↑ internal, ↓ external

### Study types (case-control, cohort, parallel, factorial, RCT)

| Design | Definition | Level | Measure |
|---|---|---|---|
| **RCT** | Random assignment to treatment/control, followed prospectively | **I** | — · **best for causality** |
| **Prospective cohort** | Groups separated **non-randomly by exposure**, exposure **after** study start | **II** | **Relative risk**, incidence |
| **Retrospective cohort** | Exposure **before** study start | **III** | Relative risk |
| **Case-control** | Groups by **presence (cases) / absence (controls) of disease** → look back for exposure · always retrospective | **III** (most) | **Odds ratio** |
| **Case series** | Retrospective, same injury/treatment, **no control** · generates hypotheses | **IV** | — |
| **Cross-sectional** | **Snapshot** at one time, no follow-up (e.g. prevalence) | — | Prevalence |
| **Meta-analysis** | Systematic review pooling studies · **↑ power of under-powered studies** | Level of included studies | — |
| Case report / expert opinion | — | **V** | — |

**RCT with 70% follow-up** — downgraded to **Level II** (<80% follow-up)

### RCT designs

| Design | Allocation |
|---|---|
| **Parallel** | Each group gets one intervention (commonest RCT) · e.g. bisphosphonate vs placebo |
| **Crossover** | Each participant gets **both therapies sequentially** in random order · needs adequate **washout** |
| **Factorial** | Groups get **A + B, A, B or neither** → tests interaction |
| **Cluster** | **Pre-existing groups** (schools, villages) randomised |

![Study types](../../Orthobullets/attachments/ob9080-study-types.jpg)

## 2 Mechanism

### Randomisation & selection bias

**Purpose of computer randomisation** — ✓ **prevent selection bias** (unbiased placement into groups)\
✗ Wrong options: ↑ power · ↑ treatment effect · significance · prevent crossover

**Sealed opaque envelopes / allocation concealment** — minimise **selection bias** (recruiters can't predict next allocation)

**Randomisation also** — distributes **confounders** (known + unknown) evenly → ✓ **best reduces confounding** · facilitates blinding · allows probability theory

**Confounders** — external factors affecting both predictor and outcome · controlled by randomisation, stratification, multivariable regression

### Blinding & other biases

**Single-blind** — **patients** unaware, surgeon delivers + assesses (experimenter bias remains)

**Double-blind** — patient + doctor/assessor unaware

**Blinding the outcome assessor** — ✓ **↓ reported treatment effect** (unblinded assessors inflate effect — Poolman, 32 RCTs)

| Bias | Definition |
|---|---|
| **Selection** | Dissimilar groups / non-random enrolment · prevented by randomisation + concealment |
| **Washout period** | Crossover — first therapy's effect persists (drug t½ long) |
| **Recall** | Subjects' recollection differs by outcome or **after unblinding** · common in retrospective/survey studies |
| Observer-expectancy | Investigator finds what they expect · prevented by masking |
| **Procedure** | Groups treated differently beyond the intervention (e.g. extra PT) |
| Attrition | Patients don't complete study |
| Detection | Look harder for outcome in one group |
| Verification | Test result influences group assignment |
| Incorporation | Diagnostic test includes features of target outcome |
| Confirmation | Interpretation skewed by researcher's opinion |
| Sampling | Homogeneous population → ↓ generalisability |
| Publication | Unfavourable results unpublished (industry funding) |
| Hawthorne effect | Behaviour changes when observed |

### Intention-to-treat analysis

| Analysis | Who is analysed |
|---|---|
| **Intention-to-treat** | **As randomised**, regardless of treatment received/compliance · preserves randomisation · ↓ non-responder bias |
| **As-treated** | By treatment actually received · no longer an RCT · used with high crossover |
| **Per-protocol** | **Excludes non-compliant** patients |

**Bayesian analysis** — prior probability + new data → posterior probability

**Effect size** — (difference between groups) ÷ SD

## 5 Management

### Evidence-based care & conflict of interest

**Evidence-based health care** — EBM principles applied to **all health professions incl. purchasing + management**

| Analysis | Effects expressed as |
|---|---|
| Cost-benefit | Money |
| Cost-effectiveness | Health units (cost per event prevented) |
| Cost-utility | Utilities (cost per **QALY**) |
| Decision analysis | Explicit quantitative choice under uncertainty |

**Conflict of interest statement** — ✓ **discloses all financial interests** of each author

## X vs Y

| | Cohort | Case-control |
|---|---|---|
| Grouped by | **Exposure** | **Outcome/disease** |
| Direction | Forward (or retrospective) | Backward |
| Measure | **Relative risk** | **Odds ratio** |
| Level | II (prospective) / III | III |

## How it's asked

**"Purpose of computer random-number generator in Level I trial?"** → **prevent selection bias**\
✗ Wrong options: power · significance · as-treated

**"Intern's RCT, attending recommends computer randomisation — why?"** → **prevent selection bias**\
✗ Wrong options: blinding · prevent crossover

**"Randomisation in sealed opaque envelopes minimises?"** → **selection bias**\
✗ Wrong options: attrition · NNH

**"Reason for computer randomisation (hemi vs screws)?"** → **unbiased placement into groups**\
✗ Wrong options: confirmation bias · heterogeneity

**"Closure-technique QI study — best reduces confounding?"** → **randomisation**\
✗ Wrong options: Hawthorne · blinding · power analysis

**"Crossover PT vs drug (t½ 2 wk), immediate switch — bias?"** → **washout period bias**

**"Patients unaware, surgeon injects and scores outcomes?"** → **single-blinded randomised**

**"Effect of blinding the outcome assessor?"** → **↓ reported treatment effect**

**"Patient discovers their drug before final evaluation — bias?"** → **recall bias**\
✗ Wrong options: selection · observer-expectancy · procedure

**"50 knee ON patients vs 23 without, compare alcohol intake?"** → **case-control**

**"Two groups randomised to bisphosphonate vs placebo?"** → **parallel design**

**"Two interventions applied separately or combined?"** → **factorial**

**"Dislocated vs non-dislocated THAs, look for factors?"** → **case-control**

**"Definition of cohort study?"** → **groups separated non-randomly by exposure, before or after study start**

**"Randomised prospective drug vs standard for AVN — true?"** → **best method for causality**\
✗ Wrong options: OR (case-control) · RR (cohort) · ↑ power (meta-analysis) · hypothesis-generating (case series)

**"RCT with 70% follow-up — level?"** → **II**

**"Athletes choose cleat, followed prospectively through season — level?"** → **II (prospective cohort)**

**"30 non-completers kept in PT group?"** → **intent-to-treat**\
✗ Wrong options: per-protocol

**"Evidence use across health professions incl. purchasing?"** → **evidence-based health care**

**"Purpose of conflict-of-interest statement?"** → **disclose all financial interests**
