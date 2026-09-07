from datetime import timedelta
from django.forms.models import model_to_dict
from django.db.models import Q
from django.utils import timezone
from accounts.models import UserProfile
from nutrition.models import Food, Meal, FavoriteFood, MealTemplate, WaterLog
from nutrition.services import NUTRIENTS
from workouts.models import Workout, WorkoutSession
from measurements.models import WeightLog, BodyMeasurement
from progress.models import StepLog, SleepLog, DailySummary, ProgressPhoto
from coach.models import DailyCoachInsight
from coach.services import RuleBasedCoach
from notifications.models import NotificationPreference

def meal_json(m):
    return {'id': m.id, 'kind': m.kind, 'date': str(m.date), 'time': timezone.localtime(m.created_at).strftime('%H:%M'), 'items': [{'food': i.food_id, 'name': i.food.name, 'emoji': i.food.emoji, 'quantity': i.quantity, **i.nutrients} for i in m.items.all()]}

def summary(user, date):
    p, _ = UserProfile.objects.get_or_create(user=user)
    s = {k: 0 for k in NUTRIENTS}
    meals = Meal.objects.filter(user=user, date=date).prefetch_related('items')
    for m in meals:
        for i in m.items.all():
            for key in NUTRIENTS: s[key] += i.nutrients.get(key, 0)
    s = {k: round(v, 1) for k, v in s.items()}
    s['water'] = sum(WaterLog.objects.filter(user=user, date=date).values_list('amount', flat=True))
    sessions = WorkoutSession.objects.filter(user=user, date=date, finished_at__isnull=False)
    s['burned'] = round(sum(sessions.values_list('calories', flat=True)))
    s['workout_minutes'] = round(sum(sessions.values_list('minutes', flat=True)), 1)
    s['sessions'] = sessions.count()
    step = StepLog.objects.filter(user=user, date=date).first()
    sleep = SleepLog.objects.filter(user=user, date=date).first()
    weight = WeightLog.objects.filter(user=user, date__lte=date).order_by('-date', '-created_at').first()
    s.update(steps=step.steps if step else 0, sleep=sleep.minutes if sleep else 0, sleep_quality=sleep.quality if sleep else '', weight=float(weight.weight) if weight else None)
    weights = p.score_weights or {'nutrition': 30, 'workout': 25, 'water': 15, 'sleep': 15, 'steps': 15}
    ratios = {'nutrition': (min(s['protein']/p.protein, 1) + max(0, 1-abs(s['calories']-p.calories)/p.calories))/2, 'workout': min(s['workout_minutes']/30, 1), 'water': min(s['water']/p.water, 1), 'sleep': min(s['sleep']/480, 1), 'steps': min(s['steps']/p.steps, 1)}
    s['components'] = {k: round(v*100) for k,v in ratios.items()}
    s['score'] = round(sum(ratios[k]*weights.get(k, 0) for k in ratios)/max(sum(weights.values()), 1)*100)
    s['remaining'] = round(p.calories-s['calories']+s['burned'])
    s['date'] = str(date)
    DailySummary.objects.update_or_create(user=user, date=date, defaults={'data': s})
    return s

def snapshot(user):
    today = timezone.localdate()
    p, _ = UserProfile.objects.get_or_create(user=user)
    s = summary(user, today)
    days = [summary(user, today-timedelta(days=i)) for i in range(6, -1, -1)]
    streak = 0
    dates = set(WorkoutSession.objects.filter(user=user, finished_at__isnull=False, date__gte=today-timedelta(days=31)).values_list('date', flat=True))
    cursor = today if today in dates else today-timedelta(days=1)
    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)
    s['streak'] = streak
    insights = RuleBasedCoach().insights(s, p)
    DailyCoachInsight.objects.update_or_create(user=user, date=today, defaults={'messages': insights})
    history = Meal.objects.filter(user=user).order_by('-date', '-created_at').prefetch_related('items__food')[:100]
    sessions = []
    for x in WorkoutSession.objects.filter(user=user).select_related('workout').prefetch_related('sets').order_by('-started_at')[:60]:
        sessions.append({'id': x.id, 'workout': x.workout_id, 'name': x.workout.name, 'date': str(x.date), 'started_at': x.started_at.isoformat(), 'finished': bool(x.finished_at), 'minutes': x.minutes, 'calories': x.calories, 'sets': list(x.sets.values('id', 'exercise_id', 'weight', 'reps', 'completed_at'))})
    programs = [{'id': w.id, 'name': w.name, 'description': w.description, 'minutes': w.minutes, 'exercises': [{'id': e.exercise_id, 'name': e.exercise.name, 'muscle': e.exercise.muscle, 'sets': e.sets, 'reps': e.reps, 'weight': e.weight} for e in w.exercises.all()]} for w in Workout.objects.prefetch_related('exercises__exercise')]
    prefs, _ = NotificationPreference.objects.get_or_create(user=user)
    result = {'profile': model_to_dict(p, exclude=['id', 'user']), 'today': s, 'week': days, 'foods': list(Food.objects.filter(Q(user=user) | Q(user__isnull=True)).values()), 'meals': [meal_json(m) for m in history], 'favorites': list(FavoriteFood.objects.filter(user=user).values_list('food_id', flat=True)), 'templates': list(MealTemplate.objects.filter(user=user).values('id', 'name', 'items')), 'water_logs': list(WaterLog.objects.filter(user=user, date=today).order_by('-created_at').values('id', 'amount', 'created_at')), 'water_presets': [a for a in WaterLog.objects.filter(user=user).order_by('-created_at').values_list('amount', flat=True)[:10]], 'weights': list(WeightLog.objects.filter(user=user).order_by('date', 'created_at').values('id', 'date', 'weight'))[-90:], 'measurements': list(BodyMeasurement.objects.filter(user=user).order_by('-date', '-id').values('id', 'date', 'body_fat', 'waist', 'muscle')[:90]), 'programs': programs, 'sessions': sessions, 'insights': insights, 'notifications': prefs.preferences, 'photos': list(ProgressPhoto.objects.filter(user=user).order_by('-date').values('id', 'date')[:60])}

    from .intelligence import habits, workout_memory, weekly_report
    from .models import Operation
    from .journal import describe
    result.update(user_id=user.pk, habits=habits(user), workout_memory=workout_memory(user), report=weekly_report(user))
    result['recent_operations']=[{**describe(op),'created_at':op.created_at.isoformat()} for op in Operation.objects.filter(user=user)[:10] if op.changes]
    from coach.engine import build
    result['coaching']=build(user,result)
    from coach.journey import snapshot as journey_snapshot
    result['journey']=journey_snapshot(user,result['coaching'])
    return result
