from datetime import timedelta

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import SyncSnapshot, ActiveData
from .merge import apply_delta


class PushSnapshotView(APIView):
    """POST /api/sync/push/ — принять полный снапшот."""

    def post(self, request):
        data = request.data
        meta = data.get('_meta', {})
        summary = data.get('_summary', {})

        if not meta.get('version'):
            return Response(
                {'error': 'Missing _meta.version'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        body_size = len(request.body) if hasattr(request, 'body') else 0

        # Clean data: strip internal keys for storage
        clean_data = {k: v for k, v in data.items() if not k.startswith('_')}

        # Save snapshot
        snapshot = SyncSnapshot.objects.create(
            device=request.auth,
            data=clean_data,
            summary=summary,
            schema_version=meta['version'],
            records_count=meta.get('records_count', 0),
            snapshot_size=body_size,
        )

        # Upsert ActiveData (single row, id=1)
        ActiveData.objects.update_or_create(
            id=1,
            defaults={
                'data': clean_data,
                'summary': summary,
                'schema_version': meta['version'],
            },
        )

        # Cleanup: keep last 30 days, minimum 3 snapshots per device
        device = request.auth
        cutoff = timezone.now() - timedelta(days=30)
        old = SyncSnapshot.objects.filter(device=device, created_at__lt=cutoff)
        total = SyncSnapshot.objects.filter(device=device).count()
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

        last = SyncSnapshot.objects.filter(device=request.auth).first()

        return Response({
            'has_data': True,
            'last_sync': last.created_at.isoformat() if last else None,
            'schema_version': active.schema_version,
            'records_count': last.records_count if last else 0,
            'updated_at': active.updated_at.isoformat(),
        })


class DeltaSyncView(APIView):
    """POST /api/sync/delta/ — применить дельту к ActiveData."""

    def post(self, request):
        changes = request.data.get('changes', [])
        meta = request.data.get('_meta', {})

        if not changes:
            return Response({'status': 'ok', 'applied': 0})

        try:
            active = ActiveData.objects.get(id=1)
        except ActiveData.DoesNotExist:
            return Response(
                {'error': 'No active data. Run full sync first.'},
                status=status.HTTP_409_CONFLICT,
            )

        active.data = apply_delta(active.data, changes)
        if meta.get('version'):
            active.schema_version = meta['version']
        active.save()

        return Response({
            'status': 'ok',
            'applied': len(changes),
            'timestamp': active.updated_at.isoformat(),
        })
