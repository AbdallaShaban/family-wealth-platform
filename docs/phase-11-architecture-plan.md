# Phase 11 — Architecture & Scope Plan: Institutional Wealth Resilience & Stress Testing Engine

**STATUS: DRAFT — PENDING USER APPROVAL**  
**IMPLEMENTATION: NOT STARTED**  
**DATE:** 2026-09-09  
**AUTHORITATIVE BASELINE COMMIT:** `8fb2727d54e7fb7d22072be9e41fafb845bf3b90`  
**PRE-PHASE VERIFIED BACKUP:** `D:\نسخ احتياطى\5\FAMILY_phase_10_FINAL_2026-09-08.zip` (1,004,347 bytes)  
**ROLE:** Principal Software Architect + FinTech Systems Auditor  

---

## 1. EXECUTIVE SUMMARY & ARCHITECTURAL FOUNDATION

The FAMILY platform has reached institutional financial and engineering maturity across Phases 1 through 10:
* **Double-Entry General Ledger & Lot Accounting** (Phases 1–7): Cryptographically balanced debits/credits (`assertBalanced`), multi-currency base conversion, FIFO lot matching, and realized P&L accounting.
* **Platform Operations & Governance** (Phase 8): Four-eyes approval workflows, Super Admin tenant control, book-to-market reconciliation, and unified in-memory caching.
* **Enterprise Financial Statements** (Phase 9A): GAAP/IFRS-aligned Statement of Financial Position, Statement of Activities, Direct Cash Flow, Changes in Equity, and Economic Net Worth Bridge across Invariants A–G and Controls H–J.
* **Wealth Health Score & Deterministic FIRE Engine** (Phase 9B): Evaluates portfolio health across **six core dimensions**:
  1. *Liquidity*
  2. *Debt Sustainability*
  3. *Savings Velocity*
  4. *Portfolio Diversification*
  5. *Resilience & Protection*
  6. *FI Progress*
* **Institutional Investment Performance & Portfolio Attribution Engine** (Phase 10): GIPS-aligned Time-Weighted Return (TWR) with sub-period cash-flow chaining, Money-Weighted Return (MWR / IRR) via 40-digit Decimal.js Newton-Raphson solver with bisection fallback, Benchmark Alpha/Beta, Annualized Volatility, Sharpe Ratio, High-Water Mark Drawdown tracking, Asset-Class Attribution, and 6-stage Capital Growth Bridge.

### The Strategic Family Office Dilemma
With Phase 10 complete, the platform provides complete clarity on **where the family has been** (historical performance and risk) and **where it stands today** (audited balance sheet and economic net worth).

However, the primary strategic question confronting Family Principals, Trustees, and Investment Committees remains:
> *"How resilient is our family wealth against future macroeconomic crises, stagflation, currency devaluations, or severe market drawdowns? What is our true probability of capital preservation over a 10, 20, or 30-year multi-generational horizon? How many months of liquidity runway do we have before we are forced to liquidate illiquid assets at a distressed haircut? What are our forward-looking Value at Risk (VaR) and Expected Shortfall (CVaR) metrics?"*

Existing planning capabilities in `planningMath.ts` and `scenarioMath.ts` are single-variable deterministic equations that explicitly disclaim:
```typescript
/** Deterministic retirement/FI scenario; no probability of success is claimed. */
```
There is currently **zero forward-looking stochastic simulation (Monte Carlo)**, **zero macro factor stress testing**, and **zero multi-tiered liquidity runway modeling** tied directly to the live multi-asset portfolio.

This final architecture plan establishes the authoritative specification for:
**PHASE 11 — Institutional Wealth Resilience & Stress Testing Engine**.

---

## 2. STRICT EPISTEMIC CLASSIFICATION: FACTS vs. MARKET DATA vs. ASSUMPTIONS vs. OUTPUT

