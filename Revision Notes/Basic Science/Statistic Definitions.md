# Statistic Definitions

*Basic Science · 100 / 108*

## 1 Basics

### Data types & levels of measurement (TO)

| Pair | Distinction (TO) |
|---|---|
| **Structured vs unstructured** | Rows + columns (Excel, databases) vs free text, images, video, audio |
| **Primary vs secondary** | Collected first-hand for the study (survey, experiment) vs collected by others (registries, published papers) |
| **Qualitative vs quantitative** | Attributes (categorical) vs numbers (measurable) |
| **Discrete vs continuous** | Countable, no intermediate values (no. of surgeries) vs any value in a range (height, temperature) |

| Level | Property | Examples | Allowed analysis (TO) | Not allowed |
|---|---|---|---|---|
| **Nominal** | Labels, **no order** · counting only | Gender, smoking status, **patient ID, mobile number** | Frequencies, **mode**, contingency tables, **chi-square / Fisher**, bar + pie, logistic regression | Mean, median, arithmetic, t-test, ANOVA |
| **Ordinal** | Ordered, **unequal / unknown intervals** | **Cancer stage, tumour grade, Likert**, rankings | **Median + IQR**, Mann–Whitney, Kruskal–Wallis, **Spearman / Kendall**, ordinal regression | **Mean** · treating as interval |
| **Interval** | Equal intervals, **no true zero** · + and − only | **Temperature °C**, time of day, IQ | Mean, SD, correlation, regression, ANOVA | **Ratios** ("twice as hot") |
| **Ratio** | Equal intervals + **absolute zero** · all arithmetic | **Height, weight, age**, volume, duration | **Everything** (parametric, regression) | — |

**Pitfalls** — coded numbers ≠ numerical data · ordinal may look discrete but is **categorical** · wrong data type → invalid test (TO)

### Central tendency & spread

| Measure | Definition | Best for |
|---|---|---|
| **Mode** | Most frequent value | **Nominal** (categorical) data |
| **Median** | Middle value · unaffected by extremes | **Skewed** data · all levels except nominal |
| **Mean** | Arithmetic average · uses all values · most used | Sensitive to extremes |
| **Variance** | Variability of each data point from the mean · = SD² (average of squared deviations) | — |
| **Standard deviation** | Spread of the group | ±1 SD = **68%** · ±2 SD = **95%** · ±3 SD = **99.7%** |

**Mean (TO)** — Σx / n · best for **continuous, symmetric** data · uses all values, least affected by sampling fluctuation · **distorted by outliers** · not for qualitative data or **open-ended classes**

**Median (TO)** — **positional average** · odd n → **(n + 1)/2 th** value · even n → mean of **n/2 th and (n/2 + 1) th** · unaffected by outliers · open-ended classes OK · suits **ordinal** data · not based on all values

**Mode (TO)** — use for **nominal** data · may be **bimodal / multimodal** or absent · open-ended classes OK

| Dispersion (TO) | Formula / use |
|---|---|
| **Range** | Max − min · ignores values between extremes |
| **Quartiles** | Q1 = 25% below · **Q2 = median** · Q3 = 75% below |
| **IQR** | **Q3 − Q1** · spread of central 50% · ✓ **preferred with outliers** |
| Quartile deviation | **IQR ÷ 2** |
| Variance | Σ(x − x̄)² / n (TO — verify: sample variance divides by **n − 1**) |
| **SD** | √variance · ✓ preferred over variance — **same units as data** |

**Reporting (TO)** — **mean ± SD** · outliers / skew → **median + IQR** · location alone is incomplete — always give dispersion

### Charts & graphs (TO)

| Chart | Use (TO) |
|---|---|
| **Pie** | Parts of a whole (percentages) · poor for comparison |
| **Bar** | **Categorical** data · height = frequency · vertical, horizontal (many / long labels), clustered (several variables) |
| **Histogram** | **Continuous** data · adjacent bars · width = class interval |
| **Line** | **Trends over time** |
| **Box and whisker** | **Five-number summary** (min, Q1, median, Q3, max) · shows outliers · ✓ **does not show the mean** |
| **Scatter** | Relationship between **two continuous** variables (correlation) |

