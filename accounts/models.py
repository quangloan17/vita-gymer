from django.conf import settings
from django.db import models

class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=80, default='Bạn')
    gender = models.CharField(max_length=20, default='other')
    age = models.PositiveIntegerField(default=25)
    height = models.FloatField(default=170)
    activity = models.CharField(max_length=30, default='moderate')
    goal = models.CharField(max_length=30, default='maintain')
    target_weight = models.FloatField(default=70)
    start_weight = models.FloatField(default=77)
    calories = models.PositiveIntegerField(default=2050)
    protein = models.PositiveIntegerField(default=150)
    carbs = models.PositiveIntegerField(default=220)
    fat = models.PositiveIntegerField(default=65)
    water = models.PositiveIntegerField(default=2500)
    steps = models.PositiveIntegerField(default=10000)
    frequency = models.PositiveIntegerField(default=4)
    theme = models.CharField(max_length=10, default='light')
    onboarded = models.BooleanField(default=False)
    score_weights = models.JSONField(default=dict)

class HealthGoal(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=30)
    target = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
