# Statistic Definitions

Source: https://www.orthobullets.com/basic-science/9073/statistic-definitions

Updated: Jun 12 2026

## Images

![[ob9073-2x2-table-jpg.jpg]]

![[ob9073-funplot.jpg]]

![[ob9073-parametric-data.jpg]]

![[ob9073-illustration-showing-non-parametric-data.jpg]]
*illustration showing non-parametric data*

![[ob9073-roc-curve.jpg]]
*ROC curve*


## Introduction

- This topic covers a variety of statistical principles used in research and study design

## Measure of Central Tendency

- **Mode**
  - defined as the value that occurs most often
  - best for data which is allocated into distinct categories (nominal data)
- **Median**
  - defined as the value that occurs at the middle of all values of the variable (half are greater, half are less)
  - not affected by extreme values
  - good for all levels of measurement except nominal data
  - especially good for **skewed** distributions
- **Mean**
  - defined as arithmetic average
  - the most frequently used measure of central tendency
  - uses **all values** of data
  - highly sensitive to extreme values (especially skewed distributions)

## Sensitivity

- Definition
  - probability that test results will be positive in patients with disease
- Equation
  ![[ob9073-2x2-table-jpg.jpg]]
  - **sensitivity = a / (a + c) or**
  - **sensitivity = TP / (TP + FN)**
- Relevance
  - **sensitive** tests are useful for screening since they are unlikely to miss a patient with disease
- Example
  - a new test is developed to quickly diagnose HIV. There are 10 patients in the study group with the disease. Upon testing of all 10 patients, only 6 results return positive. What is the sensitivity of the new test?
  - solution
    - sensitivity = a / (a + c)
    - sensitivity = 6 / 10
    - sensitivity = 60%

|  |  |  |
|---|---|---|
|  | ***Disease Positive*** | ***Disease Negative*** |
| **Test Positive** | (a) true positive = 6 | (b) false positive |
| **Test Negative** | (c) false negative = 4 | (d) True negative |
| **TOTAL** | a + c = 10 | b + d |


## Specificity

- Definition
  - probability test result will be negative in patients without disease
- Equation
  - **specificity= d / (b + d) or**
  - **specificity = TN / (FP + TN)**
- Relevance
  - specific tests are useful for confirmation as they don't result in treatment of an unaffected individual
- Example
  - in a population of 90 patients who are disease free, a test incorrectly diagnoses 5 patients with disease. What is the specificity of this test?
  - solution
    - specificity = d / (b + d)
    - specificity = 85 / 90
    - specificity = 94.4% **Disease Positive Disease Negative Test Positive** (a) true positive (b) false positive = 5 **Test Negative** (c) false negative (d) true negative = 85 TOTAL a + c b + d (90)

## False Positive Rate

- Definition
  - patients without the disease who have a positive test result
- Equation
  - **false positive rate = b / (b + d) Disease Positive Disease Negative Test Positive** (a) true positive (b) false positive **Test Negative** (c) false negative (d) true negative

## False Negative Rate

- Definition
  - patients with disease who have a negative test result
- Equation
  - **false negative rate = c / (a + c) Disease Positive Disease Negative Test Positive** (a) true positive (b) false positive **Test Negative** (c) false negative (d) true negative

## Positive Predictive Value

- Definition
  - probability patient with a positive test actually has the disease
  - dependent on prevalence of disease
- Equation
  - **PPV = a / (a + b) or**
  - **PPV = TP / (TP + FP)**
- Example
  - you are evaluating a new serum diagnostic test for Lyme disease that claims sensitivity 90% and specificity 0f 95%. The prevalence of Lyme disease is known to be 10% in late spring in the study of patients who present with fever, arthralgias, and rash.
  - solution
    - PPV = a / (a + b)
    - PPV = 9 / (9 + 4.5)
    - PPV = 67%
    - use sensitivity, specificity, and prevalence to calculate the quadrants **Disease Positive Disease Negative Test Positive** (a) true positive = 9 (b) false positive = 4.5 **Test Negative** (b) false negative = 1 (d) true negative = 85.5 TOTAL a+c = 10 b+d = 90

## Negative Predictive Value

- Definition
  - probability patient with a negative test actually has no disease
  - dependent on prevalence of disease
- Equation
  - **NPV = d / (c + d) or**
  - NPV = TN / (FN + TN)
