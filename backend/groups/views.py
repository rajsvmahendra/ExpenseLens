from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from expenses.services import BalanceService
from .models import Group, GroupMembership, CurrencyRate
from .serializers import GroupSerializer, GroupMembershipSerializer, CurrencyRateSerializer

class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return Group.objects.none()
        if user.is_superuser:
            return Group.objects.all()
        return Group.objects.filter(memberships__user=user).distinct()

    @action(detail=True, methods=['get'])
    def balances(self, request, pk=None):
        """
        Returns the group balance summary (individual summaries + simplified debts).
        """
        group = self.get_object()
        summary = BalanceService.get_group_balance_summary(group.id)
        return Response(summary, status=status.HTTP_200_OK)


class GroupMembershipViewSet(viewsets.ModelViewSet):
    queryset = GroupMembership.objects.all()
    serializer_class = GroupMembershipSerializer
    filterset_fields = ('group',)

    def get_queryset(self):
        user = self.request.user
        if not user or user.is_anonymous:
            return GroupMembership.objects.none()
        
        if user.is_superuser:
            queryset = GroupMembership.objects.all()
        else:
            queryset = GroupMembership.objects.filter(group__memberships__user=user).distinct()
            
        group_id = self.request.query_params.get('group')
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        return queryset

    def create(self, request, *args, **kwargs):
        """
        Ensures that names are unique within a single group membership list.
        """
        group_id = request.data.get('group')
        name = request.data.get('name')
        
        if GroupMembership.objects.filter(group_id=group_id, name__iexact=name).exists():
            return Response(
                {"error": f"Member '{name}' already exists in this group."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        return super().create(request, *args, **kwargs)


class CurrencyRateViewSet(viewsets.ModelViewSet):
    queryset = CurrencyRate.objects.all()
    serializer_class = CurrencyRateSerializer
    filterset_fields = ('from_currency', 'to_currency')


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    """
    API endpoint to register a new user in the system.
    Returns token on success.
    """
    username = request.data.get('username')
    password = request.data.get('password')
    email = request.data.get('email', '')
    
    if not username or not password:
        return Response({"error": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)
        
    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)
        
    user = User.objects.create_user(username=username, email=email, password=password)
    token, _ = Token.objects.get_or_create(user=user)
    
    return Response({
        "token": token.key,
        "user_id": user.id,
        "username": user.username
    }, status=status.HTTP_201_CREATED)

