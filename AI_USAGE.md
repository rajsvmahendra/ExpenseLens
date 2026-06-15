# ExpenseLens - AI Usage Disclosure (AI_USAGE.md)

This document outlines how artificial intelligence was utilized in the conceptualization, design, and implementation of the ExpenseLens platform.

---

## 1. Code Generation Assistance

AI was used as a pair-programmer to build ExpenseLens:
- **Backend Architecture**: Assisted in drafting Django models (`Group`, `GroupMembership`, `CurrencyRate`, `Expense`, `ExpenseSplit`, `Settlement`, `ImportBatch`, `ImportRow`, `ImportReport`, `AuditAnomaly`, `DecisionTrail`).
- **Splitting Engine**: Helped write validation rules for percentage, exact, and share-based splits in `ExpenseSerializer` and the active member filter query.
- **Debt Simplification**: Co-authored the greedy simplification solver inside `BalanceService` to minimize transactions.
- **Frontend Views**: Guided the creation of the React TypeScript pages, connecting form elements to the REST API wrapper.

---

## 2. Prompting & Design Guidelines

AI was instructed to follow strict aesthetics inspired by premium tools (Linear, Notion, Revolut):
- **UI Design**: Minimal borders, low shadows, Plus Jakarta Sans font, and subtle warning alerts for flagged rows.
- **Strict Guidelines**: The assistant was restricted from creating silent mockup fallbacks during integration, forcing the React app to display a "Backend Not Connected" layout if Django is unavailable.
- **Workflow**: Enforced step-by-step creation of directories, setting configurations, writing business logic, and verifying build outcomes before moving forward.
