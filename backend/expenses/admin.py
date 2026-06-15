from django.contrib import admin
from .models import Expense, ExpenseSplit, Settlement, ImportBatch, ImportRow, ImportReport

class ExpenseSplitInline(admin.TabularInline):
    model = ExpenseSplit
    extra = 1

@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('description', 'group', 'amount_original', 'currency_original', 'amount_base', 'expense_date', 'paid_by')
    list_filter = ('group', 'currency_original', 'expense_date')
    search_fields = ('description', 'paid_by__name')
    inlines = [ExpenseSplitInline]

@admin.register(ExpenseSplit)
class ExpenseSplitAdmin(admin.ModelAdmin):
    list_display = ('expense', 'member', 'split_type', 'value', 'calculated_amount')
    list_filter = ('split_type', 'expense__group')
    search_fields = ('member__name', 'expense__description')

@admin.register(Settlement)
class SettlementAdmin(admin.ModelAdmin):
    list_display = ('payer', 'payee', 'amount', 'date', 'group')
    list_filter = ('group', 'date')
    search_fields = ('payer__name', 'payee__name')

@admin.register(ImportBatch)
class ImportBatchAdmin(admin.ModelAdmin):
    list_display = ('id', 'group', 'uploaded_file_name', 'import_timestamp', 'total_rows', 'health_score')
    list_filter = ('group', 'import_timestamp')

@admin.register(ImportRow)
class ImportRowAdmin(admin.ModelAdmin):
    list_display = ('batch', 'row_number', 'import_status')
    list_filter = ('import_status', 'batch')

@admin.register(ImportReport)
class ImportReportAdmin(admin.ModelAdmin):
    list_display = ('batch', 'generated_at', 'created_by')
    list_filter = ('generated_at',)
