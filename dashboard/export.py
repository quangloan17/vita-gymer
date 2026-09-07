from django.forms.models import model_to_dict
from accounts.models import UserProfile, HealthGoal
from nutrition.models import Meal, Food, FavoriteFood, MealTemplate, WaterLog
from workouts.models import WorkoutSession
from measurements.models import WeightLog, BodyMeasurement
from progress.models import StepLog, SleepLog, ProgressPhoto
from notifications.models import NotificationPreference
from .services import meal_json

def export_data(user):
    """Full portable account export, without dashboard pagination or auth secrets."""
    profile, _ = UserProfile.objects.get_or_create(user=user)
    result = {'profile': model_to_dict(profile, exclude=['id', 'user']), 'meals': [meal_json(m) for m in Meal.objects.filter(user=user).prefetch_related('items__food')], 'sessions': []}
    for name, model in [('goals', HealthGoal), ('custom_foods', Food), ('favorites', FavoriteFood), ('templates', MealTemplate), ('water', WaterLog), ('weights', WeightLog), ('measurements', BodyMeasurement), ('steps', StepLog), ('sleep', SleepLog), ('photos', ProgressPhoto), ('notifications', NotificationPreference)]:
        result[name] = [{k:v for k,v in row.items() if k != 'user_id'} for row in model.objects.filter(user=user).values()]
    for session in WorkoutSession.objects.filter(user=user).prefetch_related('sets'):
        result['sessions'].append({**model_to_dict(session, exclude=['user']), 'sets': list(session.sets.values())})
    from coach.models import DailyCheckIn, CoachingPreference, CoachFeedback, PlannedMeal, WeeklyFocus, CoachConversation, CoachingJourney, MonthlyRoadmap
    for model in [DailyCheckIn, CoachingPreference, CoachFeedback, PlannedMeal, WeeklyFocus, CoachConversation, CoachingJourney, MonthlyRoadmap]:
        result[model._meta.model_name] = [{k:v for k,v in row.items() if k != 'user_id'} for row in model.objects.filter(user=user).values()]
    return result
