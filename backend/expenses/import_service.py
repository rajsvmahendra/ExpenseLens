import csv
import io
import json
from decimal import Decimal, InvalidOperation
from datetime import datetime
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from groups.models import Group, GroupMembership, CurrencyRate
from audit.models import AuditAnomaly
from audit.services import AnomalyDetectionService
from .models import ImportBatch, ImportRow, Expense, ExpenseSplit, ImportReport

class CSVImportService:
    @classmethod
    @transaction.atomic
    def import_csv(cls, group, file_name, file_content, user=None):
        """
        Parses CSV contents, creates ImportBatch, ImportRow records, 
        creates Expense and ExpenseSplit objects, runs anomalies check,
        and saves an ImportReport deliverable.
        """
        # Create the batch record
        batch = ImportBatch.objects.create(
            group=group,
            uploaded_file_name=file_name,
            created_by=user,
            health_score=Decimal('0.00')
        )

        # Decode contents if they are bytes
        if isinstance(file_content, bytes):
            file_content = file_content.decode('utf-8-sig') # handle BOM if present

        reader = csv.DictReader(io.StringIO(file_content))
        headers = reader.fieldnames or []

        # Find potential member split columns
        # These are columns that don't match standard fields (date, description, amount, currency, paid by)
        standard_fields = {'date', 'description', 'amount', 'currency', 'paid by', 'payer', 'paidby', 'expense', 'item', 'cost'}
        member_columns = []
        for h in headers:
            if h.lower().strip() not in standard_fields:
                member_columns.append(h)

        total_rows = 0
        accepted_rows = 0
        flagged_rows = 0
        rejected_rows = 0

        created_expenses = []
        row_objects = []

        # Get existing members for name mapping
        memberships = GroupMembership.objects.filter(group=group)
        member_name_map = {m.name.lower().strip(): m for m in memberships}

        for idx, row in enumerate(reader, start=1):
            total_rows += 1
            raw_row_json = dict(row)
            
            # Helper to retrieve case-insensitive keys
            def get_val(keys_list, default=''):
                for k in raw_row_json.keys():
                    if k.lower().strip() in keys_list:
                        return raw_row_json[k].strip()
                return default

            # Extract fields
            date_str = get_val(['date'])
            desc = get_val(['description', 'expense', 'item'])
            amount_str = get_val(['amount', 'cost'])
            currency_str = get_val(['currency'], 'INR').upper()
            paid_by_str = get_val(['paid by', 'payer', 'paidby'])

            parsed_row_json = {
                'date': date_str,
                'description': desc,
                'amount': amount_str,
                'currency': currency_str,
                'paid_by': paid_by_str,
                'splits': {}
            }

            # Gather split column values
            for col in member_columns:
                val = row[col].strip()
                if val:
                    parsed_row_json['splits'][col] = val

            # Validation logic
            errors = []
            warnings = []

            # 1. Parse Date
            parsed_date = None
            date_formats = ['%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%m/%d/%Y', '%Y/%m/%d']
            for fmt in date_formats:
                try:
                    parsed_date = datetime.strptime(date_str, fmt).date()
                    break
                except ValueError:
                    continue

            if not parsed_date:
                errors.append(f"Invalid date format: '{date_str}'")

            # 2. Parse Description
            if not desc:
                errors.append("Description is missing.")

            # 3. Parse Amount
            parsed_amount = None
            try:
                # Remove currency symbols or commas if present
                clean_amount = amount_str.replace('$', '').replace('₹', '').replace(',', '').strip()
                parsed_amount = Decimal(clean_amount)
                if parsed_amount <= 0:
                    warnings.append(f"Expense has a non-positive amount: {parsed_amount}")
            except (InvalidOperation, ValueError):
                errors.append(f"Unparseable amount value: '{amount_str}'")

            # 4. Resolve Payer
            payer_member = None
            if not paid_by_str:
                warnings.append("Payer is missing.")
            else:
                payer_member = member_name_map.get(paid_by_str.lower().strip())
                if not payer_member:
                    # Let's check if the payer is in the system under another capitalization
                    # If completely unrecognized, flag a warning
                    warnings.append(f"Unrecognized group member/payer: '{paid_by_str}'")

            # Determine row status
            status = 'ACCEPTED'
            error_message = ''

            if errors:
                status = 'REJECTED'
                error_message = " | ".join(errors)
                rejected_rows += 1
            else:
                # Process Splits mapping
                resolved_splits = []
                # If there are split columns containing values
                active_splits = {k.lower().strip(): v for k, v in parsed_row_json['splits'].items() if v.lower() not in ('no', 'false', '0', '')}
                
                # Check if members in the CSV splits are recognized
                for m_col, val in active_splits.items():
                    target_member = member_name_map.get(m_col)
                    if target_member:
                        resolved_splits.append((target_member, val))
                    else:
                        warnings.append(f"Unrecognized split member column: '{m_col}'")

                # If warnings exist, mark as flagged
                if warnings:
                    status = 'FLAGGED'
                    error_message = " | ".join(warnings)
                    flagged_rows += 1
                else:
                    accepted_rows += 1

            # Create ImportRow record
            row_obj = ImportRow.objects.create(
                batch=batch,
                row_number=idx,
                raw_row_json=raw_row_json,
                parsed_row_json=parsed_row_json if status != 'REJECTED' else None,
                import_status=status,
                error_message=error_message
            )
            row_objects.append(row_obj)

            # If row was not rejected, create the Expense in DB
            if status != 'REJECTED':
                # Determine exchange rate
                rate = CurrencyRate.get_rate(currency_str, group.base_currency, parsed_date)
                if rate is None:
                    rate = Decimal('1.00000000')
                    # We will flag this currency issue as an anomaly later

                amount_base = parsed_amount * rate

                expense = Expense.objects.create(
                    group=group,
                    paid_by=payer_member,
                    description=desc,
                    amount_original=parsed_amount,
                    currency_original=currency_str,
                    exchange_rate=rate,
                    amount_base=amount_base,
                    expense_date=parsed_date,
                    import_row=row_obj
                )
                created_expenses.append(expense)

                # Save splits
                if resolved_splits:
                    # Let's see: are the split values numeric or simple ticks?
                    # We can check if all values are 'yes', 'y', '1' or if they represent percentages/amounts
                    is_equal = True
                    numeric_vals = []
                    for m, v in resolved_splits:
                        try:
                            num = Decimal(v)
                            numeric_vals.append(num)
                            if num != Decimal('1.00') and num != Decimal('1'):
                                is_equal = False
                        except InvalidOperation:
                            numeric_vals.append(Decimal('1.00'))

                    if is_equal:
                        # Split equally among the specified members
                        count = len(resolved_splits)
                        share_amt = round(amount_base / count, 2)
                        for m, v in resolved_splits:
                            ExpenseSplit.objects.create(
                                expense=expense,
                                member=m,
                                split_type='EQUAL',
                                value=Decimal('1.00'),
                                calculated_amount=share_amt
                            )
                    else:
                        # Check if it looks like percentages (sums to ~100) or exact shares
                        total_sum = sum(numeric_vals)
                        if abs(total_sum - Decimal('100.00')) < Decimal('1.00'):
                            # Percentage split
                            for (m, v), num in zip(resolved_splits, numeric_vals):
                                calc_amt = round((num / Decimal('100.00')) * amount_base, 2)
                                ExpenseSplit.objects.create(
                                    expense=expense,
                                    member=m,
                                    split_type='PERCENTAGE',
                                    value=num,
                                    calculated_amount=calc_amt
                                )
                        else:
                            # Share-based split
                            for (m, v), num in zip(resolved_splits, numeric_vals):
                                calc_amt = round((num / total_sum) * amount_base, 2)
                                ExpenseSplit.objects.create(
                                    expense=expense,
                                    member=m,
                                    split_type='SHARE',
                                    value=num,
                                    calculated_amount=calc_amt
                                )
                else:
                    # Default: Equal split among all active members in the group on the expense date
                    active_members = GroupMembership.objects.filter(
                        group=group,
                        joined_at__lte=parsed_date
                    ).filter(
                        Q(left_at__isnull=True) | Q(left_at__gte=parsed_date)
                    )
                    
                    if not active_members.exists():
                        active_members = memberships  # fallback to all members

                    count = active_members.count()
                    if count > 0:
                        share_amt = round(amount_base / count, 2)
                        for m in active_members:
                            ExpenseSplit.objects.create(
                                expense=expense,
                                member=m,
                                split_type='EQUAL',
                                value=Decimal('1.00'),
                                calculated_amount=share_amt
                            )

                # Run post-save anomaly detection for this expense
                detected_anomalies_count = AnomalyDetectionService.detect_and_save(expense)
                if detected_anomalies_count > 0:
                    # If anomalies were detected, promote the ImportRow to FLAGGED status
                    if row_obj.import_status == 'ACCEPTED':
                        row_obj.import_status = 'FLAGGED'
                        
                        # Add detected anomalies names to errors
                        anomalies = AuditAnomaly.objects.filter(expense=expense)
                        anomaly_names = ", ".join(a.get_anomaly_type_display() for a in anomalies)
                        row_obj.error_message = f"Anomalies detected: {anomaly_names}"
                        row_obj.save()
                        
                        # Adjust batch counts
                        accepted_rows -= 1
                        flagged_rows += 1

        # Calculate Health Score
        # Formula: 100 * (1 - (Flagged * 0.3 + Rejected * 1.0) / Total)
        if total_rows > 0:
            penalty = (Decimal(str(flagged_rows)) * Decimal('0.3')) + (Decimal(str(rejected_rows)) * Decimal('1.0'))
            health = Decimal('100.00') * (Decimal('1.00') - (penalty / Decimal(str(total_rows))))
            health = max(Decimal('0.00'), min(Decimal('100.00'), health))
        else:
            health = Decimal('100.00')

        batch.total_rows = total_rows
        batch.accepted_rows = accepted_rows
        batch.flagged_rows = flagged_rows
        batch.rejected_rows = rejected_rows
        batch.health_score = round(health, 2)
        batch.save()

        # 5. Generate and save the ImportReport deliverable
        report_data = {
            'batch_id': str(batch.id),
            'filename': file_name,
            'timestamp': batch.import_timestamp.isoformat(),
            'total_rows': total_rows,
            'accepted_rows': accepted_rows,
            'flagged_rows': flagged_rows,
            'rejected_rows': rejected_rows,
            'health_score': float(batch.health_score),
            'anomalies_summary': list(AuditAnomaly.objects.filter(import_row__batch=batch).values('anomaly_type').annotate(count=models.Count('id')))
        }

        # Format markdown content
        markdown_content = cls._generate_markdown_report(batch, report_data)
        
        ImportReport.objects.create(
            batch=batch,
            report_data=report_data,
            report_markdown=markdown_content,
            created_by=user
        )

        return batch

    @staticmethod
    def _generate_markdown_report(batch, report_data):
        """
        Renders the Import Report markdown template.
        """
        timestamp_str = datetime.fromisoformat(report_data['timestamp']).strftime('%Y-%m-%d %H:%M:%S')
        
        md = []
        md.append(f"# ExpenseLens CSV Import Intelligence Report")
        md.append(f"**Generated At**: {timestamp_str} | **Batch ID**: `{batch.id}`")
        md.append(f"**Target Group**: {batch.group.name} | **Uploaded File**: `{batch.uploaded_file_name}`")
        md.append("")
        md.append("## Executive Ingestion Summary")
        md.append("")
        md.append("| Metric | Count | Percentage |")
        md.append("| :--- | :---: | :---: |")
        
        total = report_data['total_rows']
        if total > 0:
            acc_pct = f"{(report_data['accepted_rows']/total)*100:.1f}%"
            flg_pct = f"{(report_data['flagged_rows']/total)*100:.1f}%"
            rej_pct = f"{(report_data['rejected_rows']/total)*100:.1f}%"
        else:
            acc_pct = flg_pct = rej_pct = "0.0%"

        md.append(f"| **Total Rows Parsed** | {total} | 100.0% |")
        md.append(f"| Accepted Rows (Clean) | {report_data['accepted_rows']} | {acc_pct} |")
        md.append(f"| Flagged Rows (Warnings) | {report_data['flagged_rows']} | {flg_pct} |")
        md.append(f"| Rejected Rows (Fatal Errors) | {report_data['rejected_rows']} | {rej_pct} |")
        md.append("")
        
        # Color code health score
        hs = report_data['health_score']
        status_color = "🟢 GOOD" if hs >= 80 else ("🟡 WARNING" if hs >= 50 else "🔴 CRITICAL")
        md.append(f"**Data Quality Health Score**: `{hs}/100` ({status_color})")
        md.append("")
        md.append("---")
        md.append("")
        md.append("## Flagged & Rejected Row Breakdown")
        md.append("")
        
        rows = ImportRow.objects.filter(batch=batch).exclude(import_status='ACCEPTED')
        if not rows.exists():
            md.append("*No issues detected. Ingestion was 100% clean!*")
        else:
            md.append("| Row # | Status | Description | Details / Errors |")
            md.append("| :---: | :--- | :--- | :--- |")
            for r in rows:
                desc = r.raw_row_json.get('Description', r.raw_row_json.get('expense', 'Unknown'))
                md.append(f"| {r.row_number} | **{r.import_status}** | {desc} | {r.error_message} |")

        md.append("")
        md.append("---")
        md.append("")
        md.append("## Detected Anomalies Summary")
        md.append("")
        
        anomalies_counts = report_data['anomalies_summary']
        if not anomalies_counts:
            md.append("*No data anomalies detected in this batch.*")
        else:
            md.append("| Anomaly Type | Count | Severity |")
            md.append("| :--- | :---: | :---: |")
            
            # Map type to severity help
            severity_map = {
                'DUPLICATE_EXPENSE': 'MEDIUM',
                'NEGATIVE_AMOUNT': 'HIGH',
                'INVALID_DATE': 'HIGH',
                'MEMBERSHIP_CONFLICT': 'HIGH',
                'SETTLEMENT_AS_EXPENSE': 'LOW',
                'CURRENCY_ISSUE': 'MEDIUM',
                'SPLIT_SUM_MISMATCH': 'HIGH',
                'UNKNOWN_MEMBER': 'HIGH',
                'MISSING_PAYER': 'HIGH',
            }
            
            for item in anomalies_counts:
                t = item['anomaly_type']
                c = item['count']
                sev = severity_map.get(t, 'MEDIUM')
                md.append(f"| {t.replace('_', ' ').title()} | {c} | {sev} |")

        return "\n".join(md)