To ensure institutional credibility and eliminate misleading claims, every datum and variable in Phase 11 is strictly categorized into one of four epistemic tiers:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   EPISTEMIC DATA CLASSIFICATION                                         │
├───────────────────────────────┬─────────────────────────────────────────────────────────────────────────┤
│ Tier A: AUTHORITATIVE FACTS   │ Unimpeachable ledger records, cash balances, quantities, debts, lots,   │
│                               │ and legal policies stored in the 56-table relational schema.            │
├───────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
│ Tier B: ACTUAL MARKET DATA    │ Real-world spot prices and valuation snapshots captured in              │
│                               │ priceQuotes, fxRates, and specialAssetValuations.                       │
├───────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
│ Tier C: MODEL ASSUMPTIONS     │ Statistical parameters, macro shock percentages, liquidity haircuts,    │
│         & PRIORS              │ covariance matrices, and inflation rates (NOT empirical facts).         │
├───────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
│ Tier D: SIMULATION OUTPUT     │ Derived stochastic paths, percentile cones, VaR, CVaR, and ruin        │
│                               │ probabilities (analytical read-models, NEVER accounting facts).        │
└───────────────────────────────┴─────────────────────────────────────────────────────────────────────────┘
```

### Detailed Breakdown:
* **Tier A (Authoritative Financial Facts):**
  - General ledger lines (`journal_lines`, `journal_entries`)
  - Account balances (`accounts`)
  - Position quantities (`positions`)
  - Investment tax lots & cost bases (`investment_lots`, `lot_matches`)
  - Contractual debt obligations & interest terms (`debts`, `debt_payments`)
  - Official valuation snapshots (`official_valuation_snapshots`)
  - Contractual insurance terms (`insurance_policies`, `insurance_premium_payments`)
  - Historical cash movements (`financial_events`)
* **Tier B (Actual Market Data):**
  - Recent price quotes (`price_quotes.price`, `asOf`)
  - Foreign exchange rates (`fx_rates.rate`)
  - Real estate / private asset appraisal history (`special_asset_valuations`)
  - Valuation provenance records (`valuation_provenance`)
* **Tier C (Model Assumptions & Priors — NOT Historical Facts):**
  - Expected annual returns per asset class ($\mu_k$)
  - Asset class volatility priors ($\sigma_k$)
  - Asset class correlation prior matrix ($\mathbf{R}$)
  - Macroeconomic stress shock percentages (e.g., Equities $-45\%$, Real Estate $-25\%$)
  - Marketable liquidity haircuts ($\delta_{liq} = 5\%\text{--}15\%$)
  - Distressed fire-sale haircuts ($\delta_{distressed} = 25\%\text{--}40\%$)
  - Inflation rate assumptions ($i$)
* **Tier D (Simulation Output — Analytical Read-Models):**
  - Monte Carlo simulated wealth paths ($W_m^{(n)}$)
  - Percentile distribution cones ($P_{10}, P_{25}, P_{50}, P_{75}, P_{90}$)
  - Monte Carlo Value at Risk ($\text{VaR}_{95\%}, \text{VaR}_{99\%}$)
  - Conditional Value at Risk / Expected Shortfall ($\text{CVaR}_{95\%}, \text{CVaR}_{99\%}$)
  - Probability of capital ruin / exhaustion ($P_{ruin}$)
  - Liquidity runway in months under stressed net cash burn

**Critical Rule:** Tiers C and D will **NEVER** be represented as accounting facts, historical facts, or guaranteed forecasts.

---

## 3. HISTORICAL CRISIS DATA STATUS & PARAMETRIC TERMINOLOGY

### 3.1 Historical Data Audit: Empirical Quotes are Unavailable
A strict audit of the 56-table MySQL schema confirms that **the database does NOT contain multi-decade historical daily quote series** for past financial crises (e.g., the 1973 Stagflation, 2008 GFC, or 2020 COVID crash).
The `priceQuotes` table stores recent quotes for held securities; it does not contain synchronized historical time series for global indices, real estate indices, or commodities over past decades.

### 3.2 Mandatory Terminology Rules
* **Prohibited Terms:** "Historical backtest", "Historical replay", "Empirical 2008 simulation", "100% data sufficient for historical crisis".
* **Approved Mandatory Terminology:**
  - `"Parametric Macro Stress Scenario"`
  - `"2008-inspired Parametric Stress Scenario"`
  - `"1970s-inspired Stagflation Parametric Stress Scenario"`
  - `"2020-inspired COVID Liquidity Parametric Stress Scenario"`

### 3.3 Parametric Stress Scenario Specifications:
Every stress scenario is classified strictly as a **Model Assumption Vector** applied to live Tier A portfolio holdings:

| Scenario Name | Epistemic Classification | Asset-Level Shock Parameters (Model Assumptions) | Provenance / Calibration Basis |
| :--- | :---: | :--- | :--- |
| **2008-inspired Parametric Stress Scenario** | MODEL ASSUMPTION | Equities: $-45.0\%$<br>Real Estate: $-25.0\%$<br>Credit Spreads: $+250\text{ bps}$<br>Gold: $+15.0\%$<br>Cash Yield: $-200\text{ bps}$ | Calibrated based on S&P 500, Case-Shiller, and Baa spread drawdowns during Oct 2007 – Mar 2009. |
| **1970s-inspired Stagflation Parametric Stress Scenario** | MODEL ASSUMPTION | Inflation: $+600\text{ bps}$<br>Interest Rates: $+400\text{ bps}$<br>Equities: $-25.0\%$<br>Cash Real Purchasing Loss: $-10.0\%$<br>Gold: $+40.0\%$ | Calibrated based on 1973–1975 global stagflation and CPI surge. |
| **2020-inspired COVID Liquidity Parametric Stress Scenario** | MODEL ASSUMPTION | Equities: $-35.0\%$<br>Commodities / Oil: $-45.0\%$<br>Real Estate: $-10.0\%$<br>Immediate Liquidity Demand Spike: $+30\%$ | Calibrated based on Feb–Mar 2020 market drawdown and liquidity freeze. |
| **Currency Devaluation Parametric Stress Scenario** | MODEL ASSUMPTION | Base Currency: $-30.0\%$ vs USD/EUR<br>Foreign Assets: $+42.8\%$ in local base terms<br>Domestic Inflation Shock: $+800\text{ bps}$ | Parametric model of emerging market currency pegs under balance of payments stress. |
| **Global Rate Hike Parametric Stress Scenario** | MODEL ASSUMPTION | Yield Curve Shift: $+300\text{ bps}$<br>Fixed Income Price: $-(\text{Duration} \times 3.0\%)$<br>Debt Service: Recalculated with `annualInterestRate + 3%` | Calibrated based on 2022–2023 global monetary tightening cycle. |

---

## 4. MODEL PRIOR TRANSPARENCY & ASSET-CLASS COVARIANCE SPECIFICATION

Because multi-year synchronized price series across all asset classes (especially illiquid real estate and private holdings) are not present in the local database, the engine operates on a **Transparent Hybrid Model**:
1. **Empirical Volatility (where $N \ge 30$):** If an individual security has $\ge 30$ historical quotes in `priceQuotes`, compute empirical annualized log-return volatility $\sigma_{emp} = \text{std}(\ln(P_t/P_{t-1})) \times \sqrt{252}$.
2. **Institutional Baseline Priors:** Where quotes are sparse or absent, the model applies established institutional priors, fully disclosed and modifiable by the user.

### 4.1 Authoritative Institutional Priors Table
* **Model Version:** `mc-v1.0.0`
* **Effective Date:** 2026-09-09
* **Confidence Label:** `PARAMETRIC_PRIOR`

| Parameter Name | Asset Class Category | Default Prior Value | Unit | Provenance / Source Basis | Governance Class |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `equity_expected_return` | Public Equities | `0.0800` (8.0%) | Annualized Decimal | Global Capital Market Assumptions (LTCMA) | System Default |
| `equity_volatility` | Public Equities | `0.1800` (18.0%) | Annualized Decimal | Long-term MSCI World / S&P 500 historical $\sigma$ | System Default |
| `fixed_income_expected_return`| Fixed Income / Sukuk | `0.0450` (4.5%) | Annualized Decimal | Global Investment Grade / Sukuk yield-to-maturity | System Default |
| `fixed_income_volatility` | Fixed Income / Sukuk | `0.0650` (6.5%) | Annualized Decimal | Bloomberg Aggregate Bond Index historical $\sigma$ | System Default |
| `real_estate_expected_return` | Real Estate / Property | `0.0600` (6.0%) | Annualized Decimal | Long-term commercial & residential unlevered return | System Default |
| `real_estate_volatility` | Real Estate / Property | `0.1200` (12.0%) | Annualized Decimal | NCREIF / Transaction-based appraisal volatility | System Default |
| `gold_expected_return` | Gold & Precious Metals| `0.0500` (5.0%) | Annualized Decimal | Long-term gold real purchasing power trend | System Default |
| `gold_volatility` | Gold & Precious Metals| `0.1600` (16.0%) | Annualized Decimal | London Bullion Market Association (LBMA) $\sigma$ | System Default |
| `cash_expected_return` | Cash & Equivalents | `0.0300` (3.0%) | Annualized Decimal | Short-term money market / central bank base rate | System Default |
| `cash_volatility` | Cash & Equivalents | `0.0100` (1.0%) | Annualized Decimal | Money market net asset value stability | System Default |

### 4.2 Asset-Class Correlation Prior Matrix ($\mathbf{R}$)
A symmetric, mathematically positive semi-definite matrix ($\mathbf{R} \in \mathbb{R}^{5 \times 5}$):

$$\mathbf{R} = \begin{pmatrix} 
1.00 & 0.15 & 0.40 & 0.05 & 0.00 \\
0.15 & 1.00 & 0.20 & 0.10 & 0.05 \\
0.40 & 0.20 & 1.00 & 0.00 & 0.00 \\
0.05 & 0.10 & 0.00 & 1.00 & 0.00 \\
0.00 & 0.05 & 0.00 & 0.00 & 1.00 
\end{pmatrix}$$
*(Rows/Columns: Equities, Fixed Income, Real Estate, Gold, Cash)*

---

## 5. MONTE CARLO MATHEMATICAL ENGINE & REPRODUCIBILITY

### 5.1 Simulation Equation
Multi-asset Geometric Brownian Motion (GBM) evaluated across discrete monthly time-steps ($\Delta t = 1/12$ years):
$$S_k(m) = S_k(m-1) \cdot \exp\left( \left(\mu_k - \frac{1}{2}\sigma_k^2\right)\Delta t + \sigma_k \sqrt{\Delta t} \cdot \epsilon_k(m) \right)$$
where:
* $S_k(m)$ is the value of asset class $k$ at month $m$.
* $\vec{\epsilon}(m) \in \mathbb{R}^K$ is a vector of correlated standard normal random variables.

### 5.2 Correlated Random Vector Generation
1. **Cholesky Factorization:** Compute unique lower-triangular matrix $\mathbf{L}$ such that:
   $$\mathbf{L} \mathbf{L}^T = \mathbf{R}$$
   If $\mathbf{R}$ has eigenvalues $\le 0$ due to user customization, apply Higham's nearest positive semi-definite matrix projection.
2. **Box-Muller Normal Generation:** Given independent uniform pseudo-random numbers $U_1, U_2 \sim \mathcal{U}(0, 1)$:
   $$Z_1 = \sqrt{-2\ln U_1}\cos(2\pi U_2), \quad Z_2 = \sqrt{-2\ln U_1}\sin(2\pi U_2)$$
3. **Correlation Coupling:**
   $$\vec{\epsilon} = \mathbf{L} \vec{Z}$$

### 5.3 Deterministic Reproducibility Rule
* **Forbidden:** Native unseeded `Math.random()`.
* **Mandated:** Pure 32-bit seeded pseudo-random number generator (**Mulberry32** algorithm) implemented natively in TypeScript.
* **Deterministic Seed Policy:** Input integer `seed` (default: `421337`).
* **Model Version:** Tagged in metadata as `mc-v1.0.0`.
* **Reproducibility Invariant:**
  $$\text{Same Authoritative Facts} + \text{Same Assumptions} + \text{Same Seed} + \text{Same Model Version} \implies \text{Bit-for-Bit Identical Results}.$$

### 5.4 Monthly Wealth & Cash Outflow Recurrence
At each monthly step $m \in \{1, \dots, 12 \times T\}$:
1. Advance stochastic asset values $S_k(m)$.
2. Calculate monthly non-discretionary cash outflow:
   $$\text{Outflow}(m) = \text{DebtService}(m) + \text{InsurancePremiums}(m) + \text{EssentialSpending}(m)$$
3. Deduct $\text{Outflow}(m)$ from liquid cash ($S_{cash}$). If cash is exhausted, trigger simulated rebalancing liquidation.
4. If total portfolio wealth $W(m) = \sum_{k=1}^K S_k(m) \le 0$, mark path as **Capital Ruin** at month $m$.

---

## 6. VALUE AT RISK (VaR) & CONDITIONAL VaR (CVaR) SPECIFICATION

### 6.1 Epistemic Status
* **Historical Empirical VaR:** **UNAVAILABLE** (insufficient daily portfolio history).
* **Monte Carlo VaR:** **SUPPORTED & PRIMARY** (derived from simulated empirical return distribution across $N$ paths).
* **Parametric VaR:** **SUPPORTED & SECONDARY** (analytical Gaussian cross-check).

### 6.2 Loss Convention & Units
All VaR and CVaR figures are expressed strictly as **Loss Metrics** (positive numbers representing loss) and reported in two parallel, unambiguous units:
1. **Percentage Loss ($\% \text{ of portfolio}$):** Relative loss of initial portfolio value $W_0$.
2. **Absolute Currency Loss (Base Currency):** Monetary loss in workspace base currency (e.g., SAR, USD).
*Units will never be mixed or ambiguous.*

### 6.3 Mathematical Definitions:
* **Time Horizons:** 1-month ($\Delta t = 1/12$) and 1-year ($\Delta t = 1.0$).
* **Confidence Levels:** 95% ($\alpha = 0.05$) and 99% ($\alpha = 0.01$).
* **Monte Carlo $\text{VaR}_\alpha$:**
  Given ordered simulated portfolio value changes $\Delta W_{(1)} \le \Delta W_{(2)} \le \dots \le \Delta W_{(N)}$:
  $$\text{VaR}_\alpha = -\Delta W_{(\lfloor \alpha N \rfloor)}$$
* **Monte Carlo $\text{CVaR}_\alpha$ (Expected Shortfall):**
  The average loss across all simulation paths in the tail worse than $\text{VaR}_\alpha$:
  $$\text{CVaR}_\alpha = -\frac{1}{K_{tail}} \sum_{i=1}^{K_{tail}} \Delta W_{(i)}, \quad K_{tail} = \lfloor \alpha N \rfloor$$
* **Analytical Parametric $\text{VaR}_\alpha$:**
  $$\text{VaR}_{\alpha, \Delta t} = -(\mu_p \Delta t - Z_\alpha \sigma_p \sqrt{\Delta t}) \cdot W_0$$
  where $Z_{0.95} = 1.64485$, $Z_{0.99} = 2.32635$, and $\sigma_p = \sqrt{\mathbf{w}^T \mathbf{\Sigma} \mathbf{w}}$.

---

## 7. LIQUIDITY STRESS LADDER: METHODOLOGY & FACTUAL CONSTRAINTS

The Liquidity Ladder models cash burn resilience under stressed revenues without claiming guaranteed liquidation timing.

### 7.1 Multi-Tier Liquidity Classification:
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   LIQUIDITY STRESS LADDER TIERS                                        │
├─────────┬──────────────────────────┬─────────────────────────────┬─────────────┬───────────────────────┤
│ Tier    │ Designation              │ Authoritative Assets        │ Haircut     │ Epistemic Status      │
├─────────┼──────────────────────────┼─────────────────────────────┼─────────────┼───────────────────────┤
│ Tier 1  │ Immediate Liquidity      │ Cash & bank accounts        │ 0%          │ Authoritative Fact    │
│ Tier 2  │ Marketable Liquidity     │ Public equities, gold       │ 5% – 15%    │ Model Assumption      │
│ Tier 3  │ Illiquid / Strategic     │ Real estate, private equity │ 25% – 40%   │ Model Assumption      │
└─────────┴──────────────────────────┴─────────────────────────────┴─────────────┴───────────────────────┘
```