- Example
  - 200 patients are enrolled in a study to evaluate the accuracy of a ELISA-based test for the diagnosis of influenza. 100 patients were diagnosed by the gold-standard method. 80 of the patients with influenza had a positive ELISA-based test as did 5 of the patients without influenza. What is the negative predictive value of this test?
  - solutionNPV = TN / (FN + TN)
  - NPV = 95 / (20 + 95)
  - NPV = 83%**Disease PositiveDisease NegativeTest Positive**(a) true positive = 80(b) false positive = 5**Test Negative**(c) false negative = 20(d) true negative = 95

## Likelihood Ratio

- Definition
  - likelihood that a given test result would be expected in a patient with the target disorder compared to the likelihood that that same result would be expected in a patient without the target disorder
- Classification
  - positive likelihood ratio
    - definition
      - describe how the likelihood of a disease is changed by a positive test result
    - equation
      - **positive likelihood ratio = sensitivity / (1 - specificity)**
  - negative likelihood ratio
    - definition
      - describe how the likelihood of a disease is changed by a negative test result
    - equation
      - **negative likelihood ratio = (1 - sensitivity) / specificity**

## Incidence

- Definition
  - number of **newly reported cases** of a disease in specific time period per unit measurement of population

## Prevalence

- Definition
  - the **total number of cases** of a disease present in a location at any time point
- Determined by performing cross-sectional studies

## Relative Risk

- Definition
  - risk of developing disease for people with known exposure compared to risk of developing disease without exposure
    - obtained from cohort studies
    - when RR > 1, the incidence of the outcome is greater in the exposed/treated group
- Equation
  - incidence risk of YES = a / (a + b)
  - incidence risk of NO =c / (c + d)
  - **relative risk = [(a / a + b)] / [(c / c + d)] Disease Status Risk** Present Absent Yes a b No c d
- Example
  - a study is performed concerning the relationship between blood transfusions and the risk of developing hepatitis C. A group of patients is studied for three years. **Disease Status Transfused** Hepatitis C Healthy Yes 75 595 No 16 712

## Odds Ratio

- Definition
  - represents the odds that an outcome will occur given a particular exposure, compared to the odds that the outcome will occur without the exposure
    - obtained from case-control studies (retrospective)
    - also obtained from the output of logistic regression models
  - odds ratio's approximate RR when the outcome is rare (usually defined as <10%)
- Equation
  - OR = (a x d) / (b x c) **Disease Status Risk** Present Absent Yes a b No c d
- **Example**
  - a study is performed concerning the relationship between blood transfusions and the risk of developing hepatitis C. A group of patients is studied for three years.
  - **Disease StatusTransfused**Hepatitis CHealthyYes75595No16712

## Number Needed to Treat

- Definition
  - number of patients that must be treated in order to achieve one additional favorable outcome
- Equation
  - **number needed to treat = (1 / absolute risk reduction)**
- Example
  - you learn the number-needed-to-screen with FOBT is nearly 1000 to prevent colon cancer. What is the absolute risk reduction associated with FOBT?
  - solution
    - absolute risk reduction (ARR) = 1 / number needed to treat
    - ARR = 1 / 1000
    - ARR = .1%

## Post-test Odds of Disease

- Equations
  - post-test probability = (pretest probability) X (likelihood ratio)
    - likelihood ratio = sensitivity / (1 - specificity)
    - pre-test odds = pre-test probability / (1 - pre-test probability)
  - post-test probability = post-test odds / (post-test odds + 1)

## Power

- Definition
  - an estimate of the probability a study will be able to detect a true effect of the intervention
  - a power analysis to determine sample size should be performed prior to initiation of the study
- Equation
  - **power = 1 - (probability of a type-II, or beta error)**

## Effect size

- Definition
  - magnitude of the difference in the means of the control and experimental groups in a study with respect to the pooled standard deviation

## Variance

- Definition
  - an estimate of the variability of each individual data point from the mean

## Type II Error (beta)

- Definition
  - a false negative difference that can occur by
    - detecting no difference when there is a difference or
    - accepting a null hypothesis when it is false and should be rejected
- Equation
  - **power = 1 - (type-II error)**
- Clinical significance
  - a study that fails to find a difference may be because
    - there actually is no difference or
    - the study is not adequately powered

## Type I Error (alpha)

- Definition
  - rejecting a null hypothesis even though it is true
- Clinical significance
  - by definition, alpha-error rate is set to .05, meaning there is a 1/20 chance a type-I error has occurred