### Diagnostic test properties (sensitivity, specificity, PPV, ROC)

| | **Disease +** | **Disease −** |
|---|---|---|
| **Test +** | **a** = true positive | **b** = false positive |
| **Test −** | **c** = false negative | **d** = true negative |

| Measure | Formula | Meaning |
|---|---|---|
| **Sensitivity** | **TP / (TP + FN)** = a/(a+c) | Positive in those **with** disease · **screening** (few false negatives) |
| **Specificity** | **TN / (TN + FP)** = d/(b+d) | Negative in those **without** disease · **confirmation** (avoid treating the unaffected) |
| False-positive rate | b/(b+d) = 1 − specificity | — |
| False-negative rate | c/(a+c) | — |
| **PPV** | **TP / (TP + FP)** = a/(a+b) | Positive test truly diseased · **depends on prevalence** |
| **NPV** | **TN / (TN + FN)** = d/(c+d) | Negative test truly disease-free · depends on prevalence |
| **LR+** | **Sensitivity / (1 − specificity)** | How a positive result changes likelihood |
| **LR−** | (1 − sensitivity) / specificity | How a negative result changes likelihood |

![2 × 2 table](../../Orthobullets/attachments/ob9073-2x2-table-jpg.jpg)

**Worked examples** — 6 of 10 diseased test + → sensitivity **60%** · 5 false + of 90 healthy → specificity 85/90 = **94.4%** · sens 90%, spec 95%, prevalence 10% → PPV 9/(9 + 4.5) = **67%** · 80/100 flu +, 5/100 healthy + → NPV 95/(20 + 95) = **83%** · 86/(86 + 4) = 95.5% → **specificity**

**Trade-off** — sensitivity and specificity usually traded off · false negative worse than false positive → choose **more sensitive** test · drug with nasty side effects, must not treat non-diseased → ✓ **highest specificity**

**Rates (TO)** — **false-negative rate = 1 − sensitivity** (sens 75% → 25% missed) · false-positive rate = 1 − specificity (spec 90% → 10% wrongly labelled diseased)

**Perspective (TO)** — sensitivity / specificity depend on **disease status** · **PPV / NPV depend on test result** and **prevalence** · accuracy needs **both** sensitivity + specificity · don't use a screening test for definitive diagnosis

**Prevalence and sensitivity** — sensitivity "can be influenced by prevalence" (TO — verify: sensitivity and specificity are normally taken as prevalence-independent; PPV / NPV change) — read the options

**Precision** — closeness of repeated measurements (random error) · precise ≠ accurate

**Post-test** — pre-test odds = p/(1 − p) · post-test odds = pre-test odds × LR · post-test probability = odds/(odds + 1)

**ROC curve** — x-axis **1 − specificity (FPR)** · y-axis **sensitivity (TPR)** · ✓ measures **responsiveness** · area under curve (**C-statistic**): **0.5 = useless**, **>0.75 adequate**, higher = better

![ROC curve](../../Orthobullets/attachments/ob9073-roc-curve.jpg)

| Tool | Purpose |
|---|---|
| **ROC curve** | **Responsiveness** / diagnostic ability |
| **Funnel plot** | **Publication bias** in meta-analysis |
| **Forest plot** | Relative treatment effects across studies (meta-analysis) |
| **Kaplan–Meier** | **Survivorship** |
| **Cronbach α** | **Internal consistency** of questionnaire items |
| Log rank | Compare survival curves |
| Multiple regression | Predict a variable from ≥2 others · controls confounders |
| **Cohen's kappa** | **Inter-observer** reliability |
| **ICC** | **Intra-observer** reliability |

### Incidence, prevalence & risk measures

**Incidence** — ✓ **new cases** in a period per population at risk · long-term population/cohort studies · e.g. 100 new cases among 400 at-risk workers (100 already affected excluded) = **25%**

**Prevalence** — ✓ **total existing cases** at a time point · **cross-sectional** survey (census) · e.g. 200/500 = 40% · MRSA cases on 1 day = prevalence

