# Notes — Regression Analysis

Biostatistics — Biostatistics videos · Basic Sciences

#basics #TO #notesregressionanalysis

> **Source** `out/docs/biostatistics-videos/biostatistics-videos/Notes__Regression_Analysis_lyst1765878795037.pdf`
> 5 pages · notes

Overview / Key Concepts
Regression analysis explains how the value of an outcome variable changes as a
function of one or more predictor variables. Unlike correlation, regression allows
prediction and quantification of effect size.
This lecture covers: - Concept and definition of regression analysis - Simple and
multiple linear regression - Line of best fit and principle of least squares - Interpretation
of slope, intercept, R², and adjusted R² - Assumptions of linear regression - Common
diagnostic issues and remedies

Introduction to Regression
Regression answers the question: How much change in Y occurs for a given change in
X?
Types: - Simple linear regression, one independent variable - Multiple linear regression,
more than one independent variable
Outcome variable (Y): - Must be continuous

Definition of Linear Regression
Regression analysis is a mathematical measure of the average relationship between
two or more variables, expressed in the original units of the data.
General equation:
Y = a + bX
Where: - a = intercept - b = slope or regression coefficient

### Line of Regression
- Also called line of best fit
- Represents average relationship between X and Y
- Used for prediction

### Principle of Least Squares
- Regression line is obtained by minimizing the sum of squares of residuals
- Residual = Observed value − Predicted value

<!-- page 2 -->

Residual = Y − Ŷ
This ensures the best possible fit of the line to the observed data.
Faculty Quote “Regression line is chosen so that the total error is minimum, not for
individual points but on average.”

### Two Lines of Regression
- Regression of Y on X
- Regression of X on Y
Key points: - Not interchangeable - Based on different assumptions - Y on X minimizes
vertical (Y-axis) residuals

### Properties of Regression Lines
- If r = ±1, both regression lines coincide
- Correlation coefficient is the geometric mean of two regression coefficients
- If one regression coefficient > 1, the other must be < 1
- Regression coefficients are independent of change of origin but not of scale

Components of Linear Regression
Regression Coefficient (Slope, b)
- Indicates average change in Y for one-unit change in X
- Can take any value from −∞ to +∞

Intercept (a)
- Value of Y when X = 0
- Baseline value of outcome

Interpretation Example
Equation: Y = 90 − 2X
Where: - Y = final exam score - X = number of absences
Interpretation: - Intercept (90): Average score when absences = 0 - Slope (−2): Each
additional absence reduces average score by 2 marks

<!-- page 3 -->

### Coefficient of Determination (R²)
- Measures proportion of total variation in Y explained by X
- R² ranges from 0 to 1
Interpretation: - R² = 0.80 means 80 percent of variation in Y is explained by X

Adjusted R²
Adjusted R² accounts for number of predictors in the model.
Key points: - Penalizes unnecessary predictors - More reliable for multiple linear
regression - Useful for comparing models with different numbers of independent
variables

Assumptions of Linear Regression
Major assumptions: - Linearity - Normality of residuals - Homoscedasticity - No
multicollinearity - Independence of errors

### Normality of Residuals
- Residuals should follow normal distribution
- Diagnosed using histogram, box plot, or normal probability plot
If violated: - Minor deviation can be ignored - Severe deviation requires transformation
(log X, log Y)

Linearity
- Relationship between X and Y must be linear
- Checked using scatter plot

Homoscedasticity
- Constant variance of residuals across predicted values
- Checked using residual vs predicted value plot
Violation leads to: - Inefficient t-tests - Increased Type II error

<!-- page 4 -->

Multicollinearity
- Strong correlation among independent variables
- Occurs only in multiple linear regression
Examples: - Weight and BMI - Waist circumference and waist–hip ratio

### Effects of Multicollinearity
- Inflated standard errors
- Unstable regression coefficients
- High R² with non-significant predictors

### Detection of Multicollinearity
- Variance Inflation Factor (VIF)
  - VIF > 5: needs investigation
  - VIF > 10: serious multicollinearity
- Tolerance
  - < 0.20: suspicious
  - < 0.10: serious issue

### Remedies for Multicollinearity
- Remove one of the correlated variables
- Combine variables into a single composite variable

### Independence of Errors
- Residuals should not be correlated over time
- Checked using residual plots and Durbin–Watson test
Durbin–Watson interpretation: - Value ≈ 2: no autocorrelation - Acceptable range: 1.5 to
2.5

Simple vs Multiple Linear Regression
Feature | Simple | Multiple |
Outcome variable | Continuous | Continuous |
Independent variables | One | More than one |
Coefficients | Single slope | Partial slopes |
Use of adjusted R² | Not essential | Essential |

<!-- page 5 -->

### Exam Pearls
- Regression predicts outcome, correlation does not
- Outcome variable must be continuous
- Residual = observed − predicted value
- Principle of least squares minimizes total residual error
- Slope indicates average change in outcome
- R² shows goodness of fit
- Adjusted R² preferred in multiple regression
- Multicollinearity affects reliability, not bias
- VIF > 10 indicates serious multicollinearity
- Regression does not automatically imply causation
