from django.contrib import admin
from .models import AuditAnomaly, DecisionTrail

@admin.register(AuditAnomaly)
class AuditAnomalyAdmin(admin.ModelAdmin):
    list_display = ('anomaly_type', 'group', 'severity', 'is_resolved', 'resolution_action', 'detected_at')
    list_filter = ('anomaly_type', 'group', 'severity', 'is_resolved')
    search_fields = ('description', 'resolution_action')

@admin.register(DecisionTrail)
class DecisionTrailAdmin(admin.ModelAdmin):
    list_display = ('user', 'group', 'action', 'target_object_type', 'target_object_id', 'timestamp')
    list_filter = ('group', 'timestamp', 'action')
    search_fields = ('reasoning', 'action', 'target_object_id')