| Measure | Formula / source |
|---|---|
| **Relative risk** | [a/(a+b)] / [c/(c+d)] = incidence exposed / incidence unexposed · **cohort** studies · RR >1 → more outcome in exposed |
| **Odds ratio** | **(a × d)/(b × c)** · **case-control** (retrospective) + logistic regression · ≈ RR when outcome rare (<10%) · exaggerates risk when common |
| Absolute risk reduction | Risk difference between groups |
| Relative risk reduction | 1 − RR |
| Attributable risk | Risk difference attributable to exposure |
| **NNT** | **1 / ARR** (NNS 1000 → ARR 0.1%) |
| Hazard ratio | Comparison of rates over time (survival curves) |

**Hep C example** — 75/595 transfused vs 16/712 not → RR = **incidence (75/595) ÷ incidence (16/712)**

**Odds ratio in forest plot** — OR <1 = ↓ odds in treatment · **CI includes 1 → not significant** · **narrower CI = more precise, less uncertainty** · OR size ≠ effect size/clinical importance · adjusted vs crude OR differ (confounding)

**Study reporting** — cohort (e.g. BMI vs THA outcome in 500) → ✓ **relative risk** · case-control → odds ratio

## 4 Diagnosis & Classification

### Study design & meta-analysis

| Design | Description |
|---|---|
| **Case-control** | Start with **outcome** (e.g. tibial nonunion) vs controls without → look back for risk factors → **OR** |
| **Cohort** | Start with **exposure** (e.g. daily vit D) → follow for outcome (hip fracture) → **RR** · prospective or retrospective |
| Cross-sectional | Single time point → **prevalence** |
| RCT | Random allocation, prospective |
| Case series | No comparison group |
| Meta-analysis | Combines studies · funnel plot for publication bias |

**Funnel plot** — effect size vs study size/precision · large studies less variable · ✓ **symmetric inverted funnel = no publication bias** · skewed = bias (negative studies unpublished)

![Funnel plot](../../Orthobullets/attachments/ob9073-funplot.jpg)

### Statistical test selection (t-test, chi-square, ANOVA, non-parametric) (TO)

**Parametric** — continuous, **normally distributed** · **non-parametric** — skewed continuous, **ordinal** or **categorical**

| Comparison | **Parametric** | **Non-parametric** |
|---|---|---|
| 2 groups, **paired** | **Paired t-test** (means in matched groups) | **Wilcoxon signed-rank** (Orthobullets) · OB1230/OB213156 call it Wilcoxon rank-sum — read the options |
| 2 groups, **unpaired** | **Student / independent t-test** | **Mann-Whitney U** (= Wilcoxon rank sum) |
| **≥3 groups** | **ANOVA** | **Kruskal-Wallis** (Friedman for repeated) |
| **Categorical, 2+ groups** | **Chi-square** | Chi-square |
| Categorical, **small sample** (<5 per cell or total <~50) | **Fisher exact** | Fisher exact |

**ANOVA** — one-way = **one independent variable** · two-way = **two independent variables** · ≥3 groups, normal data (e.g. BMI across pinning/hemi/THA; fastball velocity of 5 pitchers)

```
Choose a test
├─ Categorical / proportions → CHI-SQUARE
│      └─ small cells (<5) → FISHER EXACT
├─ Continuous, normal → 2 groups T-TEST (paired if matched) · ≥3 groups → ANOVA
└─ Continuous skewed or ordinal → 2 groups MANN-WHITNEY U · ≥3 groups → KRUSKAL-WALLIS
```

**Ordinal grade (Herring) in two unpaired populations** — ✓ **Mann-Whitney U** **(TO)**\
✗ Wrong options: paired t · Wilcoxon signed-rank · Kruskal-Wallis

**Examples** — mean age 2 normal groups → **t-test** · CRPS rate 1% vs 9% → **chi-square** · single non-normal continuous variable → **Mann-Whitney U** · OR time robotic vs manual (normal) → **t-test** · ACL graft return-to-play scores (finite range) → chi-square per OB217862

## 5 Management

### Type I & II errors & power

**Statistical inference (TO)** — conclusions about a **population** from a representative **sample** · data collection → exploratory analysis → estimation + hypothesis testing

