import uuid
from django.db import models
from django.contrib.auth.models import User
from groups.models import Group, GroupMembership

class ImportBatch(models.Model):
    """
    Tracks a CSV import process, keeping track of ingestion metrics and overall data health.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='import_batches')
    uploaded_file_name = models.CharField(max_length=255)
    import_timestamp = models.DateTimeField(auto_now_add=True)
    total_rows = models.IntegerField(default=0)
    accepted_rows = models.IntegerField(default=0)
    flagged_rows = models.IntegerField(default=0)
    rejected_rows = models.IntegerField(default=0)
    health_score = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-import_timestamp']
        verbose_name_plural = "Import Batches"

    def __str__(self):
        return f"Batch {self.id} for {self.group.name} ({self.import_timestamp.date()})"


class ImportRow(models.Model):
    """
    Represents a single row from an imported CSV file. Holds raw and parsed forms
    for auditing before insertion or during review.
    """
    STATUS_CHOICES = (
        ('ACCEPTED', 'Accepted'),
        ('FLAGGED', 'Flagged'),
        ('REJECTED', 'Rejected'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name='rows')
    row_number = models.IntegerField()
    raw_row_json = models.JSONField(help_text="Original string key-value pairs from CSV row")
    parsed_row_json = models.JSONField(null=True, blank=True, help_text="Parsed fields with resolved types")
    import_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACCEPTED')
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ['batch', 'row_number']
        unique_together = ('batch', 'row_number')

    def __str__(self):
        return f"Row {self.row_number} [{self.import_status}] in Batch {self.batch.id}"


class Expense(models.Model):
    """
    Represents an expense incurred in a group.
    Supports multi-currency with automatic base conversion using historical rates.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='expenses')
    # paid_by and import_row can be null to support missing payer or unknown member anomalies.
    paid_by = models.ForeignKey(GroupMembership, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses_paid')
    description = models.CharField(max_length=255)
    amount_original = models.DecimalField(max_digits=18, decimal_places=2)
    currency_original = models.CharField(max_length=10, default='INR')
    exchange_rate = models.DecimalField(max_digits=18, decimal_places=8, default=1.0)
    amount_base = models.DecimalField(max_digits=18, decimal_places=2, help_text="amount_original * exchange_rate")
    expense_date = models.DateField()
    import_row = models.ForeignKey(ImportRow, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_expenses')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Flag if settlement is hidden/processed separately
    is_settlement_hidden = models.BooleanField(default=False)

    class Meta:
        ordering = ['-expense_date', '-created_at']

    def __str__(self):
        payer_name = self.paid_by.name if self.paid_by else "Unknown Payer"
        return f"{self.description} - {self.amount_original} {self.currency_original} paid by {payer_name}"


class ExpenseSplit(models.Model):
    """
    Defines how an individual expense is divided among group members.
    Supports Equal, Exact, Percentage, and Share split types.
    """
    SPLIT_TYPES = (
        ('EQUAL', 'Equal'),
        ('EXACT', 'Exact Amount'),
        ('PERCENTAGE', 'Percentage'),
        ('SHARE', 'Share Based'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='splits')
    member = models.ForeignKey(GroupMembership, on_delete=models.CASCADE, related_name='splits')
    split_type = models.CharField(max_length=20, choices=SPLIT_TYPES, default='EQUAL')
    value = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="e.g. percentage, share count, or exact amount")
    calculated_amount = models.DecimalField(max_digits=18, decimal_places=2, help_text="Split amount in base currency")

    class Meta:
        unique_together = ('expense', 'member')

    def __str__(self):
        return f"{self.member.name}: {self.calculated_amount} for {self.expense.description}"


class Settlement(models.Model):
    """
    Represents a direct payment from one member to another to settle debts.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='settlements')
    payer = models.ForeignKey(GroupMembership, on_delete=models.CASCADE, related_name='settlements_paid')
    payee = models.ForeignKey(GroupMembership, on_delete=models.CASCADE, related_name='settlements_received')
    amount = models.DecimalField(max_digits=18, decimal_places=2, help_text="Settlement amount in base currency")
    date = models.DateField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.payer.name} paid {self.amount} to {self.payee.name}"


class ImportReport(models.Model):
    """
    Generates a structured import report deliverable for an import batch.
    Includes final calculations, audit summaries, and diagnostic metadata.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name='reports')
    generated_at = models.DateTimeField(auto_now_add=True)
    report_data = models.JSONField(help_text="Detailed metrics and summary of this import session")
    report_markdown = models.TextField(help_text="Pre-formatted markdown of the Import Report deliverable")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return f"Import Report for Batch {self.batch.id} ({self.generated_at.date()})"
