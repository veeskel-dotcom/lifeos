from django.urls import path
from .views import PushSnapshotView, SyncStatusView

urlpatterns = [
    path('push/', PushSnapshotView.as_view(), name='sync-push'),
    path('status/', SyncStatusView.as_view(), name='sync-status'),
]
