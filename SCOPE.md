# ExpenseLens - Project Scope (SCOPE.md)

ExpenseLens is a **Shared Expense Intelligence Platform** designed to solve complex multi-currency, membership timeline, and transaction auditing problems within shared flatmate spaces.

---

## 1. Core Feature Scope

### A. Authentication & Security
- **In-Scope**: Custom user registration and token-based authentication (`TokenAuthentication` in Django).
- **Out-of-Scope**: Social logins (Google, GitHub), multi-factor authentication (MFA).

### B. Group & Membership Timelines
- **In-Scope**: Dynamic group creation, custom group base currency, and **membership timelines** (join and leave dates per member).
- **Out-of-Scope**: Nested subgroups, sub-departments.

### C. Split Intelligence & Calculations
- **In-Scope**: Equal, Percentage, Share-based, and Exact splits.
  - **Timeline-Aware splits**: Equal splits automatically ignore members who were inactive on the expense date (e.g. Sam is excluded from March bills; Meera is excluded from April bills).
- **Out-of-Scope**: Recurring expense schedules, dynamic inflation adjustments.

### D. Multi-Currency Operations
- **In-Scope**: Support for expenses logged in any currency (e.g. USD). Dynamic lookup of exchange rates from a `CurrencyRate` table effective on the *expense date*.
- **Out-of-Scope**: Live real-time currency API synchronization.

### E. Settlement Engine
- **In-Scope**: Direct recording of settlements (paying roommates back).
  - **Greedy Debt Simplification**: Reduces the number of transactions to clear group debt (who pays whom and how much), solving Aisha's requirement of "one number per person."
- **Out-of-Scope**: Real-world payment gateway integrations (Razorpay, Stripe, UPI).

### F. CSV Ingestion & Import Intelligence
- **In-Scope**: Bulk parsing of expense spreadsheets.
  - **Metrics**: Parsed row statuses (Accepted, Flagged, Rejected).
  - **Health Score**: Ingestion quality rating based on parsing warnings and fatal errors.
  - **Import Report**: Markdown deliverable summarizing the batch ingestion run.
- **Out-of-Scope**: Excel (.xlsx) file direct binary parsing (CSV-only).

### G. Audit Center & Decision Trail
- **In-Scope**: Automated scan for 9 anomaly types (Duplicates, timeline conflicts, settlement-as-expense, currency issues, negative amounts, split mismatches, unknown members, missing payers).
  - **Decision Trail**: Immutable chronological history capturing operators' names, dates, resolution actions, and written justifications.
- **Out-of-Scope**: Automatic self-correction without operator confirmation.

---

## 2. Technical Scope

- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS v4.
- **Backend**: Django 5 + Django REST Framework + sqlite3 (local) / PostgreSQL (Neon production).
- **Architecture**: Single-page application (SPA) querying a RESTful API layer.
