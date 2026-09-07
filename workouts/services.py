from django.db import transaction
from django.utils import timezone
from accounts.models import UserProfile
from nutrition.services import number
from .models import Workout, WorkoutSession, ExerciseSet

@transaction.atomic
def start(user, data):
    UserProfile.objects.select_for_update().get(user=user)
    active = WorkoutSession.objects.filter(user=user, finished_at__isnull=True).first()
    if active: return active
    return WorkoutSession.objects.create(user=user, workout=Workout.objects.get(pk=data['workout']))

@transaction.atomic
def complete_set(user, data):
    session = WorkoutSession.objects.select_for_update().get(pk=data['session'], user=user, finished_at__isnull=True)
    exercise = session.workout.exercises.get(exercise_id=data['exercise']).exercise
    return ExerciseSet.objects.create(session=session, exercise=exercise, weight=number(data, 'weight', 0, 600), reps=int(number(data, 'reps', 1, 100)))

@transaction.atomic
def finish(user, data):
    session = WorkoutSession.objects.select_for_update().get(pk=data['session'], user=user)
    if session.finished_at: return session
    session.finished_at = timezone.now()
    session.minutes = round((session.finished_at - session.started_at).total_seconds() / 60, 1)
    session.calories = round(session.minutes * session.workout.calories_per_minute)
    session.save()
    return session