**H₀ (TO)** — **no difference / no effect** · always the one tested directly (e.g. H₀: μ = 120 · H₀: r = 0) · **H₁** = difference or association exists

**Tails (TO)** — **two-tailed**: parameter ≠ value · **one-tailed**: > or < value

**Test statistic (TO)** — value from sample data deciding rejection of H₀ · t, z, chi-square

**Confidence (TO)** — **1 − α** = correctly accepting a true H₀ · **power (1 − β)** = correctly rejecting a false H₀

| Court analogy (H₀ = innocent) | Meaning (TO) |
|---|---|
| **Type I** | **Innocent declared guilty** |
| **Type II** | **Guilty declared innocent** |
| Confidence | Innocent declared innocent |
| Power | Guilty declared guilty |

| | **H₀ true** | **H₀ false** |
|---|---|---|
| **Reject H₀** | **Type I (α) error** — false positive | Correct — **power (1 − β)** |
| **Fail to reject H₀** | Correct (1 − α) | **Type II (β) error** — false negative |

![Type I and II errors](../../MCQ/attachments/q211200-illa-h0-table.jpg)

**Type I (α)** — ✓ **rejecting a true null** · α set at **0.05** (1/20) · ↓ by lowering α (0.01) or **Bonferroni** (but ↑ type II)

**Type II (β)** — ✓ **accepting a false null** · detecting no difference when one exists · commonest in **underpowered** studies · e.g. small trial negative, later 2000-patient trial positive · crossover with intent-to-treat (40% "no tourniquet" got tourniquet) · 2 groups of 5 with p = 0.079 → **may be type II**

**Power** — ✓ **1 − β** · probability of detecting a true effect · usually **80%** (β 0.2) · depends on effect size, α, β, **n** · ✓ **↑ sample size → ↑ power, ↓ type II** · 84 needed per arm, β 0.2 → chance of false-negative = **0.2**\
✗ Wrong options: prospective vs retrospective · case-control

**Power analysis** — ✓ **determines minimum sample size** to show a clinically significant difference · ✓ **before the study** · elements: α, β, effect size (± variance), n · post-hoc power discouraged

| Reduces type II | Doesn't |
|---|---|
| ✓ **↑ sample size** | ↓ α to 0.01 (↑ type II) · blinding (detection bias) · goniometer (measurement error) · randomisation (selection bias) · Bonferroni (↑ type II) · ↑ β |

**Effect size** — magnitude of difference in means between groups ÷ **pooled SD** · continuous variables (RRR for dichotomous) · not shown by p-value

**Other terms** — **Hawthorne effect** = behaviour change when observed · **confounder** = associated with both exposure + outcome · selection bias · measurement error · sampling error · **fragile p-values** with small samples\
✗ Wrong options: "error"

### P-values, confidence intervals, correlation & effect size

**P-value** — probability, **if H₀ true**, of a result **as or more extreme** · p = 0.09 → difference would arise by chance **9 in 100** times · ✓ p-value = probability of type I error (OB217456)\
✗ Wrong options: "groups statistically equal" if p > 0.05 · gives effect size · clinical significance

**Bonferroni correction** — ✓ **post-hoc correction of p-values for multiple simultaneous tests** on one data set · **α ÷ number of comparisons** (10 tests → 0.005)

| Confidence level | Mean ± SD |
|---|---|
| 85% | 1.44 |
| 90% | 1.65 |
| **95%** | **1.96** (OB218892 uses ±2 SD) |
| 98% | 2.32 |
| **99%** | **2.58** |

**Confidence interval** — range likely to contain the true parameter · shows **precision** + magnitude · ✓ **larger sample → narrower CI** (smaller margin of error) · 99% CI wider than 95% · overlapping CIs do not prove no significance — need formal test · e.g. FNA 0.5 ± 0.2 → 95% range **0.1–0.9 cm³**

**P-value wording (TO)** — p < α → reject H₀ · p = 0.02 → "2% chance the result is due to random variation" (TO — verify: strictly the probability of a result this extreme **if H₀ is true**)

