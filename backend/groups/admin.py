from django.contrib import admin
from .models import Group, GroupMembership, CurrencyRate

@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'base_currency', 'created_at')
    search_fields = ('name',)

@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ('name', 'group', 'joined_at', 'left_at')
    list_filter = ('group', 'joined_at')
    search_fields = ('name', 'group__name')

@admin.register(CurrencyRate)
class CurrencyRateAdmin(admin.ModelAdmin):
    list_display = ('from_currency', 'to_currency', 'exchange_rate', 'effective_date')
    list_filter = ('from_currency', 'to_currency')
    search_fields = ('from_currency', 'to_currency')
