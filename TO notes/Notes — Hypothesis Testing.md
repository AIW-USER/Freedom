# Notes — Hypothesis Testing

Biostatistics — Biostatistics videos · Basic Sciences

#basics #TO #noteshypothesistesting

> **Source** `out/docs/biostatistics-videos/biostatistics-videos/Notes__Hypothesis_Testing_lyst1765878812928.pdf`
> 4 pages · notes

Overview / Key Concepts
Hypothesis testing is the backbone of statistical inference. It helps determine whether
an observed difference or association in a sample reflects a true population effect or is
merely due to chance.
This lecture covers: - Concept of hypothesis and statistical inference - Null and
alternative hypotheses - Type I and Type II errors - Level of significance, confidence,
and power - P value and its interpretation - Statistical versus clinical significance -
Concept and interpretation of confidence intervals

Statistical Inference
Statistical inference is the process of drawing conclusions about a population based on
a representative sample.
- Population parameters are unknown
- Samples are used due to feasibility constraints
- Inference determines whether sample findings can be generalized
Key steps: - Data collection - Exploratory data analysis - Estimation and hypothesis
testing

Hypothesis
A hypothesis is a testable statement about a population parameter.
Types of hypothesis: - Null hypothesis (H0) - Alternative hypothesis (H1 or Ha)

Null and Alternative Hypothesis
### Null Hypothesis (H0)
- Assumption of no difference or no effect
- Always tested directly
Examples - Mean SBP = 120 mmHg (H0: μ = 120) - No correlation between father’s
height and son’s height (H0: r = 0)

### Alternative Hypothesis (H1 or Ha)
- Opposite of null hypothesis
- Indicates presence of difference or association

<!-- page 2 -->

Two-tailed hypothesis - Parameter ≠ specified value
One-tailed hypothesis - Parameter > specified value or < specified value

### Test Statistic
- Numerical value calculated from sample data
- Used to decide whether to reject H0
- Formula varies depending on the test applied
Examples include: - t statistic - z statistic - chi-square statistic

Errors in Hypothesis Testing
Decision | H0 True | H0 False |
Reject H0 | Type I Error (α) | Correct decision (Power) |
Do not reject H0 | Correct decision (Confidence) | Type II Error (β) |

### Type I Error (α)
- Rejecting H0 when it is true
- False positive

### Type II Error (β)
- Not rejecting H0 when it is false
- False negative

### Level of Significance (α)
- Probability of committing a Type I error
- Commonly set at 0.05 (5 percent)
- Means 1 in 20 chance of rejecting a true null hypothesis

Confidence and Power
Confidence (1 − α)
- : Correctly accepting H0 when it is true
- Power (1 − β): Correctly rejecting H0 when it is false
Faculty Quote “Statistics allows two correct decisions and two wrong decisions. Our
aim is to maximize power and confidence.”

<!-- page 3 -->

### Court Trial Analogy
- Null hypothesis: Person is innocent
- Alternative hypothesis: Person is not innocent
Interpretation: - Type I error: Innocent person declared guilty - Type II error: Guilty
person declared innocent - Confidence: Innocent person correctly declared innocent -
Power: Guilty person correctly declared guilty

### P Value
- Probability of obtaining observed results by chance when H0 is true
- Smaller p value indicates stronger evidence against H0
Decision rule - p < α → Reject H0 - p ≥ α → Do not reject H0
Example: - p = 0.02 implies 2 percent chance that result is due to random variation

Statistical vs Clinical Significance
Statistical significance does not always imply clinical relevance.
Examples: - Drug reduces symptoms from 5.5 to 5.3 days - SBP reduces from 160 to
155 mmHg
These may be statistically significant but clinically insignificant.

Confidence Interval (CI)
A confidence interval provides a range of values within which the true population
parameter is likely to lie.
- Expressed as lower and upper confidence limits
- Commonly reported as 95 percent CI

Interpretation
A 95 percent CI means that if the study were repeated multiple times, 95 percent of
such intervals would contain the true population value.

<!-- page 4 -->

### Confidence Interval and Significance
- CI that includes no-effect value indicates non-significance
- CI excluding no-effect value indicates statistical significance
Examples: - Odds ratio CI including 1 → not significant - Hazard ratio CI excluding 1 →
significant

Width of Confidence Interval
General rule: - Narrower CI indicates greater precision
Factors affecting CI width: - Confidence level (higher confidence → wider CI) - Sample
size (larger sample → narrower CI) - Variability (greater variability → wider CI)

### Exam Pearls
- Null hypothesis always assumes no difference or no effect
- Type I error is false positive, Type II error is false negative
- α represents probability of Type I error
- Power equals 1 − β
- p value < 0.05 indicates statistical significance
- Statistical significance does not guarantee clinical relevance
- Confidence interval provides more information than p value alone
- Narrow CI indicates precise estimation
- CI including no-effect value implies non-significant result