**Statistical vs clinical significance (TO)** — significant ≠ clinically relevant · e.g. symptoms 5.5 → 5.3 days · SBP 160 → 155 mmHg

**95% CI meaning (TO)** — if repeated many times, **95% of such intervals contain the true value** · gives more information than p alone

**CI and significance (TO)** — CI **including the no-effect value** (OR / HR **= 1**) → **not significant** · excluding it → significant

| CI width (TO) | Effect |
|---|---|
| ↑ Confidence level | **Wider** |
| ↑ Sample size | **Narrower** |
| ↑ Variability | **Wider** |

**Correlation** — R² = 0.97, p = 0.03 → strongly correlated, unlikely chance, does not **validate accuracy** (both methods could be wrong) · Pearson = 2 normal continuous variables · **Bayesian** = prior → posterior probability

### Correlation & regression (TO)

**Correlation** — degree + direction of association between **two quantitative** variables · ✓ **does not imply causation** (common underlying factor, spurious) (TO)

**Scatter diagram** — **first step** · X = independent, Y = dependent · points not joined (TO)

**r** — **−1 to +1** · sign = direction · magnitude = strength · ✓ **r = 0 → no LINEAR relationship** (not no relationship) (TO)

| r | Strength (TO) |
|---|---|
| 0 | None (linear) |
| 0–0.25 | Weak |
| 0.25–0.75 | Moderate |
| 0.75–1 | Strong |

| Coefficient | Use (TO) |
|---|---|
| **Pearson r** | Linear relationship · **both variables normal** |
| **Spearman rₛ** | **Non-parametric**, uses **ranks** · ordinal / non-normal data |
| Kendall | Rank correlation (ordinal) |

**Regression equation** — **Y = a + bX** · a = **intercept** (Y when X = 0, baseline) · b = **slope / regression coefficient** (average change in Y per unit X, −∞ to +∞) (TO)

**Least squares** — line of best fit **minimises the sum of squared residuals** · **residual = observed − predicted (Y − Ŷ)** (TO)

**Worked example** — Y = 90 − 2X (score vs absences) → 90 = score with no absences · each absence ↓ score by 2 (TO)

**R² (coefficient of determination)** — 0–1 · **proportion of variation in Y explained by X** (R² 0.85 → 85%) · **goodness of fit** (TO)

**Adjusted R²** — **penalises unnecessary predictors** · ✓ use in **multiple** regression / comparing models (TO)

**Outcome variable** — linear regression needs a **continuous** Y (TO)

**Two regression lines** — Y on X and X on Y · **not interchangeable** · **coincide only if r = ±1** · **r = geometric mean of the two regression coefficients** · if one coefficient > 1 the other < 1 · independent of change of **origin**, not of **scale** (TO)

| Assumption (TO) | Check | If violated |
|---|---|---|
| **Linearity** | Scatter plot | — |
| **Normality of residuals** | Histogram, box plot, normal probability plot | Minor → ignore · severe → **log transform** |
| **Homoscedasticity** (constant residual variance) | **Residual vs predicted plot** | Inefficient t-tests · **↑ type II error** |
| **Independence of errors** | Residual plots · **Durbin–Watson** | **≈ 2 = no autocorrelation** · acceptable **1.5–2.5** |
| **No multicollinearity** (multiple regression only) | **VIF** · tolerance | Drop or combine correlated variables |

| Multicollinearity measure | Cut-off (TO) |
|---|---|
| **VIF** | **> 5** investigate · **> 10 serious** |
| **Tolerance** | **< 0.20** suspicious · **< 0.10 serious** |

**Multicollinearity** — strongly correlated predictors (**weight + BMI**, waist + waist–hip ratio) → **inflated SE**, unstable coefficients, **high R² with non-significant predictors** · affects **reliability, not bias** (TO)

### Reliability, MCID, fragility index & survival

**Psychometrics** — **reliability** = ✓ **reproducibility** between repeated tests / observers · **validity** = measures what it intends · **responsiveness** = detects change (ROC)

**Inter-observer** — **Cohen's kappa** · **intra-observer** — **ICC**

