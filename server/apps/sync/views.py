from datetime import timedelta

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import SyncSnapshot, ActiveData


class PushSnapshotView(APIView):
    """POST /api/sync/push/ — принять полный снапшот."""

    def post(self, request):
        data = request.data
        meta = data.get('_meta', {})
        summary = data.pop('_summary', {})

        if not meta.get('version'):
            return Response(
                {'error': 'Missing _meta.version'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        body_size = len(request.body) if hasattr(request, 'body') else 0

        # Save snapshot
        snapshot = SyncSnapshot.objects.create(
            device=request.user,
            data=data,
            summary=summary,
            schema_version=meta['version'],
            records_count=meta.get('records_count', 0),
            snapshot_size=body_size,
        )

        # Upsert ActiveData (single row, id=1)
        ActiveData.objects.update_or_create(
            id=1,
            defaults={
                'data': data,
                'summary': summary,
                'schema_version': meta['version'],
            },
        )

        # Cleanup: keep last 30 days, minimum 3 snapshots
        cutoff = timezone.now() - timedelta(days=30)
        old = SyncSnapshot.objects.filter(created_at__lt=cutoff)
        total = SyncSnapshot.objects.count()
        if total - old.count() >= 3:
            old.delete()

        return Response({
            'status': 'ok',
            'snapshot_id': snapshot.id,
            'records': snapshot.records_count,
            'size_kb': round(snapshot.snapshot_size / 1024, 1),
            'timestamp': snapshot.created_at.isoformat(),
        })


class SyncStatusView(APIView):
    """GET /api/sync/status/ — статус последней синхронизации."""

    def get(self, request):
        active = ActiveData.objects.first()
        if not active:
            return Response({'has_data': False})

        last = SyncSnapshot.objects.filter(device=request.user).first()

        return Response({
            'has_data': True,
            'last_sync': last.created_at.isoformat() if last else None,
            'schema_version': active.schema_version,
            'records_count': active.data.get('_meta', {}).get('records_count', 0),
            'updated_at': active.updated_at.isoformat(),
        })
