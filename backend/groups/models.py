import uuid
from django.db import models
from django.contrib.auth.models import User

class Group(models.Model):
    """
    Represents an expense sharing group (e.g. flatmates' spreadsheet tracker).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    base_currency = models.CharField(max_length=10, default='INR')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class GroupMembership(models.Model):
    """
    Represents a member in a group, tracking their join/leave dates for membership-aware splits.
    Names map to names in spreadsheet exports (e.g. Aisha, Rohan, Priya, Meera, Dev, Sam).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='group_memberships')
    name = models.CharField(max_length=100)
    joined_at = models.DateField()
    left_at = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('group', 'name')
        ordering = ['joined_at', 'name']

    def __str__(self):
        return f"{self.name} in {self.group.name}"


class CurrencyRate(models.Model):
    """
    Tracks exchange rates between currencies. Used to resolve historical exchange rates
    based on the date of the expense.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_currency = models.CharField(max_length=10)
    to_currency = models.CharField(max_length=10)
    exchange_rate = models.DecimalField(max_digits=18, decimal_places=8)
    effective_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('from_currency', 'to_currency', 'effective_date')
        ordering = ['-effective_date', 'from_currency', 'to_currency']

    def __str__(self):
        return f"1 {self.from_currency} = {self.exchange_rate} {self.to_currency} (Eff: {self.effective_date})"

    @classmethod
    def get_rate(cls, from_curr, to_curr, date):
        """
        Gets the historical rate effective on the specified date.
        Finds the rate with the most recent effective_date <= date.
        """
        from_curr = from_curr.upper()
        to_curr = to_curr.upper()
        
        if from_curr == to_curr:
            return 1.0

        # Find the rate where effective_date <= date, ordered by effective_date desc
        rate_obj = cls.objects.filter(
            from_currency=from_curr,
            to_currency=to_curr,
            effective_date__lte=date
        ).order_by('-effective_date').first()
        
        if rate_obj:
            return rate_obj.exchange_rate
            
        # Fallback: if no rate is active before this date, try to find the earliest rate recorded
        rate_obj = cls.objects.filter(
            from_currency=from_curr,
            to_currency=to_curr
        ).order_by('effective_date').first()
        
        if rate_obj:
            return rate_obj.exchange_rate
            
        # Hard fallback: return None if currency rate pair is missing entirely
        return None
