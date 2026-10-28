# Notes — Introduction To Biostats Research Various Data Types

Biostatistics — Biostatistics videos · Basic Sciences

#basics #TO #notesintroductionbiostatsresearchvariousdatatypes

> **Source** `out/docs/biostatistics-videos/biostatistics-videos/Notes__Introduction_To_Biostats___Research___Various_Data_Types_lyst1765878693065.pdf`
> 5 pages · notes

Overview / Key Concepts
Biostatistics is the foundation of medical research and evidence-based decision making.
Understanding data types and levels of measurement is essential because the choice of
statistical test, summary measure, and interpretation depends entirely on the nature of
the data.
This lecture focuses on: - What data is and why classification matters - Types of data
used in medical research - Levels of measurement in statistics - Correct and incorrect
methods of data analysis

What is Data?
Data is a collection of facts, observations, or measurements collected for analysis and
interpretation.
- Can exist as numbers, text, images, audio, or video
- Acts as raw material for generating meaningful information
- Proper analysis converts data into clinical or research insights
- Incorrect analysis leads to wrong conclusions

Why Understanding Data Types is Critical
- Every statistical test is linked to a specific data type
- Incorrect classification leads to misuse of tests
- Affects visualization, summary statistics, and interpretation
- Core concept for thesis work, publications, and exam questions
Faculty Quote “Everything in statistics begins with data types. If this step is wrong,
the entire analysis collapses.”

Classification of Data
### Structured vs Unstructured Data
- Structured Data
  - Organized in rows and columns
  - Example: Excel sheets, databases
  - Common in clinical and hospital records
- Unstructured Data
  - No predefined format
  - Example: free text notes, images, videos, audio recordings

<!-- page 2 -->

### Primary vs Secondary Data
- Primary Data
  - Collected firsthand by the researcher
  - Designed for a specific research objective
  - Examples: surveys, experiments, interviews
- Secondary Data
  - Collected by someone else for another purpose
  - Examples: published papers, registries, institutional databases

Qualitative vs Quantitative Data
### Qualitative (Categorical) Data
- Describes qualities or attributes
- Subjective in nature
- Examples: gender, pain severity description, color, satisfaction
### Quantitative (Numerical) Data
- Expressed in numbers
- Objective and measurable
- Examples: age, height, weight, blood pressure

Discrete vs Continuous Data
### Discrete Data
- Countable values
- No intermediate values possible
- Examples:
  - Number of surgeries
  - Number of patients
### Continuous Data
- Can take infinite values within a range
- Examples:
  - Height
  - Weight
  - Temperature

Levels of Measurement in Statistics
Four levels of measurement determine how data can be analyzed:

<!-- page 3 -->

1. Nominal
2. Ordinal
3. Interval
4. Ratio

### Nominal Scale
- Data represented as labels or names
- No inherent order
- Only counting is possible
Examples - Gender - Smoking status - Hair color - Patient ID

### Analysis of Nominal Data
- Frequency distribution
- Mode
- Contingency tables
- Chi-square test or Fisher exact test
- Bar charts and pie charts
- Multinomial or binary logistic regression
### What Not to Do
- Do not calculate mean or median
- Do not perform arithmetic operations
- Do not assume numerical meaning of coded values
- Avoid parametric tests like t-test or ANOVA

### Ordinal Scale
- Categories with a defined order
- Exact difference between categories is unknown
- Relative comparison only
Examples - Cancer staging - Tumor grading - Likert scale - Rankings

### Analysis of Ordinal Data
- Frequencies and percentages
- Median and interquartile range
- Non-parametric tests:
  - Mann–Whitney U test
  - Wilcoxon rank-sum test
  - Kruskal–Wallis test
- Spearman or Kendall rank correlation

<!-- page 4 -->

- Ordinal regression
### What Not to Do
- Do not calculate mean
- Do not assume equal intervals
- Do not treat ordinal data as interval or ratio data
- Do not ignore the inherent order

### Interval Scale
- Numeric data with equal intervals
- No true zero point
Examples - Temperature in Celsius - Time of day - IQ scores

### Key Concept
- Addition and subtraction allowed
- Multiplication and division not meaningful
Analysis
- Mean, median, standard deviation
- Correlation and regression
- ANOVA
- Time series analysis
### What Not to Do
- Do not interpret ratios (“twice” or “half”)
- Do not assume normality without testing

### Ratio Scale
- Numeric data with absolute zero
- Most powerful level of measurement
Examples - Height - Weight - Age - Volume - Length of time

Analysis
- All descriptive statistics
- Parametric tests
- Regression models
- Correlation analysis
### Key Advantage
- All arithmetic operations are valid

<!-- page 5 -->

### Common Pitfalls Highlighted
- Coded numbers are not always numerical data
- Patient ID and mobile numbers are nominal data
- Ordinal data may look discrete but remains categorical
- Always understand what the data represents, not how it appears in Excel

### Exam Pearls
- Nominal data allows only counting and mode
- Ordinal data allows median but not mean
- Interval data has equal intervals but no true zero
- Ratio data has true zero and allows all arithmetic operations
- Cancer staging and grading are ordinal, not nominal
- Temperature in Celsius is interval, not ratio
- Height, weight, and age are ratio scale variables
- Choosing the wrong data type leads to invalid statistical conclusions
