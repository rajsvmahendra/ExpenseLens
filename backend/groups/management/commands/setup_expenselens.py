import os
from django.core.management.base import BaseCommand
from datetime import date
from decimal import Decimal
from groups.models import Group, GroupMembership, CurrencyRate

class Command(BaseCommand):
    help = "Initializes the ExpenseLens default group, roommate memberships, and currency rate timelines."

    def handle(self, *args, **options):
        self.stdout.write("Initializing ExpenseLens assessment data...")

        # 1. Create Group
        group, group_created = Group.objects.get_or_create(
            name="Flatmates Shared Expenses",
            defaults={
                "description": "Shared trip, grocery, utilities, and rent ledger for Aisha, Rohan, Priya, Meera, Dev, and Sam.",
                "base_currency": "INR"
            }
        )
        if group_created:
            self.stdout.write(self.style.SUCCESS(f"Created group: '{group.name}'"))
        else:
            self.stdout.write(f"Group '{group.name}' already exists.")

        # 2. Create Memberships
        members_timeline = [
            {"name": "Aisha", "joined_at": date(2026, 3, 1), "left_at": None},
            {"name": "Rohan", "joined_at": date(2026, 3, 1), "left_at": None},
            {"name": "Priya", "joined_at": date(2026, 3, 1), "left_at": None},
            {"name": "Meera", "joined_at": date(2026, 3, 1), "left_at": date(2026, 3, 31)},
            {"name": "Dev",   "joined_at": date(2026, 3, 15), "left_at": None},
            {"name": "Sam",   "joined_at": date(2026, 4, 15), "left_at": None},
        ]

        for m_data in members_timeline:
            member, created = GroupMembership.objects.update_or_create(
                group=group,
                name=m_data["name"],
                defaults={
                    "joined_at": m_data["joined_at"],
                    "left_at": m_data["left_at"]
                }
            )
            if created:
                status = "Created"
            else:
                status = "Updated"
            
            leave_info = f", left: {member.left_at}" if member.left_at else ", currently active"
            self.stdout.write(f"  [{status}] Member: {member.name} (joined: {member.joined_at}{leave_info})")

        # 3. Create Sample Historical Currency Rates (USD -> INR)
        rates = [
            {"from_currency": "USD", "to_currency": "INR", "exchange_rate": Decimal("83.25000000"), "effective_date": date(2026, 3, 1)},
            {"from_currency": "USD", "to_currency": "INR", "exchange_rate": Decimal("83.50000000"), "effective_date": date(2026, 4, 1)},
        ]

        for r_data in rates:
            rate, created = CurrencyRate.objects.update_or_create(
                from_currency=r_data["from_currency"],
                to_currency=r_data["to_currency"],
                effective_date=r_data["effective_date"],
                defaults={
                    "exchange_rate": r_data["exchange_rate"]
                }
            )
            if created:
                status = "Created"
            else:
                status = "Updated"
            self.stdout.write(f"  [{status}] Rate: 1 {rate.from_currency} = {rate.exchange_rate} {rate.to_currency} (Eff: {rate.effective_date})")

        self.stdout.write(self.style.SUCCESS("ExpenseLens assessment data successfully initialized!"))
