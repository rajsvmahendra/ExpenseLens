"""
URL configuration for expenselens project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token

from groups.views import GroupViewSet, GroupMembershipViewSet, CurrencyRateViewSet, register_user
from expenses.views import ExpenseViewSet, SettlementViewSet, ImportBatchViewSet, ImportRowViewSet, ImportReportViewSet
from audit.views import AuditAnomalyViewSet, DecisionTrailViewSet

# API Router setup
router = DefaultRouter()
router.register(r'groups', GroupViewSet, basename='group')
router.register(r'memberships', GroupMembershipViewSet, basename='membership')
router.register(r'currency-rates', CurrencyRateViewSet, basename='currency-rate')
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'settlements', SettlementViewSet, basename='settlement')
router.register(r'import-batches', ImportBatchViewSet, basename='import-batch')
router.register(r'import-rows', ImportRowViewSet, basename='import-row')
router.register(r'import-reports', ImportReportViewSet, basename='import-report')
router.register(r'anomalies', AuditAnomalyViewSet, basename='anomaly')
router.register(r'decisions', DecisionTrailViewSet, basename='decision')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API Endpoints
    path('api/', include(router.urls)),
    
    # Auth Endpoints
    path('api/auth/register/', register_user, name='register'),
    path('api/auth/login/', obtain_auth_token, name='login'),
]