**MCID** — difference in outcome that is clinically relevant · few tools have accepted MCID · statistically significant 5-point ASES difference with MCID 10–15 → ✓ **may not be clinically meaningful** (both groups' 22/27-point gains exceed MCID)

**Fragility index** — ✓ **number of outcome changes (event ↔ non-event) needed to flip significance** · dichotomous outcomes · larger = more robust

**Survivorship** — joint replacement success · all assumed operated simultaneously · **life table** (annual, changes once/yr) vs **product limit** (recalculated at each failure) · **Kaplan–Meier**: x = time, y = survival probability · higher curve at a time point = better survival

## X vs Y

| | Bar diagram | Histogram |
|---|---|---|
| Data | **Categorical** | **Continuous** |
| Gaps between bars | **Allowed** | **None** |
| Reorder bars | Yes | **No** (TO) |

| | Correlation | Regression |
|---|---|---|
| Gives | Strength + direction | **Predicts** change in outcome |
| Dependent / independent | **Not required** | **Required** |
| Basis | Scatter plot | **Least squares** |
| Causality | None | Only with domain knowledge (TO) |

| | Simple linear | Multiple linear |
|---|---|---|
| Predictors | **One** | **> One** (partial slopes) |
| Outcome | Continuous | Continuous |
| Adjusted R² | Not essential | **Essential** (TO) |

| | Sensitivity / specificity | PPV / NPV |
|---|---|---|
| Depends on | **Disease status** | **Test result + prevalence** |
| Use | Screening (sens) · confirmation (spec) | Probability for an individual result (TO) |

## How it's asked

**"Equation for specificity?"** → **TN / (TN + FP)**\
✗ Wrong options: TP/(TP + FN) (sensitivity)

**"Positive predictive value?"** → **TP / (TP + FP)**

**"86/(86 + 4) = 95.5% (US for meniscus tears)?"** → **specificity**

**"Sensitivity of an assay?"** → **TP / (TP + FN)**

**"Tool to determine responsiveness?"** → **ROC curve**\
✗ Wrong options: funnel plot, Kaplan–Meier, Cronbach α, forest plot

**"Test value to avoid treating people without RA?"** → **specificity**\
✗ Wrong options: sensitivity · NPV

**"Probability of finding a true association?"** → **power**

**"Accepting the null when false?"** → **type II error**

**"Statistical power defined by?"** → **1 − probability of type II error**\
✗ Wrong options: 1 − α

**"Ability to detect a true difference between interventions?"** → **power**\
✗ Wrong options: effect size · Hawthorne

**"Capsule repair study negative, later large study positive?"** → **type II error**

**"Rejecting a true null hypothesis?"** → **type I error**

**"Increase study power by?"** → **increasing sample size**

**"No difference when one truly exists?"** → **type II error**

**"Power analysis determines what, when?"** → **sample size, before the study**

**"84 per arm, β 0.2, α 0.05, p = 0.28 — chance null accepted when false?"** → **0.2**\
✗ Wrong options: 0.8 = power · 0.05

**"Tourniquet RCT, 40% crossover, ITT no difference?"** → **type 2 (β) error**

**"Purpose and timing of power analysis?"** → **minimum patients for clinically significant difference, before study**

**"Lateralised RSA study negative, later RCTs positive?"** → **type II error**

**"Reduce type II error?"** → **increase sample size**\
✗ Wrong options: α 0.01 · blinding · β 0.9

**"6300-patient trial positive, 150-patient follow-up negative?"** → **beta error**

**"Calculate power?"** → **1 − type II error**

**"Two groups of 5, p = 0.079 — statement?"** → **may have made a type II error**\
✗ Wrong options: Bonferroni · underpowered ↑ type I

**"Reduce type 2 error in TKA rehab RCT?"** → **increase sample size**\
✗ Wrong options: goniometer · blinding · Bonferroni

**"Herring grade in rural vs urban groups?"** → **Mann-Whitney U** **(TO)**

**"Paired t-test used for?"** → **difference between two means in matched groups**

**"Chi-square unreliable with small numbers — use?"** → **Fisher exact test**

**"Mean age, two normal groups?"** → **Student t-test**

**"CRPS rates 1% vs 9%?"** → **chi-square**

**"Chi-square most appropriate for?"** → **categorical data between groups**\
✗ Wrong options: <5 per group (Fisher)

**"Normal data, ≥3 independent groups?"** → **ANOVA**\
✗ Wrong options: Kaplan–Meier · log rank

**"Single continuous non-normal variable?"** → **Mann-Whitney U**

**"Ideal ANOVA scenario?"** → **mean BMI across pinning, hemi, THA (parametric)**

**"Data for chi-squared test?"** → **categorical data of two large groups**\
✗ Wrong options: two small (Fisher)

**"Mean OR time robotic vs manual TKA, normal?"** → **Student t-test**

**"Best ANOVA application?"** → **fastball velocity of top five pitchers**

**"One-way vs two-way ANOVA?"** → **one vs two independent variables, ≥3 groups**

**"Definition of incidence?"** → **new cases in a specific time period**

**"Relative risk of hep C with transfusion?"** → **(75/595) ÷ (16/712)**

**"500 workers, 100 symptomatic at start, 100 new in 5 yr — incidence?"** → **25%**\
✗ Wrong options: 20% · 40% (prevalence)

**"500 THAs followed by BMI — report effect as?"** → **relative risk**\
✗ Wrong options: odds ratio

**"Total MRSA cases on one day?"** → **prevalence**

**"Cross-sectional survey establishes?"** → **prevalence**

**"RR of dehiscence anterior vs posterior (W, X, Y, Z table)?"** → **W/(W + X) ÷ Y/(Y + Z)**\
✗ Wrong options: (W/Y)/(X/Z) (OR)

**"Effect size definition?"** → **estimated magnitude of difference in means**

**"Range likely to include the unknown parameter?"** → **confidence interval**

**"Bonferroni correction?"** → **post-hoc p-value correction for multiple tests**

**"Women vs men steps, p = 0.09 — interpretation?"** → **difference would occur by chance 9 in 100 times if no true difference**\
✗ Wrong options: statistically equal

**"R² 0.97, p 0.03 between FE and bench model?"** → **strongly correlated, not chance, but doesn't validate the model**

**"Mean ± 2.58 SD?"** → **99% CI**

**"Meaning of p = 0.03?"** → **probability of type I error**

**"1.2 ± 0.3 vs 0.5 ± 0.2 cm³ — conclusion?"** → **FNA yields 0.1–0.9 cm³ 95% of the time**\
✗ Wrong options: significance from CIs alone

**"Narrower CI in final study — cause?"** → **larger sample size**\
✗ Wrong options: 99% CI · more variability

**"Forest plot of aspirin ORs — accurate?"** → **DVT estimate less uncertain than hematoma (narrower CI)**

**"Funnel plot purpose?"** → **detect publication bias**\
✗ Wrong options: forest plot · ROC

**"Nonunion patients vs non-nonunion patients questionnaire?"** → **case-control study**

**"Daily vit D group vs none followed for hip fracture?"** → **cohort study**

**"Reliability refers to?"** → **reproducibility between repeated tests or observers**

**"Kaplan–Meier — accurate statement?"** → **group with highest curve at 1 month more likely alive**

**"Fragility index?"** → **number of outcome changes needed to change trial significance**

**"ASES +22 vs +27, p = 0.03, MCID 10–15?"** → **5-point difference may not be clinically meaningful**

**"Temperature in °C — level of measurement?"** → **interval (no true zero)** (TO)\
✗ Wrong options: ratio

**"Cancer stage / tumour grade — data type?"** → **ordinal** (TO)\
✗ Wrong options: nominal

**"Best summary with outliers?"** → **median + IQR** (TO)

**"Box-and-whisker plot does NOT show?"** → **the mean** (TO)

**"r = 0 means?"** → **no linear relationship** (TO)

**"Correlation for ranked / non-normal data?"** → **Spearman** (TO)

**"R² = 0.85?"** → **85% of variation in Y explained by X** (TO)

**"Serious multicollinearity?"** → **VIF > 10** (TO)

**"Durbin–Watson ≈ 2?"** → **no autocorrelation of residuals** (TO)

**"OR with 95% CI including 1?"** → **not significant** (TO)
