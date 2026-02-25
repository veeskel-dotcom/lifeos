from django.contrib import admin
from .models import DeviceToken, SyncSnapshot, ActiveData


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ('name', 'token', 'is_active', 'last_used', 'created_at')
    list_filter = ('is_active',)
    readonly_fields = ('token', 'created_at')


@admin.register(SyncSnapshot)
class SyncSnapshotAdmin(admin.ModelAdmin):
    list_display = ('id', 'device', 'schema_version', 'records_count', 'size_display', 'created_at')
    list_filter = ('device', 'schema_version')
    readonly_fields = ('data', 'summary', 'created_at')

    def size_display(self, obj):
        return f"{obj.snapshot_size / 1024:.1f} KB"
    size_display.short_description = 'Size'


@admin.register(ActiveData)
class ActiveDataAdmin(admin.ModelAdmin):
    list_display = ('id', 'schema_version', 'updated_at')
    readonly_fields = ('data', 'summary', 'updated_at')
