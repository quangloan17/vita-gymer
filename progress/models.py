from django.conf import settings
from django.db import models
from django.utils import timezone

class StepLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.localdate)
    steps = models.PositiveIntegerField(default=0)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'date'], name='unique_steps_day')]

class SleepLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.localdate)
    minutes = models.PositiveIntegerField(default=0)
    quality = models.CharField(max_length=20, default='good')
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'date'], name='unique_sleep_day')]

class DailySummary(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.localdate)
    data = models.JSONField(default=dict)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'date'], name='unique_summary_day')]

class ProgressPhoto(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.localdate)
    image = models.TextField()
