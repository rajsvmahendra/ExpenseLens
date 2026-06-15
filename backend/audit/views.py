from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import AuditAnomaly, DecisionTrail
from .serializers import AuditAnomalySerializer, DecisionTrailSerializer
from expenses.models import Expense, Settlement

class AuditAnomalyViewSet(viewsets.ModelViewSet):
    queryset = AuditAnomaly.objects.all()
    serializer_class = AuditAnomalySerializer
    filterset_fields = ('group', 'is_resolved', 'anomaly_type')

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return AuditAnomaly.objects.none()
            
        if user.is_superuser:
            queryset = self.queryset
        else:
            queryset = AuditAnomaly.objects.filter(group__memberships__user=user).distinct()
            
        group_id = self.request.query_params.get('group')
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        return queryset

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def resolve(self, request, pk=None):
        """
        Resolves a detected anomaly, performing backend side-effects (e.g., merging duplicates
        or converting settlements) and creating an immutable DecisionTrail entry.
        """
        anomaly = self.get_object()
        if anomaly.is_resolved:
            return Response(
                {"error": "This anomaly has already been resolved."},
                status=status.HTTP_400_BAD_REQUEST
            )

        resolution_action = request.data.get('resolution_action')  # e.g., 'DISMISS', 'MERGE', 'CONVERT_TO_SETTLEMENT'
        reasoning = request.data.get('reasoning')

        if not resolution_action:
            return Response({"error": "Resolution action is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not reasoning:
            return Response({"error": "Reasoning / justification is required."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Perform backend side effects based on action type
        if resolution_action == 'CONVERT_TO_SETTLEMENT':
            if anomaly.anomaly_type != 'SETTLEMENT_AS_EXPENSE':
                return Response(
                    {"error": "Only SETTLEMENT_AS_EXPENSE anomalies can be converted to settlements."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            expense = anomaly.expense
            if not expense:
                return Response({"error": "No linked expense found for this anomaly."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Find payer and payee
            payer = expense.paid_by
            first_split = expense.splits.first()
            
            if not payer or not first_split:
                return Response(
                    {"error": "Cannot convert to settlement. Payer or split member is missing."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create a true Settlement record
            Settlement.objects.create(
                group=expense.group,
                payer=payer,
                payee=first_split.member,
                amount=expense.amount_base,
                date=expense.expense_date,
                notes=f"Converted from expense '{expense.description}' via Audit Center. Reasoning: {reasoning}"
            )
            
            # Hide the original expense from splits and calculations
            expense.is_settlement_hidden = True
            expense.save()

        elif resolution_action == 'MERGE':
            if anomaly.anomaly_type != 'DUPLICATE_EXPENSE':
                return Response(
                    {"error": "Only DUPLICATE_EXPENSE anomalies can be merged."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Delete the duplicated expense that this anomaly targets
            expense = anomaly.expense
            if expense:
                expense.delete()

        # 2. Mark anomaly as resolved
        anomaly.is_resolved = True
        anomaly.resolution_action = resolution_action
        anomaly.save()

        # 3. Create DecisionTrail log entry
        DecisionTrail.objects.create(
            group=anomaly.group,
            user=request.user if request.user.is_authenticated else None,
            action=f"RESOLVE_{anomaly.anomaly_type}_{resolution_action}",
            target_object_type="AuditAnomaly",
            target_object_id=str(anomaly.id),
            reasoning=reasoning
        )

        serializer = self.get_serializer(anomaly)
        return Response(serializer.data, status=status.HTTP_200_OK)


class DecisionTrailViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DecisionTrail.objects.all()
    serializer_class = DecisionTrailSerializer
    filterset_fields = ('group',)

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return DecisionTrail.objects.none()
            
        if user.is_superuser:
            queryset = self.queryset
        else:
            queryset = DecisionTrail.objects.filter(group__memberships__user=user).distinct()
            
        group_id = self.request.query_params.get('group')
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        return queryset