1. **Tier 1 — Immediate Liquidity:**
   - *Assets:* Cash on hand, demand deposits in `accounts` where `accountType IN ('asset_cash', 'asset_banking')`.
   - *Valuation:* Ledger book value in base currency (Authoritative Fact).
   - *Haircut:* $0\%$.
   - *Stress Interpretation:* Readily available funds to absorb immediate cash burn.
2. **Tier 2 — Marketable Liquidity:**
   - *Assets:* Public equities, liquid mutual funds, Sukuk in `positions` / `instruments`, physical gold in `specialAssets`.
   - *Valuation:* Recent quotes in `priceQuotes` or `specialAssetValuations`.
   - *Haircut:* Stressed marketable haircut $\delta_{liq} = 5\%\text{--}15\%$ (Model Assumption).
   - *Stress Interpretation:* Convertible to cash with market price impact; **no fixed liquidation timing is guaranteed**.
3. **Tier 3 — Illiquid / Strategic Assets:**
   - *Assets:* Physical real estate, private operating equity, collectibles in `specialAssets`.
   - *Valuation:* Appraisals in `specialAssetValuations`.
   - *Haircut:* Distressed fire-sale haircut $\delta_{distressed} = 25\%\text{--}40\%$ (Model Assumption).
   - *Stress Interpretation:* Illiquid capital; forced liquidation incurs severe value destruction.

