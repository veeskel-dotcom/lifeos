import uuid
from django.db import models


class DeviceToken(models.Model):
    """Токен устройства для аутентификации sync-запросов."""
    token = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    name = models.CharField(max_length=100, default='iPhone')
    created_at = models.DateTimeField(auto_now_add=True)
    last_used = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Device Token'

    def __str__(self):
        return f"{self.name} ({str(self.token)[:8]}...)"


class SyncSnapshot(models.Model):
    """Снапшот данных. Хранить 30 дней, минимум 3."""
    device = models.ForeignKey(DeviceToken, on_delete=models.CASCADE, related_name='snapshots')
    data = models.JSONField()
    summary = models.JSONField(default=dict)
    schema_version = models.IntegerField()
    records_count = models.IntegerField()
    snapshot_size = models.IntegerField(help_text='bytes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['-created_at'])]

    def __str__(self):
        return f"Snapshot #{self.id} ({self.created_at:%Y-%m-%d %H:%M})"


class ActiveData(models.Model):
    """Актуальные данные — всегда 1 строка. Дашборд читает отсюда."""
    data = models.JSONField()
    summary = models.JSONField(default=dict)
    schema_version = models.IntegerField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Active Data'
        verbose_name_plural = 'Active Data'

    def __str__(self):
        return f"ActiveData (v{self.schema_version}, {self.updated_at:%Y-%m-%d %H:%M})"


class ServerChange(models.Model):
    """Изменения, сделанные на дашборде. Клиент пуллит их."""
    table_name = models.CharField(max_length=50)
    record_id = models.BigIntegerField()
    op = models.CharField(max_length=10)  # add, update, delete
    data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [models.Index(fields=['created_at'])]

    def __str__(self):
        return f"{self.op} {self.table_name}#{self.record_id}"
