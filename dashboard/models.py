from django.conf import settings
from django.db import models
from django.utils import timezone


class Operation(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    client_id = models.UUIDField()
    resource = models.CharField(max_length=60)
    payload_hash = models.CharField(max_length=64)
    changes = models.JSONField(default=list)
    created_at = models.DateTimeField(default=timezone.now)
    undone_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'client_id'], name='unique_user_operation')]
        ordering = ['-created_at']
