from rest_framework import serializers
from django.contrib.auth.models import User
from .models import AuditAnomaly, DecisionTrail

class AuditAnomalySerializer(serializers.ModelSerializer):
    anomaly_type_display = serializers.CharField(source='get_anomaly_type_display', read_only=True)
    expense_description = serializers.CharField(source='expense.description', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)

    class Meta:
        model = AuditAnomaly
        fields = (
            'id', 'group', 'group_name', 'anomaly_type', 'anomaly_type_display', 
            'description', 'severity', 'is_resolved', 'resolution_action', 
            'detected_at', 'expense', 'expense_description', 'import_row', 'extra_data'
        )
        read_only_fields = ('id', 'detected_at')


class DecisionTrailSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)

    class Meta:
        model = DecisionTrail
        fields = (
            'id', 'group', 'group_name', 'user', 'user_name', 
            'action', 'target_object_type', 'target_object_id', 
            'reasoning', 'timestamp'
        )
        read_only_fields = ('id', 'timestamp')
