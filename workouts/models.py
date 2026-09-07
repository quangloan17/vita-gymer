from django.conf import settings
from django.db import models
from django.utils import timezone

class Exercise(models.Model):
    name = models.CharField(max_length=100)
    muscle = models.CharField(max_length=60)

class Workout(models.Model):
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=160, blank=True)
    minutes = models.PositiveIntegerField(default=45)
    calories_per_minute = models.FloatField(default=6)

class WorkoutExercise(models.Model):
    workout = models.ForeignKey(Workout, related_name='exercises', on_delete=models.CASCADE)
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    sets = models.PositiveIntegerField(default=3)
    reps = models.PositiveIntegerField(default=10)
    weight = models.FloatField(default=20)
    class Meta:
        ordering = ['order', 'id']

class WorkoutSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    workout = models.ForeignKey(Workout, on_delete=models.PROTECT)
    date = models.DateField(default=timezone.localdate)
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    minutes = models.FloatField(default=0)
    calories = models.FloatField(default=0)

class ExerciseSet(models.Model):
    session = models.ForeignKey(WorkoutSession, related_name='sets', on_delete=models.CASCADE)
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT)
    weight = models.FloatField()
    reps = models.PositiveIntegerField()
    completed_at = models.DateTimeField(default=timezone.now)
