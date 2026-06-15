import uuid
from django.db import models
from django.contrib.auth.models import User
from groups.models import Group
from expenses.models import Expense, ImportRow

class AuditAnomaly(models.Model):
    """
    Tracks any data quality issue, formatting errors, or membership timeline conflicts detected.
    Supports individual review, dismissal, or resolution via decision trails.
    """
    ANOMALY_TYPES = (
        ('DUPLICATE_EXPENSE', 'Duplicate Expense'),
        ('NEGATIVE_AMOUNT', 'Negative Amount'),
        ('INVALID_DATE', 'Invalid Date'),
        ('MEMBERSHIP_CONFLICT', 'Membership Conflict'),
        ('SETTLEMENT_AS_EXPENSE', 'Settlement Recorded as Expense'),
        ('CURRENCY_ISSUE', 'Currency or Exchange Rate Issue'),
        ('SPLIT_SUM_MISMATCH', 'Split Sum Mismatch'),
        ('UNKNOWN_MEMBER', 'Unknown Member'),
        ('MISSING_PAYER', 'Missing Payer'),
    )

    SEVERITY_CHOICES = (
        ('HIGH', 'High'),
        ('MEDIUM', 'Medium'),
        ('LOW', 'Low'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='anomalies')
    anomaly_type = models.CharField(max_length=50, choices=ANOMALY_TYPES)
    description = models.TextField()
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='MEDIUM')
    is_resolved = models.BooleanField(default=False)
    resolution_action = models.CharField(max_length=50, blank=True, help_text="e.g. MERGED, IGNORED, CONVERTED_TO_SETTLEMENT, CORRECTED")
    detected_at = models.DateTimeField(auto_now_add=True)
    
    # Links to the source data objects that caused the anomaly
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, null=True, blank=True, related_name='anomalies')
    import_row = models.ForeignKey(ImportRow, on_delete=models.SET_NULL, null=True, blank=True, related_name='anomalies')
    
    extra_data = models.JSONField(null=True, blank=True, help_text="Stores additional diagnostic info (e.g. competing row IDs, rate values)")

    class Meta:
        ordering = ['-detected_at']
        verbose_name_plural = "Audit Anomalies"

    def __str__(self):
        return f"{self.get_anomaly_type_display()} [{self.severity}] - Resolved: {self.is_resolved}"


class DecisionTrail(models.Model):
    """
    Maintains a permanent, immutable audit trail of human interventions on the system.
    Resolves Rohan's concern ("No magic numbers. Show me exactly why I owe money.")
    and Meera's ("Duplicates must be reviewed before deletion.")
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='decisions')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='decisions_made')
    action = models.CharField(max_length=100, help_text="e.g. MERGED_DUPLICATES, CONVERTED_SETTLEMENT, IGNORED_TIMELINE_CONFLICT")
    
    # Generic target tracking (simplified without using contenttypes for robust, simple API representation)
    target_object_type = models.CharField(max_length=100, help_text="e.g. Expense, AuditAnomaly, GroupMembership")
    target_object_id = models.CharField(max_length=255, help_text="ID or UUID of the target object")
    
    reasoning = models.TextField(help_text="Detailed user explanation for why this choice was made")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        decider = self.user.username if self.user else "System"
        return f"{decider} performed {self.action} on {self.target_object_type} ({self.timestamp.date()})"
