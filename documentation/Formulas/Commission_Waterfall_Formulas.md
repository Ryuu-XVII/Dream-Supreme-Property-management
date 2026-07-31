# Commission Waterfall

**Agent Net Payout — Formula Derivation & Master Equation**

---

## 1. Variable Definitions

| Symbol          | Parameter                        | Value from Image        |
| --------------- | -------------------------------- | ----------------------- |
| $S$             | Property Sale Price              | R1,540,000.00           |
| $r_g$           | Gross Commission Rate            | 5.5% (0.055)            |
| $v$             | Value Added Tax (VAT) Rate       | 15% (0.15)              |
| $r_{\text{pc}}$ | Property Center / Admin Fee Rate | 10% (0.10)              |
| $f_1, f_2$      | Franchise & Marketing Fee Rates  | 6% (0.06) and 2% (0.02) |
| $s_1$           | Tier 1 Split Rate                | 30% (0.30)              |
| $s_2$           | Company Split Rate               | 20% (0.20)              |

---

## 2. Step-by-Step Mathematical Waterfall

### Step 1 — Gross Commission & Tax Extraction

_Gross Commission Incl. VAT ($C_{\text{gross}}$):_

$$C_{\text{gross}} = S \times r_g$$

_Ex-VAT Commission Base ($C_{\text{ex}}$):_

$$C_{\text{ex}} = \frac{C_{\text{gross}}}{1 + v}$$

### Step 2 — Admin Deduction & Split Base Calculation

_Admin / PC Fee Amount ($F_{\text{pc}}$):_

$$F_{\text{pc}} = C_{\text{ex}} \times r_{\text{pc}}$$

_Net Commission Pool Base ($C_{\text{net}}$):_

$$C_{\text{net}} = C_{\text{ex}} - F_{\text{pc}} = C_{\text{ex}} \times (1 - r_{\text{pc}})$$

### Step 3 — Off-the-Top Fee Deductions

_Total Franchise/Marketing Fees ($F_{\text{fees}}$):_

$$F_{\text{fees}} = C_{\text{net}} \times (f_1 + f_2)$$

_Adjusted Split Pool ($P_0$):_

$$P_0 = C_{\text{net}} - F_{\text{fees}} = C_{\text{net}} \times (1 - f_1 - f_2)$$

### Step 4 — Cascading Split Deductions

_Tier 1 Split Balance ($P_1$):_

$$P_1 = P_0 \times (1 - s_1)$$

_Company Split / Final Net Payout ($A_{\text{net}}$):_

$$A_{\text{net}} = P_1 \times (1 - s_2)$$

---

## 3. Master Consolidated Closed-Form Equation

By substituting each step back into the final term, the Agent's Net Take-Home Payout ($A_{\text{net}}$) can be calculated in a single unified formula:

$$A_{\text{net}} = \left( \frac{S \times r_g}{1 + v} \right) \times (1 - r_{\text{pc}}) \times (1 - f_1 - f_2) \times (1 - s_1) \times (1 - s_2)$$

### Proof Verification (Using Row 1 Values)

$$A_{\text{net}} = \left( \frac{1{,}540{,}000 \times 0.055}{1.15} \right) \times (1 - 0.10) \times (1 - 0.06 - 0.02) \times (1 - 0.30) \times (1 - 0.20)$$

$$A_{\text{net}} = 73{,}652.1739 \times 0.90 \times 0.92 \times 0.70 \times 0.80 = \mathbf{\text{R}34{,}151.04}$$

> **AGENT NET TAKE-HOME: R 34,151.04**