### 7.2 Outflow Obligations (Factual Constraints):
* **Contractual Debt Service (Authoritative Fact):** Derived from `debts.minimumPayment` and `debts.paymentDay` where `status = 'active'`.
* **Contractual Insurance Premiums (Authoritative Fact):** Derived from `insurancePolicies.premiumAmount`, `premiumCadence`, and `endsAt` where `status = 'active'`.
* **Essential Family Spending (Authoritative Fact):** Derived from historical `financialEvents` where category `isEssential = true`, or active `budgets`.
* **Explicit Exclusions:** Private equity capital call schedules and tenant lease receivables are **EXCLUDED** because no relational tables exist for them.

---

## 8. PLANNING SCENARIOS SAFETY & GOVERNANCE

### 8.1 Safety of `planning_scenarios`
Table `planning_scenarios` stores **analytical scenarios, not accounting facts**:
* Column `scenarioType`: MySQL `ENUM('debt', 'retirement', 'emergency', 'cash_flow')`.
* Column `assumptions`: `JSON NOT NULL`.
* Column `result`: `JSON NOT NULL`.

#### Zero-Migration Persistence Architecture:
To avoid database migrations altering the MySQL enum:
1. **Primary Mode:** Simulations execute as pure in-memory read models cached in `readModelCache.ts`.
2. **Named Snapshot Persistence:** When a user explicitly saves a simulation, it is persisted with `scenarioType = 'cash_flow'` (for liquidity runway) or `'retirement'` (for multi-year capital preservation), carrying an authoritative discriminator within `assumptions`:
   ```json
   {
     "engine": "wealth_resilience_v1",
     "modelVersion": "mc-v1.0.0",
     "scenarioSubtype": "macro_stress",
     "governanceClass": "user_custom",
     "seed": 421337,
     "asOf": 1725840000000,
     "inputDataQuality": "medium",
     "parameters": {
       "shockType": "gfc_2008_inspired",
       "haircuts": { "equity": "-0.45", "realEstate": "-0.25" }
     },
     "provenance": {
       "baseCurrency": "SAR",
       "baselineNetWorth": "12500000.00",
       "snapshotHash": "sha256:..."
     }
   }
   ```

