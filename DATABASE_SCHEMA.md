# ExpenseLens - Database Schema Documentation (DATABASE_SCHEMA.md)

This document provides a detailed description of the ExpenseLens database schema.

---

## Entity Relationship Summary

```
                      +-------------------+
                      |       Group       |
                      +---------+---------+
                                | 1
                                |
             +------------------+------------------+
             | 1:N              | 1:N              | 1:N
     +-------v-------+  +-------v-------+  +-------v-------+
     |  Membership   |  |    Expense    |  |  Settlement   |
     +-------+-------+  +-------+-------+  +---------------+
             | 1                | 1
             |                  |
             |          +-------v-------+
             +----------> ExpenseSplit  | (N:1 on both)
             | 1:N      +---------------+
             |
             |          +---------------+
             +----------> CurrencyRate  | (1:N lookup)
                        +---------------+
```

---

## 1. Core Tables

### A. Group (`groups_group`)
Container for roommate sharing circles.
- `id` (UUID, Primary Key): Unique identifier.
- `name` (VARCHAR(255)): Name of the group.
- `description` (TEXT, Nullable): Optional description.
- `base_currency` (VARCHAR(10)): Defaults to `INR`. All splits and balances are converted to this currency.
- `created_at` (DATETIME): Ingestion date.

### B. GroupMembership (`groups_groupmembership`)
Timeline periods and names of participants.
- `id` (UUID, Primary Key)
- `group_id` (UUID, ForeignKey -> Group)
- `user_id` (INTEGER, ForeignKey -> Auth_User, Nullable): Links to system user if registered.
- `name` (VARCHAR(100)): Member name (e.g. Aisha, Rohan, Priya, Meera, Dev, Sam).
- `joined_at` (DATE): Start of active membership window.
- `left_at` (DATE, Nullable): End of active membership. Null represents currently active.
- *Unique Constraint*: (`group_id`, `name`)

### C. CurrencyRate (`groups_currencyrate`)
Historical exchange rate lookup table.
- `id` (UUID, Primary Key)
- `from_currency` (VARCHAR(10)): e.g. `USD`
- `to_currency` (VARCHAR(10)): e.g. `INR`
- `exchange_rate` (DECIMAL(18, 8)): Conversions value.
- `effective_date` (DATE): Date from which this rate is valid.
- *Unique Constraint*: (`from_currency`, `to_currency`, `effective_date`)

---

## 2. Transactional Tables

### D. Expense (`expenses_expense`)
Log of individual expense events.
- `id` (UUID, Primary Key)
- `group_id` (UUID, ForeignKey -> Group)
- `paid_by_id` (UUID, ForeignKey -> GroupMembership, Nullable): Roommate who paid.
- `description` (VARCHAR(255)): What was purchased.
- `amount_original` (DECIMAL(18, 2)): Face value of expense.
- `currency_original` (VARCHAR(10)): Face currency (e.g. USD).
- `exchange_rate` (DECIMAL(18, 8)): Converted rate looked up from CurrencyRate.
- `amount_base` (DECIMAL(18, 2)): calculated amount in base currency (`amount_original * exchange_rate`).
- `expense_date` (DATE): Transaction date.
- `import_row_id` (UUID, ForeignKey -> ImportRow, Nullable): References source CSV row.
- `is_settlement_hidden` (BOOLEAN): True if converted to settlement in Audit Center.

### E. ExpenseSplit (`expenses_expensesplit`)
Allocation shares for each participant.
- `id` (UUID, Primary Key)
- `expense_id` (UUID, ForeignKey -> Expense)
- `member_id` (UUID, ForeignKey -> GroupMembership): Split participant.
- `split_type` (VARCHAR(20)): EQUAL, PERCENTAGE, SHARE, EXACT.
- `value` (DECIMAL(12, 2)): User input parameter (e.g., share ratio, percentage, or exact amount).
- `calculated_amount` (DECIMAL(18, 2)): Pre-calculated consumer share in base currency.
- *Unique Constraint*: (`expense_id`, `member_id`)

### F. Settlement (`expenses_settlement`)
Payer-to-payee direct repayments.
- `id` (UUID, Primary Key)
- `group_id` (UUID, ForeignKey -> Group)
- `payer_id` (UUID, ForeignKey -> GroupMembership): Debtor clearing balance.
- `payee_id` (UUID, ForeignKey -> GroupMembership): Creditor receiving funds.
- `amount` (DECIMAL(18, 2)): Cash transferred in base currency.
- `date` (DATE)
- `notes` (TEXT, Nullable)

---

## 3. Ingestion & Audit Tables

### G. ImportBatch (`expenses_importbatch`)
Ingested spreadsheet uploads.
- `id` (UUID, Primary Key)
- `group_id` (UUID, ForeignKey -> Group)
- `uploaded_file_name` (VARCHAR(255))
- `import_timestamp` (DATETIME)
- `total_rows` (INTEGER)
- `accepted_rows` (INTEGER)
- `flagged_rows` (INTEGER)
- `rejected_rows` (INTEGER)
- `health_score` (DECIMAL(5, 2)): Data quality score out of 100.

### H. ImportRow (`expenses_importrow`)
Single CSV line tracking.
- `id` (UUID, Primary Key)
- `batch_id` (UUID, ForeignKey -> ImportBatch)
- `row_number` (INTEGER)
- `raw_row_json` (JSON): Raw key-value string pairs.
- `parsed_row_json` (JSON, Nullable): Parsed fields.
- `import_status` (VARCHAR(20)): ACCEPTED, FLAGGED, REJECTED.
- `error_message` (TEXT, Nullable)
- *Unique Constraint*: (`batch_id`, `row_number`)

### I. ImportReport (`expenses_importreport`)
Structured deliverables generated for import runs.
- `id` (UUID, Primary Key)
- `batch_id` (UUID, ForeignKey -> ImportBatch)
- `generated_at` (DATETIME)
- `report_data` (JSON): Summary metrics.
- `report_markdown` (TEXT): Markdown representation of report.

### J. AuditAnomaly (`audit_auditanomaly`)
Unresolved data quality exceptions flagged in the Audit Center.
- `id` (UUID, Primary Key)
- `group_id` (UUID, ForeignKey -> Group)
- `anomaly_type` (VARCHAR(50)): e.g. `DUPLICATE_EXPENSE`, `MEMBERSHIP_CONFLICT`, `SETTLEMENT_AS_EXPENSE`, etc.
- `description` (TEXT): Error description.
- `severity` (VARCHAR(10)): HIGH, MEDIUM, LOW.
- `is_resolved` (BOOLEAN): Defaults to False.
- `resolution_action` (VARCHAR(50), Nullable): e.g. MERGED, CONVERTED.
- `expense_id` (UUID, ForeignKey -> Expense, Nullable)
- `import_row_id` (UUID, ForeignKey -> ImportRow, Nullable)
- `extra_data` (JSON, Nullable): Diagnostic metadata.

### K. DecisionTrail (`audit_decisiontrail`)
Immutable record of operator decisions.
- `id` (UUID, Primary Key)
- `group_id` (UUID, ForeignKey -> Group)
- `user_id` (INTEGER, ForeignKey -> Auth_User, Nullable): User who took action.
- `action` (VARCHAR(100)): Action name (e.g. `RESOLVE_DUPLICATE_EXPENSE_MERGE`).
- `target_object_type` (VARCHAR(100)): Target model name (e.g. `AuditAnomaly`).
- `target_object_id` (VARCHAR(255)): Target UUID.
- `reasoning` (TEXT): Mandatory operator justification.
- `timestamp` (DATETIME)
