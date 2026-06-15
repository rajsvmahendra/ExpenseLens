# ExpenseLens - Architecture Decision Log (DECISIONS.md)

This document records the major design and technical choices made during the development of ExpenseLens.

---

## 1. Database & Model Design

### Decision: Storing Calculated Split Amounts Denormalized
- **Context**: Every expense has multiple splits. We could compute each member's split amount on-the-fly, or save it when the expense is created/updated.
- **Decision**: Denormalize and store `calculated_amount` in the `ExpenseSplit` model.
- **Rationale**: Balance calculations and "Explain My Balance" are read-heavy operations. Storing pre-calculated shares in the group's base currency reduces database query complexity and ensures fast response times.

### Decision: Direct AuditAnomaly Mapping
- **Context**: How to track ingestion warnings and data conflicts.
- **Decision**: Create a dedicated `AuditAnomaly` model instead of logging warnings inside text fields.
- **Rationale**: An interactive Audit Center requires filtering by anomaly type (e.g. `DUPLICATE_EXPENSE` vs `MEMBERSHIP_CONFLICT`), severity, and resolution status, which is only possible with a structured relational table.

---

## 2. Split & Currency Conversion Logic

### Decision: Historical Currency Lookup
- **Context**: Priya's USD trip expenses. Exchange rates fluctuate daily.
- **Decision**: Create a `CurrencyRate` table with an `effective_date` field. Write a lookup method `get_rate(from_curr, to_curr, date)` that selects the closest rate where `effective_date <= date` (ordered descending).
- **Rationale**: Avoids hardcoding rates and ensures historical expenses use the conversion rate valid on the day they occurred.

### Decision: Timeline-Aware Split Interceptors
- **Context**: Sam joining in mid-April (should not pay for March); Meera leaving end of March (should not pay for April).
- **Decision**: The backend `ExpenseSerializer` queries active memberships on the specific `expense_date`. If split type is `EQUAL` and no explicit splits are posted, it divides the amount only among active members.
- **Rationale**: Respects roommate date windows dynamically. If custom splits are posted that violate timeline windows, the backend registers a `MEMBERSHIP_CONFLICT` anomaly.

---

## 3. Algorithm Selection

### Decision: Greedy Debt Simplification
- **Context**: Aisha requested "one number per person: who pays whom and how much."
- **Decision**: Implement a **Greedy Debt Simplification Algorithm** in the `BalanceService` class.
- **Rationale**: Roommates shouldn't have to perform circular transfers (e.g. Rohan pays Priya, Priya pays Aisha, Aisha pays Rohan). The greedy solver runs in $O(N \log N)$ and minimizes the absolute number of bank transactions.

---

## 4. Frontend & Reliability

### Decision: Frontend Connection Guard
- **Context**: If the backend REST server is down, standard React apps fail silently or display blank screens.
- **Decision**: Implement a `BACKEND_DISCONNECTED` fetch interceptor in the API client and a layout-level guard.
- **Rationale**: Rather than crashing or using hidden mock data, the frontend cleanly intercepts the layout and displays a prominent **"Backend Not Connected"** error page.