### 8.2 Scenario Governance Classes
The platform enforces three strict governance classes:
1. **Class A: SYSTEM DEFAULT** (Pre-calibrated institutional baseline parameters; read-only).
2. **Class B: USER CUSTOM** (Parameters customized by the family office user/advisor).
3. **Class C: EXTERNALLY SOURCED / PROVENANCE-BACKED** (Parameters imported from external institutional research with recorded citations).
*Governance Rule:* The UI must badge every simulation with its governance class. User overrides must never alter authoritative financial facts.

---

## 9. DATA CONFIDENCE MODEL

Every simulation input is tagged with an explicit Data Confidence Label:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     DATA CONFIDENCE TAXONOMY                                           │
├───────────────┬────────────────────────────────────────────────────────────────────────────────────────┤
│ HIGH          │ Direct authoritative general ledger facts, bank balances, contractual debts.          │
├───────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
│ MEDIUM        │ Recent market quotes (N >= 30 observations), official valuation snapshots < 90 days.   │
├───────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
│ LOW           │ Stale quotes (> 90 days), unappraised special assets, illiquid holdings.               │
├───────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
│ UNAVAILABLE   │ Multi-decade historical crisis tick series, empirical multi-asset covariance.          │
└───────────────┴────────────────────────────────────────────────────────────────────────────────────────┘
```

### Composite Simulation Confidence Rule:
The simulation output inherits the lowest confidence level of its material inputs.
If $> 20\%$ of portfolio value relies on priors or low-confidence inputs, the output displays a prominent Arabic disclaimer badge:
> *"تنبيه حوكمة: تعتمد نتائج المحاكاة جزئياً على افتراضات معيارية مسبقة نظراً لمحدودية السلاسل الزمنية التاريخية للأصول غير المسجلة؛ لا تمثل النتائج حقائق قطعية أو ضمانات مستقبلية."*

---

## 10. COMPREHENSIVE CACHE INVALIDATION ARCHITECTURE

Phase 11 strictly reuses `server/readModelCache.ts`. A second cache is **strictly prohibited**.

### 10.1 Delimiter-Safe Cache Keys:
* Baseline Stress Profile: `stress-testing:${workspaceId}:profile:${asOfDate}` (TTL: 10,000 ms)
* Macro Shock: `stress-testing:${workspaceId}:macro:${shockType}:${asOfDate}` (TTL: 30,000 ms)
* Monte Carlo: `stress-testing:${workspaceId}:mc:${horizonYears}:${iterations}:${seed}:${spendingHash}` (TTL: 60,000 ms)
* Liquidity Runway: `stress-testing:${workspaceId}:runway:${haircutPercent}:${asOfDate}` (TTL: 15,000 ms)
* **Unified Invalidation Prefix:** `stress-testing:${workspaceId}:`

### 10.2 Exhaustive Mutation Invalidation Paths:
The invalidation hook `invalidateReadModelCache('stress-testing:${workspaceId}:')` must execute across all mutation entry points:
1. **`server/familyLedger.ts`:** `postCashEvent`, `postImportedCashBatch`, `reverseImportedCashBatch`, `revalueAssetAccount`, `createDebt`, `postDebtPayment`.
2. **`server/familyRouter.ts`:** `trading.postTradeEvent`, `lots.transfer`, `lots.stockSplit`, `specialAssets.create`, `specialAssets.revalue`, `specialAssets.recordYahooGoldValuation`, `debts.create`, `debts.postPayment`, `insurance.create`, `insurance.postPremium`, `insurance.markReceived`, `prices.refreshQuotes`, `fx.refreshRates`, `planning.createScenario`, `retirement.upsert`, `risk.upsertAllocationTargets`.
3. **`server/wealthHealthRouter.ts`:** `saveAssumptions`.
4. **`server/officialValuation.ts`:** `captureOfficialValuationSnapshot`.
5. **`server/marketRefresh.ts`:** Automated background market refresh handler.

---

## 11. ACCOUNTING SOVEREIGNTY

Stress Testing is **100% read-only**.
* **Zero writes to:** `journal_entries`, `journal_lines`, `financial_events`, `accounts`, `positions`, `investment_lots`, `lot_matches`, or `official_valuation_snapshots`.
* Simulation outputs remain derived analytical results and never mutate book equity or tax basis.

---

## 12. ZERO-MIGRATION VERIFICATION

* **Is Zero Migration honestly possible?** **YES.**
  - Live portfolio facts are read from existing tables (`accounts`, `positions`, `instruments`, `specialAssets`, `debts`).
  - Model assumptions are passed via tRPC input payloads or loaded from transparent in-memory institutional priors.
  - Scenario snapshots are stored within existing `planning_scenarios.assumptions` JSON.
  - Exactly 56 tables and 35 migrations (`0000–0034`) are preserved without diffs.

---

## 13. FINAL PHASE 11 SCOPE DEFINITION

**Title:** PHASE 11 — Institutional Wealth Resilience & Stress Testing Engine

### Included Core Capabilities:
1. **Parametric Macro Stress Testing:** 5 institutional macro scenarios (2008-inspired, Stagflation-inspired, COVID-inspired, Devaluation, Rate Hike) with dynamic user factor sliders.
2. **Multi-Asset Stochastic Monte Carlo Simulation:** 1,000 to 5,000 paths across 1 to 50 years with Cholesky correlation coupling and asset-class priors.
3. **Monte Carlo VaR & CVaR:** 1-month and 1-year horizons at 95% and 99% confidence, expressed in both percentage and base currency loss.
4. **Liquidity Stress Ladder:** Tier 1 Immediate, Tier 2 Marketable, and Tier 3 Illiquid assets evaluated against debt service, insurance, and essential living expenses under stressed revenue haircuts.
5. **Deterministic Reproducibility:** Mulberry32 PRNG ensuring bit-for-bit identical outputs for identical inputs, seeds, and model versions.
6. **Data Confidence Model:** Input-level confidence tracking (HIGH, MEDIUM, LOW, UNAVAILABLE) and composite confidence warnings.
7. **Scenario Governance:** Explicit badging of System Default vs User Custom vs Externally Sourced scenarios.

### Explicitly Excluded Capabilities:
* Historical empirical crisis backtesting
* Historical empirical VaR
* Private equity capital calls / uncalled commitments
* Multi-entity consolidation / SPV elimination
* Tax-loss harvesting across lots
* Shariah dividend purification
* Automated trade execution
* Portfolio allocation optimization algorithms

---

## 14. RECOMMENDED FUTURE IMPLEMENTATION FILES

Phase 11 implementation will touch exactly **7 files** (4 new files, 3 modifications):

### 14.1 Files to CREATE (4):
1. **`server/stressTestingMath.ts`**
   - *Responsibility:* Pure mathematical calculations (Mulberry32 PRNG, Box-Muller, Cholesky decomposition, GBM paths, VaR/CVaR, Liquidity ladder).
   - *Data Sources:* None (pure functions accepting validated data structures).
   - *Read/Write:* Pure compute.
   - *Dependencies:* `Decimal.js` (precision 40).
2. **`server/stressTestingRouter.ts`**
   - *Responsibility:* tRPC API endpoints for stress profile extraction, macro simulation, Monte Carlo execution, liquidity runway calculation, and scenario persistence.
   - *Data Sources:* `accounts`, `positions`, `instruments`, `specialAssets`, `debts`, `insurancePolicies`, `priceQuotes`, `planningScenarios`.
   - *Security:* Protected procedure scoped by `ensurePersonalFamilyContext`.
   - *Cache:* Reads/writes to `readModelCache.ts`.
3. **`server/stressTestingMath.test.ts`**
   - *Responsibility:* Exhaustive unit test suite covering mathematical precision, PRNG determinism, VaR, CVaR, and boundary conditions.
4. **`client/src/pages/StressTestingPage.tsx`**
   - *Responsibility:* Institutional Arabic RTL dashboard, crisis scenario cards, Monte Carlo cone charts, liquidity ladder burndown, sensitivity sliders, and privacy mode masking.

### 14.2 Files to MODIFY (3):
1. **`server/routers.ts`:** Mount `stressTesting: stressTestingRouter` onto `appRouter`.
2. **`server/familyLedger.ts`:** Hook cache invalidation for `stress-testing:${workspaceId}:`.
3. **`client/src/App.tsx`:** Register routes `/stress-testing` and `/family/stress-testing`.

---

## 15. TESTING REQUIREMENTS & TEST COUNT RANGE

A dedicated test suite `server/stressTestingMath.test.ts` will implement **28 to 36 tests** covering:
1. **Deterministic PRNG & Box-Muller (6 tests):**
   - Mulberry32 bit-for-bit repeatability across identical seeds.
   - Different seeds produce distinct paths.
   - Box-Muller standard normal mean ($\approx 0$) and standard deviation ($\approx 1$).
2. **Cholesky & Covariance Math (5 tests):**
   - Positive semi-definite matrix decomposition verification ($\mathbf{L}\mathbf{L}^T = \mathbf{R}$).
   - Higham projection handling of invalid correlation matrices.
3. **Parametric Macro Stress Shocks (6 tests):**
   - 2008-inspired shock calculation on multi-asset holdings.
   - 1970s stagflation real net worth erosion calculation.
   - Currency devaluation impact on multi-currency balances.
4. **Monte Carlo Percentile & Ruin Math (6 tests):**
   - Percentile monotonicity ($P_{10} \le P_{25} \le P_{50} \le P_{75} \le P_{90}$).
   - Ruin probability under extreme spending vs zero spending.
5. **VaR & CVaR Loss Calculations (5 tests):**
   - $\text{VaR}_{99\%} \ge \text{VaR}_{95\%}$ loss verification.
   - $\text{CVaR}_\alpha \ge \text{VaR}_\alpha$ loss verification.
   - Loss reporting in percentage vs base currency.
6. **Liquidity Stress Ladder (5 tests):**
   - Tier 1 cash exhaustion timing under 100% revenue loss.
   - Tier 2 liquidation haircut application.
   - Debt service priority ordering.
7. **Accounting Safety & Invariants (3 tests):**
   - Read-only execution verification (0 database writes).
   - Cache invalidation verification.

---

## 16. ACCEPTANCE CRITERIA FOR PHASE 11

1. **Accounting Sovereignty Preserved:** Zero writes to general ledger, positions, lots, accounts, or valuation snapshots.
2. **Zero Schema Changes:** Exactly 0 diffs in `drizzle/schema.ts`.
3. **Zero Migrations:** Exactly 35 migrations preserved. 0 new SQL files.
4. **Zero Package Changes:** Exactly 0 changes to `package.json` and `pnpm-lock.yaml`.
5. **Deterministic Invariant:** Identical inputs + seed + model version produce identical results down to 6 decimal places.
6. **Decimal Precision:** All financial aggregates computed via 40-digit `Decimal.js`.
7. **Cache Integrity:** Single cache reused with exhaustive invalidation across all ledger, trade, debt, and valuation mutations.
8. **Test Suite:** Existing 41 test suites pass; new suite passes with 28+ tests (total: **250+ tests**).
9. **TypeScript & Build:** `tsc --noEmit` and production build pass with 0 errors.
10. **Git Cleanliness:** Working tree 100% clean upon completion.

---

## 17. FINAL ARCHITECTURAL RECOMMENDATION

Proceed with **Option 1: Institutional Wealth Resilience & Stress Testing Engine** under the corrected epistemic and mathematical framework.

**IMPLEMENTATION STATUS:** NOT STARTED — Awaiting explicit user approval of this final plan.
