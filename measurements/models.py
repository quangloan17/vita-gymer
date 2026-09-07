from django.conf import settings
from django.db import models
from django.utils import timezone

class WeightLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    weight = models.DecimalField(max_digits=5, decimal_places=1)
    date = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(default=timezone.now)

class BodyMeasurement(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.localdate)
    body_fat = models.FloatField(null=True, blank=True)
    waist = models.FloatField(null=True, blank=True)
    muscle = models.FloatField(null=True, blank=True)
