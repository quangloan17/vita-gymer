from django.conf import settings
from django.db import models
from django.utils import timezone

class DailyCoachInsight(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.localdate)
    messages = models.JSONField(default=list)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'date'], name='unique_coach_day')]


class DailyCheckIn(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.localdate)
    energy = models.PositiveSmallIntegerField(default=3)
    stress = models.PositiveSmallIntegerField(default=3)
    soreness = models.PositiveSmallIntegerField(default=1)
    available_minutes = models.PositiveSmallIntegerField(default=30)
    wellbeing_complete = models.BooleanField(default=False)
    nutrition_complete = models.BooleanField(default=False)
    reflection = models.CharField(max_length=300, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user','date'],name='unique_coach_checkin')]


class CoachingPreference(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    style = models.CharField(max_length=12,default='brief')
    available_minutes = models.PositiveSmallIntegerField(default=30)
    meal_budget = models.PositiveSmallIntegerField(default=500)
    excluded_foods = models.JSONField(default=list)
    favorites_only = models.BooleanField(default=False)


class CoachFeedback(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.localdate)
    action_key = models.CharField(max_length=40)
    response = models.CharField(max_length=20)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user','date','action_key'],name='unique_coach_feedback')]


class PlannedMeal(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField(default=timezone.localdate)
    kind = models.CharField(max_length=20,default='dinner')
    name = models.CharField(max_length=160)
    items = models.JSONField(default=list)
    meal = models.OneToOneField('nutrition.Meal',null=True,blank=True,on_delete=models.SET_NULL)
    created_at = models.DateTimeField(default=timezone.now)


class WeeklyFocus(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    week_start = models.DateField()
    metric = models.CharField(max_length=20,default='water')
    target_days = models.PositiveSmallIntegerField(default=4)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user','week_start'],name='unique_coach_focus')]


class CoachConversation(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    question = models.CharField(max_length=500)
    answer = models.TextField()
    topic = models.CharField(max_length=20)
    created_at = models.DateTimeField(default=timezone.now)


class CoachingJourney(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    step = models.PositiveSmallIntegerField(default=0)
    answers = models.JSONField(default=dict)
    started = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class MonthlyRoadmap(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    month = models.DateField()
    days = models.JSONField(default=dict)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user','month'], name='unique_monthly_roadmap')]
