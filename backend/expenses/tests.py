from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from groups.models import Group, GroupMembership, CurrencyRate
from expenses.models import Expense, ExpenseSplit
from expenses.serializers import ExpenseSerializer

class ExpenseSplitRoundingTestCase(TestCase):
    def setUp(self):
        # Create user & group
        self.user = User.objects.create_user(username='testuser', password='testpassword')
        self.group = Group.objects.create(name='Test Group', base_currency='INR')
        
        # Create members
        self.m1 = GroupMembership.objects.create(group=self.group, name='Aisha', joined_at='2026-01-01')
        self.m2 = GroupMembership.objects.create(group=self.group, name='Rohan', joined_at='2026-01-01')
        self.m3 = GroupMembership.objects.create(group=self.group, name='Priya', joined_at='2026-01-01')
        self.m4 = GroupMembership.objects.create(group=self.group, name='Meera', joined_at='2026-01-01')
        self.m5 = GroupMembership.objects.create(group=self.group, name='Dev', joined_at='2026-01-01')
        self.m6 = GroupMembership.objects.create(group=self.group, name='Sam', joined_at='2026-01-01')

    def test_split_100_among_3_members(self):
        # Create an expense of 100 split equally among 3 members (Aisha, Rohan, Priya)
        serializer = ExpenseSerializer(data={
            'group': self.group.id,
            'paid_by': self.m1.id,
            'description': 'Dinner split 3 ways',
            'amount_original': Decimal('100.00'),
            'currency_original': 'INR',
            'expense_date': '2026-03-01',
            'split_type': 'EQUAL',
            'splits': [
                {'member': self.m1.id},
                {'member': self.m2.id},
                {'member': self.m3.id},
            ]
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        expense = serializer.save()
        
        splits = expense.splits.all().order_by('member__name')
        self.assertEqual(splits.count(), 3)
        
        # Total sum of splits must be exactly 100.00
        total_sum = sum(s.calculated_amount for s in splits)
        self.assertEqual(total_sum, Decimal('100.00'))
        
        # First split should get the residual (e.g. if ordered or first in iteration)
        # Splits were created in the order of splits input: m1, m2, m3.
        # First in splits array is m1. So m1 gets the residual.
        # Share = 100.00 / 3 = 33.33. Residual = 0.01.
        # So member1 = 33.34, others = 33.33
        m1_split = expense.splits.get(member=self.m1)
        m2_split = expense.splits.get(member=self.m2)
        m3_split = expense.splits.get(member=self.m3)
        
        self.assertEqual(m1_split.calculated_amount, Decimal('33.34'))
        self.assertEqual(m2_split.calculated_amount, Decimal('33.33'))
        self.assertEqual(m3_split.calculated_amount, Decimal('33.33'))

    def test_split_1000_among_6_members(self):
        # Create an expense of 1000 split equally among 6 members
        serializer = ExpenseSerializer(data={
            'group': self.group.id,
            'paid_by': self.m1.id,
            'description': 'Event split 6 ways',
            'amount_original': Decimal('1000.00'),
            'currency_original': 'INR',
            'expense_date': '2026-03-01',
            'split_type': 'EQUAL',
            'splits': [
                {'member': self.m1.id},
                {'member': self.m2.id},
                {'member': self.m3.id},
                {'member': self.m4.id},
                {'member': self.m5.id},
                {'member': self.m6.id},
            ]
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        expense = serializer.save()
        
        splits = expense.splits.all()
        self.assertEqual(splits.count(), 6)
        
        # Total sum of splits must be exactly 1000.00
        total_sum = sum(s.calculated_amount for s in splits)
        self.assertEqual(total_sum, Decimal('1000.00'))
        
        # Let's check amounts:
        # 1000.00 / 6 = 166.67.
        # Total allocated = 166.67 * 6 = 1000.02.
        # Residual = 1000.00 - 1000.02 = -0.02.
        # First split gets 166.67 + (-0.02) = 166.65.
        # Others get 166.67.
        m1_split = expense.splits.get(member=self.m1)
        self.assertEqual(m1_split.calculated_amount, Decimal('166.65'))
        for m in [self.m2, self.m3, self.m4, self.m5, self.m6]:
            self.assertEqual(expense.splits.get(member=m).calculated_amount, Decimal('166.67'))

    def test_usd_converted_expense(self):
        # Create currency rate: 1 USD = 83.25 INR
        CurrencyRate.objects.create(
            from_currency='USD',
            to_currency='INR',
            exchange_rate=Decimal('83.25000000'),
            effective_date='2026-01-01'
        )
        
        # Create USD expense of $100
        # amount_base = 100 * 83.25 = 8325.00 INR
        # Split equally among 3 members: 8325.00 / 3 = 2775.00 exactly (no residual)
        serializer1 = ExpenseSerializer(data={
            'group': self.group.id,
            'paid_by': self.m1.id,
            'description': 'USD Expense exact split',
            'amount_original': Decimal('100.00'),
            'currency_original': 'USD',
            'expense_date': '2026-03-01',
            'split_type': 'EQUAL',
            'splits': [
                {'member': self.m1.id},
                {'member': self.m2.id},
                {'member': self.m3.id},
            ]
        })
        self.assertTrue(serializer1.is_valid())
        exp1 = serializer1.save()
        self.assertEqual(exp1.amount_base, Decimal('8325.00'))
        
        total_sum1 = sum(s.calculated_amount for s in exp1.splits.all())
        self.assertEqual(total_sum1, Decimal('8325.00'))
        for s in exp1.splits.all():
            self.assertEqual(s.calculated_amount, Decimal('2775.00'))

        # Let's test USD expense of $100.01 split among 3 members (with residual)
        # amount_base = 100.01 * 83.25 = 8325.8325 -> quantized/saved as 8325.83.
        # Split 8325.83 among 3 members:
        # 8325.83 / 3 = 2775.2766...
        # 2775.28 * 3 = 8325.84.
        # Residual = 8325.83 - 8325.84 = -0.01.
        # First gets 2775.28 - 0.01 = 2775.27.
        # Others get 2775.28.
        serializer2 = ExpenseSerializer(data={
            'group': self.group.id,
            'paid_by': self.m1.id,
            'description': 'USD Expense with rounding',
            'amount_original': Decimal('100.01'),
            'currency_original': 'USD',
            'expense_date': '2026-03-01',
            'split_type': 'EQUAL',
            'splits': [
                {'member': self.m1.id},
                {'member': self.m2.id},
                {'member': self.m3.id},
            ]
        })
        self.assertTrue(serializer2.is_valid())
        exp2 = serializer2.save()
        
        total_sum2 = sum(s.calculated_amount for s in exp2.splits.all())
        self.assertEqual(total_sum2, exp2.amount_base)
        
        m1_split = exp2.splits.get(member=self.m1)
        m2_split = exp2.splits.get(member=self.m2)
        m3_split = exp2.splits.get(member=self.m3)
        
        self.assertEqual(m1_split.calculated_amount, Decimal('2775.27'))
        self.assertEqual(m2_split.calculated_amount, Decimal('2775.28'))
        self.assertEqual(m3_split.calculated_amount, Decimal('2775.28'))
