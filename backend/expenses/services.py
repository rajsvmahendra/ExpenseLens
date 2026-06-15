from decimal import Decimal
from django.db.models import Q
from groups.models import Group, GroupMembership
from .models import Expense, ExpenseSplit, Settlement

class BalanceService:
    @staticmethod
    def calculate_raw_balances(group_id):
        """
        Calculates the raw net balance for each member of a group.
        Net Balance = Total Paid (as payer of expenses) 
                      - Total Owed (from splits)
                      + Total Settlements Received
                      - Total Settlements Paid
        """
        # Get all memberships in the group
        memberships = GroupMembership.objects.filter(group_id=group_id)
        balances = {m.id: Decimal('0.00') for m in memberships}
        member_lookup = {m.id: m for m in memberships}

        # 1. Add credit for expenses paid by members
        # We only consider expenses that are NOT marked as hidden settlements
        expenses = Expense.objects.filter(group_id=group_id, is_settlement_hidden=False)
        for expense in expenses:
            if expense.paid_by_id in balances:
                balances[expense.paid_by_id] += expense.amount_base

        # 2. Subtract debt from splits
        splits = ExpenseSplit.objects.filter(expense__group_id=group_id, expense__is_settlement_hidden=False)
        for split in splits:
            if split.member_id in balances:
                balances[split.member_id] -= split.calculated_amount

        # 3. Adjust for settlements
        settlements = Settlement.objects.filter(group_id=group_id)
        for settlement in settlements:
            if settlement.payer_id in balances:
                balances[settlement.payer_id] -= settlement.amount  # Payer paid out, reducing their net debt
            if settlement.payee_id in balances:
                balances[settlement.payee_id] += settlement.amount  # Payee received cash, reducing their net credit

        return balances, member_lookup

    @classmethod
    def get_group_balance_summary(cls, group_id):
        """
        Returns a detailed summary of group balances, including raw values,
        breakdowns of paid vs owed, settlements, and simplified debts.
        """
        raw_balances, member_lookup = cls.calculate_raw_balances(group_id)
        
        # Calculate individual details
        member_summaries = []
        for member_id, net_balance in raw_balances.items():
            member = member_lookup[member_id]
            
            # Total expenses paid by this member
            total_paid = Expense.objects.filter(
                group_id=group_id, paid_by_id=member_id, is_settlement_hidden=False
            ).models.DecimalField() # Wait, we can sum this using Django aggregation
            
            from django.db.models import Sum
            paid_sum = Expense.objects.filter(
                group_id=group_id, paid_by_id=member_id, is_settlement_hidden=False
            ).aggregate(total=Sum('amount_base'))['total'] or Decimal('0.00')
            
            # Total splits owed by this member
            owed_sum = ExpenseSplit.objects.filter(
                expense__group_id=group_id, member_id=member_id, expense__is_settlement_hidden=False
            ).aggregate(total=Sum('calculated_amount'))['total'] or Decimal('0.00')

            # Settlements summary
            settlements_paid = Settlement.objects.filter(
                group_id=group_id, payer_id=member_id
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            
            settlements_received = Settlement.objects.filter(
                group_id=group_id, payee_id=member_id
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            member_summaries.append({
                'member_id': str(member.id),
                'name': member.name,
                'joined_at': member.joined_at.isoformat(),
                'left_at': member.left_at.isoformat() if member.left_at else None,
                'total_paid_expenses': float(paid_sum),
                'total_owed_splits': float(owed_sum),
                'total_settlements_paid': float(settlements_paid),
                'total_settlements_received': float(settlements_received),
                'net_balance': float(net_balance)
            })

        # Calculate simplified debts (who pays whom and how much)
        simplified_debts = cls.simplify_debts(raw_balances, member_lookup)

        return {
            'member_balances': member_summaries,
            'simplified_debts': simplified_debts
        }

    @classmethod
    def simplify_debts(cls, raw_balances, member_lookup):
        """
        Greedy debt simplification algorithm to minimize transaction count.
        Returns a list of simplified transactions: [{'from_member': ID, 'from_name': Name, 'to_member': ID, 'to_name': Name, 'amount': Amount}]
        """
        # Separate debtors and creditors
        debtors = []   # (member_id, debt_amount) where debt_amount is positive
        creditors = []  # (member_id, credit_amount) where credit_amount is positive

        for member_id, balance in raw_balances.items():
            # Apply threshold to avoid floating point precision noise
            if balance < Decimal('-0.01'):
                debtors.append((member_id, -balance))
            elif balance > Decimal('0.01'):
                creditors.append((member_id, balance))

        # Sort debtors and creditors by amount descending
        debtors.sort(key=lambda x: x[1], reverse=True)
        creditors.sort(key=lambda x: x[1], reverse=True)

        transactions = []

        d_idx = 0
        c_idx = 0

        while d_idx < len(debtors) and c_idx < len(creditors):
            debtor_id, debt_amt = debtors[d_idx]
            creditor_id, credit_amt = creditors[c_idx]

            # Find transaction amount
            trans_amt = min(debt_amt, credit_amt)
            
            if trans_amt > Decimal('0.01'):
                transactions.append({
                    'from_member_id': str(debtor_id),
                    'from_member_name': member_lookup[debtor_id].name,
                    'to_member_id': str(creditor_id),
                    'to_member_name': member_lookup[creditor_id].name,
                    'amount': float(round(trans_amt, 2))
                })

            # Update remaining amounts
            debtors[d_idx] = (debtor_id, debt_amt - trans_amt)
            creditors[c_idx] = (creditor_id, credit_amt - trans_amt)

            # Move indices if balance is settled
            if debtors[d_idx][1] <= Decimal('0.01'):
                d_idx += 1
            if creditors[c_idx][1] <= Decimal('0.01'):
                c_idx += 1

        return transactions
