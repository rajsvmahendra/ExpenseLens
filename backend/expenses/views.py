from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Expense, ExpenseSplit, Settlement, ImportBatch, ImportRow, ImportReport
from .serializers import (
    ExpenseSerializer, ExpenseSplitSerializer, SettlementSerializer, 
    ImportBatchSerializer, ImportRowSerializer, ImportReportSerializer
)
from .import_service import CSVImportService

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    filterset_fields = ('group',)

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return Expense.objects.none()
        
        if user.is_superuser:
            queryset = self.queryset
        else:
            queryset = Expense.objects.filter(group__memberships__user=user).distinct()
            
        group_id = self.request.query_params.get('group')
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        return queryset


class SettlementViewSet(viewsets.ModelViewSet):
    queryset = Settlement.objects.all()
    serializer_class = SettlementSerializer
    filterset_fields = ('group',)

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return Settlement.objects.none()
        
        if user.is_superuser:
            queryset = self.queryset
        else:
            queryset = Settlement.objects.filter(group__memberships__user=user).distinct()
            
        group_id = self.request.query_params.get('group')
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        return queryset


class ImportBatchViewSet(viewsets.ModelViewSet):
    queryset = ImportBatch.objects.all()
    serializer_class = ImportBatchSerializer
    filterset_fields = ('group',)

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return ImportBatch.objects.none()
        
        if user.is_superuser:
            queryset = self.queryset
        else:
            queryset = ImportBatch.objects.filter(group__memberships__user=user).distinct()
            
        group_id = self.request.query_params.get('group')
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        return queryset

    @action(detail=False, methods=['post'])
    def upload(self, request):
        """
        Receives a CSV file and a group ID, parses the rows, 
        creates the database records, and returns the import batch details.
        """
        group_id = request.data.get('group')
        file_obj = request.FILES.get('file')

        if not group_id:
            return Response({"error": "Group ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from groups.models import Group
            if not request.user.is_superuser:
                group = Group.objects.filter(id=group_id, memberships__user=request.user).first()
                if not group:
                    return Response({"error": "You do not have permission to access this group."}, status=status.HTTP_403_FORBIDDEN)
            else:
                group = Group.objects.get(id=group_id)
        except (Group.DoesNotExist, ValueError):
            return Response({"error": "Invalid group ID."}, status=status.HTTP_404_NOT_FOUND)

        if not file_obj:
            return Response({"error": "CSV file is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            file_content = file_obj.read()
            batch = CSVImportService.import_csv(
                group=group,
                file_name=file_obj.name,
                file_content=file_content,
                user=request.user if request.user.is_authenticated else None
            )
            serializer = self.get_serializer(batch)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": f"Import failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def report(self, request, pk=None):
        """
        Returns the report generated for this import batch.
        """
        batch = self.get_object()
        report = ImportReport.objects.filter(batch=batch).first()
        if not report:
            return Response({"error": "Import report not found for this batch."}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = ImportReportSerializer(report)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ImportRowViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ImportRow.objects.all()
    serializer_class = ImportRowSerializer
    filterset_fields = ('batch', 'import_status')

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return ImportRow.objects.none()
        
        if user.is_superuser:
            queryset = self.queryset
        else:
            queryset = ImportRow.objects.filter(batch__group__memberships__user=user).distinct()
            
        batch_id = self.request.query_params.get('batch')
        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        return queryset


class ImportReportViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ImportReport.objects.all()
    serializer_class = ImportReportSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return ImportReport.objects.none()
        
        if user.is_superuser:
            return self.queryset
        return ImportReport.objects.filter(batch__group__memberships__user=user).distinct()
