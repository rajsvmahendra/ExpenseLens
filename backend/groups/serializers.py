from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Group, GroupMembership, CurrencyRate

class UserMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ('id', 'name', 'description', 'base_currency', 'created_at')
        read_only_fields = ('id', 'created_at')


class GroupMembershipSerializer(serializers.ModelSerializer):
    user_detail = UserMinimalSerializer(source='user', read_only=True)
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )
    group_name = serializers.CharField(source='group.name', read_only=True)

    class Meta:
        model = GroupMembership
        fields = ('id', 'group', 'group_name', 'user', 'user_detail', 'name', 'joined_at', 'left_at', 'created_at')
        read_only_fields = ('id', 'created_at')


class CurrencyRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CurrencyRate
        fields = ('id', 'from_currency', 'to_currency', 'exchange_rate', 'effective_date', 'created_at')
        read_only_fields = ('id', 'created_at')
