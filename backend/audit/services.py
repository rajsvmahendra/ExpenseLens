from decimal import Decimal
from django.utils import timezone
from groups.models import GroupMembership
from .models import AuditAnomaly
from expenses.models import Expense, ExpenseSplit

class AnomalyDetectionService:
    @classmethod
    def detect_and_save(cls, expense):
        """
        Runs the 9 anomaly detection checks on a single expense instance.
        Updates or creates AuditAnomaly records accordingly.
        Unresolved anomalies of matching types for this expense are cleared before running.
        """
        # Clear existing unresolved anomalies for this expense to prevent stale data
        AuditAnomaly.objects.filter(expense=expense, is_resolved=False).delete()

        anomalies_to_create = []

        # 1. NEGATIVE_AMOUNT check
        if expense.amount_original <= Decimal('0.00'):
            anomalies_to_create.append(AuditAnomaly(
                group=expense.group,
                anomaly_type='NEGATIVE_AMOUNT',
                description=f"Expense '{expense.description}' has a negative or zero amount: {expense.amount_original}.",
                severity='HIGH',
                expense=expense,
                import_row=expense.import_row
            ))

        # 2. INVALID_DATE check
        today = timezone.localdate()
        if expense.expense_date > today:
            anomalies_to_create.append(AuditAnomaly(
                group=expense.group,
                anomaly_type='INVALID_DATE',
                description=f"Expense '{expense.description}' has a future date: {expense.expense_date} (Current: {today}).",
                severity='HIGH',
                expense=expense,
                import_row=expense.import_row
            ))

        # 3. MISSING_PAYER / UNKNOWN_MEMBER check
        if expense.paid_by is None:
            anomalies_to_create.append(AuditAnomaly(
                group=expense.group,
                anomaly_type='MISSING_PAYER',
                description=f"Expense '{expense.description}' does not specify a valid payer.",
                severity='HIGH',
                expense=expense,
                import_row=expense.import_row
            ))

        # 4. DUPLICATE_EXPENSE check
        # Check for other expenses with same group, original amount, date (+/- 1 day), and payer
        duplicates = Expense.objects.filter(
            group=expense.group,
            amount_original=expense.amount_original,
            paid_by=expense.paid_by,
            expense_date__range=(expense.expense_date - timezone.timedelta(days=1), expense.expense_date + timezone.timedelta(days=1))
        ).exclude(id=expense.id)

        if duplicates.exists():
            dup_ids = ", ".join(str(d.id)[:8] for d in duplicates)
            anomalies_to_create.append(AuditAnomaly(
                group=expense.group,
                anomaly_type='DUPLICATE_EXPENSE',
                description=f"Potential duplicate expense detected. Matches with: {dup_ids}.",
                severity='MEDIUM',
                expense=expense,
                import_row=expense.import_row,
                extra_data={'duplicate_ids': [str(d.id) for d in duplicates]}
            ))

        # 5. CURRENCY_ISSUE check
        # Original currency != group base currency AND exchange_rate is exactly 1.0 (fallback)
        if expense.currency_original.upper() != expense.group.base_currency.upper() and expense.exchange_rate == Decimal('1.00000000'):
            anomalies_to_create.append(AuditAnomaly(
                group=expense.group,
                anomaly_type='CURRENCY_ISSUE',
                description=f"Exchange rate is fallback (1.0) for foreign currency '{expense.currency_original}' (Group: {expense.group.base_currency}).",
                severity='MEDIUM',
                expense=expense,
                import_row=expense.import_row
            ))

        # 6. MEMBERSHIP_CONFLICT check
        # Check if any split member was not active on the expense date
        splits = expense.splits.all()
        for split in splits:
            member = split.member
            if member.joined_at > expense.expense_date or (member.left_at and member.left_at < expense.expense_date):
                anomalies_to_create.append(AuditAnomaly(
                    group=expense.group,
                    anomaly_type='MEMBERSHIP_CONFLICT',
                    description=f"Member '{member.name}' is included in the split but was not active on the expense date ({expense.expense_date}).",
                    severity='HIGH',
                    expense=expense,
                    import_row=expense.import_row,
                    extra_data={'member_id': str(member.id), 'member_name': member.name}
                ))

        # 7. SPLIT_SUM_MISMATCH check
        # Total sum of split calculated amounts must equal expense.amount_base (within 0.05 rounding error)
        total_split = sum(s.calculated_amount for s in splits)
        if abs(total_split - expense.amount_base) > Decimal('0.05') and splits.exists():
            anomalies_to_create.append(AuditAnomaly(
                group=expense.group,
                anomaly_type='SPLIT_SUM_MISMATCH',
                description=f"Sum of splits ({total_split}) does not match expense base amount ({expense.amount_base}).",
                severity='HIGH',
                expense=expense,
                import_row=expense.import_row,
                extra_data={'total_split': float(total_split), 'amount_base': float(expense.amount_base)}
            ))

        # 8. SETTLEMENT_AS_EXPENSE check
        # Check description keywords or splits pattern
        desc_lower = expense.description.lower()
        keywords = ["settle", "paid back", "transfer", "repay", "sent to", "received from"]
        has_keyword = any(k in desc_lower for k in keywords)
        
        # Check split pattern: split between exactly 2 people, payer and one other, where split is 100% of amount
        is_settlement_pattern = False
        if splits.count() == 1 and expense.paid_by:
            only_split = splits.first()
            if only_split.member != expense.paid_by and abs(only_split.calculated_amount - expense.amount_base) < Decimal('0.05'):
                is_settlement_pattern = True

        if has_keyword or is_settlement_pattern:
            anomalies_to_create.append(AuditAnomaly(
                group=expense.group,
                anomaly_type='SETTLEMENT_AS_EXPENSE',
                description=f"Expense '{expense.description}' matches a settlement pattern and should likely be logged as a direct Settlement.",
                severity='LOW',
                expense=expense,
                import_row=expense.import_row
            ))

        # Bulk create anomalies
        if anomalies_to_create:
            AuditAnomaly.objects.bulk_create(anomalies_to_create)

        return len(anomalies_to_create)
