from decimal import Decimal, ROUND_HALF_UP
from django.db.models import Q
from rest_framework import serializers
from groups.models import Group, GroupMembership, CurrencyRate
from .models import Expense, ExpenseSplit, Settlement, ImportBatch, ImportRow, ImportReport

class ExpenseSplitSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.name', read_only=True)

    class Meta:
        model = ExpenseSplit
        fields = ('id', 'member', 'member_name', 'split_type', 'value', 'calculated_amount')
        read_only_fields = ('id', 'calculated_amount')


class ExpenseSerializer(serializers.ModelSerializer):
    splits = ExpenseSplitSerializer(many=True, required=False)
    paid_by_name = serializers.CharField(source='paid_by.name', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    
    # Input field to help compute splits on creation/update
    split_type = serializers.ChoiceField(choices=ExpenseSplit.SPLIT_TYPES, write_only=True, required=False, default='EQUAL')

    class Meta:
        model = Expense
        fields = (
            'id', 'group', 'group_name', 'paid_by', 'paid_by_name', 
            'description', 'amount_original', 'currency_original', 
            'exchange_rate', 'amount_base', 'expense_date', 
            'splits', 'split_type', 'is_settlement_hidden', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'exchange_rate', 'amount_base', 'created_at', 'updated_at')

    def create(self, validated_data):
        splits_data = validated_data.pop('splits', [])
        split_type = validated_data.pop('split_type', 'EQUAL')
        group = validated_data['group']
        currency_orig = validated_data.get('currency_original', group.base_currency).upper()
        expense_date = validated_data['expense_date']
        amount_orig = validated_data['amount_original']

        # 1. Resolve Exchange Rate dynamically using CurrencyRate
        rate = CurrencyRate.get_rate(currency_orig, group.base_currency, expense_date)
        if rate is None:
            # Fallback to 1.0 if rate is missing. (Will trigger a CURRENCY_ISSUE anomaly in post-save detection)
            rate = Decimal('1.00000000')
        else:
            rate = Decimal(str(rate))
        
        validated_data['exchange_rate'] = rate
        validated_data['amount_base'] = (amount_orig * rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # Create expense
        expense = Expense.objects.create(**validated_data)

        # 2. Process Splits
        self._save_splits(expense, split_type, splits_data)
        
        # Run anomaly detection for this expense
        from audit.services import AnomalyDetectionService
        AnomalyDetectionService.detect_and_save(expense)

        return expense

    def update(self, instance, validated_data):
        splits_data = validated_data.pop('splits', None)
        split_type = validated_data.pop('split_type', 'EQUAL')
        
        group = validated_data.get('group', instance.group)
        currency_orig = validated_data.get('currency_original', instance.currency_original).upper()
        expense_date = validated_data.get('expense_date', instance.expense_date)
        amount_orig = validated_data.get('amount_original', instance.amount_original)

        # Re-resolve exchange rate if currency, date, or group changes
        if (validated_data.get('currency_original') or 
                validated_data.get('expense_date') or 
                validated_data.get('group') or 
                validated_data.get('amount_original')):
            rate = CurrencyRate.get_rate(currency_orig, group.base_currency, expense_date)
            if rate is None:
                rate = Decimal('1.00000000')
            else:
                rate = Decimal(str(rate))
            instance.exchange_rate = rate
            instance.amount_base = (amount_orig * rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # Update core fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update splits if provided
        if splits_data is not None or split_type:
            # If splits_data was not explicitly provided but split_type is EQUAL, recalculate splits
            if splits_data is None:
                splits_data = []
            self._save_splits(instance, split_type, splits_data)

        # Run anomaly detection for this expense
        from audit.services import AnomalyDetectionService
        AnomalyDetectionService.detect_and_save(instance)

        return instance

    def _save_splits(self, expense, split_type, splits_data):
        # Clear existing splits
        expense.splits.all().delete()

        group = expense.group
        expense_date = expense.expense_date
        amount_base = expense.amount_base

        # Case 1: EQUAL Split
        if split_type == 'EQUAL':
            # If no splits were posted, auto-select all active members on this date
            if not splits_data:
                active_memberships = list(GroupMembership.objects.filter(
                    group=group,
                    joined_at__lte=expense_date
                ).filter(
                    Q(left_at__isnull=True) | Q(left_at__gte=expense_date)
                ))
                
                # Fallback to all group members if somehow no one is active
                if not active_memberships:
                    active_memberships = list(GroupMembership.objects.filter(group=group))

                count = len(active_memberships)
                if count > 0:
                    share_amt = (amount_base / Decimal(str(count))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    residual = amount_base - (share_amt * count)
                    for idx, m in enumerate(active_memberships):
                        actual_share = share_amt + residual if idx == 0 else share_amt
                        ExpenseSplit.objects.create(
                            expense=expense,
                            member=m,
                            split_type='EQUAL',
                            value=Decimal('1.00'),
                            calculated_amount=actual_share
                        )
            else:
                # Explicit list of members for EQUAL split
                count = len(splits_data)
                if count > 0:
                    share_amt = (amount_base / Decimal(str(count))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    residual = amount_base - (share_amt * count)
                    for idx, s in enumerate(splits_data):
                        actual_share = share_amt + residual if idx == 0 else share_amt
                        ExpenseSplit.objects.create(
                            expense=expense,
                            member=s['member'],
                            split_type='EQUAL',
                            value=Decimal('1.00'),
                            calculated_amount=actual_share
                        )

        # Case 2: EXACT Split
        elif split_type == 'EXACT':
            for s in splits_data:
                val = s.get('value', Decimal('0.00'))
                ExpenseSplit.objects.create(
                    expense=expense,
                    member=s['member'],
                    split_type='EXACT',
                    value=val,
                    calculated_amount=val
                )

        # Case 3: PERCENTAGE Split
        elif split_type == 'PERCENTAGE':
            count = len(splits_data)
            if count > 0:
                calc_amounts = []
                for s in splits_data:
                    pct = s.get('value', Decimal('0.00'))
                    calc_amt = ((pct / Decimal('100.00')) * amount_base).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    calc_amounts.append(calc_amt)
                
                total_splits = sum(calc_amounts)
                residual = amount_base - total_splits
                
                for idx, s in enumerate(splits_data):
                    actual_share = calc_amounts[idx]
                    if idx == 0:
                        actual_share += residual
                    ExpenseSplit.objects.create(
                        expense=expense,
                        member=s['member'],
                        split_type='PERCENTAGE',
                        value=s.get('value', Decimal('0.00')),
                        calculated_amount=actual_share
                    )

        # Case 4: SHARE Split
        elif split_type == 'SHARE':
            total_shares = sum(s.get('value', Decimal('0.00')) for s in splits_data)
            if total_shares > 0:
                calc_amounts = []
                for s in splits_data:
                    shares = s.get('value', Decimal('0.00'))
                    calc_amt = ((shares / total_shares) * amount_base).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    calc_amounts.append(calc_amt)
                
                total_splits = sum(calc_amounts)
                residual = amount_base - total_splits
                
                for idx, s in enumerate(splits_data):
                    actual_share = calc_amounts[idx]
                    if idx == 0:
                        actual_share += residual
                    ExpenseSplit.objects.create(
                        expense=expense,
                        member=s['member'],
                        split_type='SHARE',
                        value=s.get('value', Decimal('0.00')),
                        calculated_amount=actual_share
                    )


class SettlementSerializer(serializers.ModelSerializer):
    payer_name = serializers.CharField(source='payer.name', read_only=True)
    payee_name = serializers.CharField(source='payee.name', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)

    class Meta:
        model = Settlement
        fields = ('id', 'group', 'group_name', 'payer', 'payer_name', 'payee', 'payee_name', 'amount', 'date', 'notes', 'created_at')
        read_only_fields = ('id', 'created_at')


class ImportBatchSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)
    uploader_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = ImportBatch
        fields = (
            'id', 'group', 'group_name', 'uploaded_file_name', 'import_timestamp', 
            'total_rows', 'accepted_rows', 'flagged_rows', 'rejected_rows', 
            'health_score', 'created_by', 'uploader_name'
        )
        read_only_fields = ('id', 'import_timestamp', 'total_rows', 'accepted_rows', 'flagged_rows', 'rejected_rows', 'health_score', 'created_by')


class ImportRowSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportRow
        fields = ('id', 'batch', 'row_number', 'raw_row_json', 'parsed_row_json', 'import_status', 'error_message')


class ImportReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportReport
        fields = ('id', 'batch', 'generated_at', 'report_data', 'report_markdown', 'created_by')