- Related principle
  - **Bonferroni correction**
    - post-hoc statistical correction made to P values when several dependent or independent statistical tests are being performed simultaneously on a single data set

## Confidence Interval

- Definition
  - the interval that will include a specific parameter of interest, if the experiment is repeated
  - 95% and 99% most commonly used
    - 95% calculated based on mean +/- 1.96 standard deviations
      - most commonly used by convention
    - 99% calculated based on mean +/- 2.58 standard deviations
- Clinical significance
  - Infers statistical significance, precision of findings, and clinical difference

## Statistical Inference

- Definition
  - used to test specific hypotheses about associations or differences among groups of subjects/sample data
- Classification
  - parametric inferential statistics
    - continuous data that is normally distributed
      ![[ob9073-parametric-data.jpg]]
  - nonparametric inferential statistics
    - continuous data that is not normally distributed (skewed)
      ![[ob9073-illustration-showing-non-parametric-data.jpg]]
    - categorical data
- Study types
  - when comparing two means
    - **Student's t-test**
      - used for parametric data
    - **Mann-Whitney or Wilcoxon rank sum test**
      - used for non-parametric data
  - when comparing proportions
    - **chi-square test**
      - used for two or more groups of categorical data
    - **Fisher exact test**
      - used when sample sizes are small or
      - number of occurrences in a group is low
  - when comparing three or more groups
    - **Analysis of variance (ANOVA)**
      - one-way ANOVA for one independent variable and two-way ANOVA for two independent variables
      - data must be normally distributed

**Choosing the Right Test**

|  |  |  |
|---|---|---|
| **Comparison** | **Parametric** | **Nonparametric** |
| **Continuous Data** |  |  |
| Two groups |  |  |
| *Paired* | Dependent (paired) t-test | Wilcoxon Signed-Rank Test |
| *Unpaired* | Independent t-test | Mann-Whitney U test |
| Three or more groups | Analysis of variance (ANOVA) | Kruskal-Wallis test |
| **Categorical data** |  |  |
| Two or more variables | Chi-square | Chi-square |
| Two or more variables (when the sample size is small) | Fisher exact test | Fisher exact test |


## Funnel Plot

- Definition
  - is a simple scatter plot of the intervention effect estimates from individual studies against some measure of each study’s size or precision and is used to detect publication bias in meta-analyses
- Clinical Significance
  ![[ob9073-funplot.jpg]]
  - this method is based on the fact that larger studies have smaller variability, whereas small studies, which are more numerous, have larger variability. Thus the plot of a sample of studies without publication bias will produce a symmetrical, inverted-funnel-shaped scatter, whereas a biased sample will result in a skewed plot.

## Receiver Operating Characteristic (ROC) Curve

- Definition
  - a graphical representation of the diagnostic ability of different tests
    ![[ob9073-roc-curve.jpg]]
  - used to determine **responsiveness**
- Variables
  - **False positive rate (1 - specificity)**
    - is plotted on the **x-axis**
  - **True positive rate (sensitivity)**
    - is plotted on the **y-axis**
- Interpretation
  - Area under the ROC curve (C-statistic)
    - used to compare different tests, higher C-statistics mean better diagnostic ability of test
      - **an area under the ROC curve of 0.5 is a useless test**

## Survivorship Analysis

- Overview
  - often used to measure success of joint replacements
  - analyzes data from patients with different lengths of follow-up
    - for analysis, it is assumed that all patients had their operation simultaneously
  - chance of implant surviving for a particular length of time is calculated as the survival rate
    - calculation method is either life table or product limit method
  - May be analyzed with the **Kaplan-Meier method**
  - Life table method
    - annual success rate, determined from the failure rate, is cumulated to give a survival rate for each successive year, this can change only once per year
  - Product limit method
    - same as life table method, but the survival rate is recalculated each time a failure occurs

## Minimal Clinically Important Difference (MCID)

- The difference in outcome measures that will have clinical relevance
- Difficult to study and measure, very few outcome tools have established and universally accepted MCID
- Helps to reconcile the statistical significance and clinical relevance of study results that use outcome tools

## Repeated Measurement Reliability

- Interrater/interobserver Reliability
  - A measurement of the degree of agreement between two or more assessors
  - Measured with Cohen's kappa
- Intrarater/intraobserver Reliability
  - A measurement of the reliability of a single assessor making multiple measurements/observations of a single subject
  - Measured with Intraclass correlation coefficient (ICC)
