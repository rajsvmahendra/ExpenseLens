from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from groups.models import Group, GroupMembership
from expenses.models import Expense, Settlement, ImportBatch, ImportRow, ImportReport
from audit.models import AuditAnomaly, DecisionTrail

class GroupVisibilityTestCase(APITestCase):
    def setUp(self):
        # Create users
        self.user_a = User.objects.create_user(username='user_a', password='password_a')
        self.user_b = User.objects.create_user(username='user_b', password='password_b')
        
        # Create groups
        self.group_a = Group.objects.create(name='Group A', base_currency='INR')
        self.group_b = Group.objects.create(name='Group B', base_currency='INR')
        
        # Add memberships
        self.membership_a = GroupMembership.objects.create(
            group=self.group_a,
            user=self.user_a,
            name='Aisha',
            joined_at='2026-01-01'
        )
        self.membership_b = GroupMembership.objects.create(
            group=self.group_b,
            user=self.user_b,
            name='Rohan',
            joined_at='2026-01-01'
        )
        
        # Add some mock data to Group B (unauthorized for User A)
        self.expense_b = Expense.objects.create(
            group=self.group_b,
            paid_by=self.membership_b,
            description='Group B Dinner',
            amount_original=100.00,
            currency_original='INR',
            exchange_rate=1.0,
            amount_base=100.00,
            expense_date='2026-03-01'
        )
        self.settlement_b = Settlement.objects.create(
            group=self.group_b,
            payer=self.membership_b,
            payee=self.membership_b, # self-settlement for testing visibility
            amount=50.00,
            date='2026-03-02'
        )
        self.anomaly_b = AuditAnomaly.objects.create(
            group=self.group_b,
            anomaly_type='NEGATIVE_AMOUNT',
            description='Test anomaly on B',
            severity='HIGH',
            expense=self.expense_b
        )
        self.batch_b = ImportBatch.objects.create(
            group=self.group_b,
            uploaded_file_name='test.csv',
            total_rows=10,
            created_by=self.user_b
        )
        self.row_b = ImportRow.objects.create(
            batch=self.batch_b,
            row_number=1,
            raw_row_json={},
            import_status='ACCEPTED'
        )
        self.report_b = ImportReport.objects.create(
            batch=self.batch_b,
            report_data={},
            report_markdown='markdown',
            created_by=self.user_b
        )
        self.decision_b = DecisionTrail.objects.create(
            group=self.group_b,
            user=self.user_b,
            action='RESOLVE_ANOMALY',
            target_object_type='AuditAnomaly',
            target_object_id=str(self.anomaly_b.id),
            reasoning='approved'
        )

    def test_user_a_cannot_see_group_b_data(self):
        # Authenticate User A
        self.client.force_authenticate(user=self.user_a)
        
        # 1. Groups check
        response = self.client.get('/api/groups/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see Group A
        group_ids = [g['id'] for g in response.data]
        self.assertIn(str(self.group_a.id), group_ids)
        self.assertNotIn(str(self.group_b.id), group_ids)
        
        # Retrieve Group B directly - should yield 404 since it's filtered out of the queryset
        response = self.client.get(f'/api/groups/{self.group_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # 2. Expenses check
        response = self.client.get('/api/expenses/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expense_ids = [e['id'] for e in response.data]
        self.assertNotIn(str(self.expense_b.id), expense_ids)
        
        response = self.client.get(f'/api/expenses/{self.expense_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # 3. Settlements check
        response = self.client.get('/api/settlements/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        settlement_ids = [s['id'] for s in response.data]
        self.assertNotIn(str(self.settlement_b.id), settlement_ids)
        
        response = self.client.get(f'/api/settlements/{self.settlement_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # 4. Import batches check
        response = self.client.get('/api/import-batches/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        batch_ids = [b['id'] for b in response.data]
        self.assertNotIn(str(self.batch_b.id), batch_ids)
        
        response = self.client.get(f'/api/import-batches/{self.batch_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # 5. Anomalies check
        response = self.client.get('/api/anomalies/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        anomaly_ids = [a['id'] for a in response.data]
        self.assertNotIn(str(self.anomaly_b.id), anomaly_ids)
        
        response = self.client.get(f'/api/anomalies/{self.anomaly_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # 6. Decision trail check
        response = self.client.get('/api/decisions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        decision_ids = [d['id'] for d in response.data]
        self.assertNotIn(str(self.decision_b.id), decision_ids)
        
        response = self.client.get(f'/api/decisions/{self.decision_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # 7. Try to upload file for Group B (should be rejected/forbidden)
        response = self.client.post('/api/import-batches/upload/', {'group': self.group_b.id, 'file': 'test'})
        self.assertTrue(response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])
