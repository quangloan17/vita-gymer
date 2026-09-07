import os
from datetime import timedelta
from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from accounts.models import UserProfile
from nutrition.models import Meal, Food, WaterLog, FavoriteFood, MealTemplate
from nutrition.services import save_meal
from measurements.models import WeightLog
from progress.models import StepLog, SleepLog
from workouts.models import WorkoutSession, Workout, ExerciseSet

class Command(BaseCommand):
    help = 'Tạo tài khoản demo và dữ liệu mẫu 7 ngày. Không thay đổi tài khoản có sẵn.'
    def add_arguments(self, parser):
        parser.add_argument('--username', default='demo')
    @transaction.atomic
    def handle(self, *args, **options):
        password = os.environ.get('VITA_DEMO_PASSWORD')
        if not password: raise CommandError('Đặt biến VITA_DEMO_PASSWORD để tạo tài khoản demo.')
        if User.objects.filter(username=options['username']).exists():
            self.stdout.write('Tài khoản đã tồn tại; không ghi đè dữ liệu.'); return
        call_command('seed_catalog')
        user = User.objects.create_user(options['username'], password=password)
        UserProfile.objects.create(user=user, name='Minh Anh', goal='lose', onboarded=True)
        today = timezone.localdate()
        food = list(Food.objects.all())
        plan = Workout.objects.first()
        for i in range(6, -1, -1):
            date = today - timedelta(days=i)
            WeightLog.objects.create(user=user, date=date, weight=74.6+i*.08)
            StepLog.objects.create(user=user, date=date, steps=8420+i*90)
            SleepLog.objects.create(user=user, date=date, minutes=438+i*3)
            for index, (kind, items) in enumerate([('breakfast', [food[2], food[4]]), ('lunch', [food[0], food[5]]), ('snack', [food[6]])]):
                meal = save_meal(user, {'kind': kind, 'items': [{'food': f.id, 'quantity': 1} for f in items]})
                meal.date = date
                meal.created_at = timezone.now().replace(hour=7+index*4, minute=15)-timedelta(days=i)
                meal.save()
            if i:
                meal = save_meal(user, {'kind': 'dinner', 'items': [{'food': food[7].id, 'quantity': 1}]})
                meal.date = date; meal.save()
            for hour in [7,9,11,13,15,17]: WaterLog.objects.create(user=user, amount=300, date=date, created_at=timezone.now().replace(hour=hour,minute=10)-timedelta(days=i))
            if i in [0,2,4,6]:
                end=timezone.now()-timedelta(days=i)
                session=WorkoutSession.objects.create(user=user,workout=plan,date=date,started_at=end-timedelta(minutes=52),finished_at=end,minutes=52,calories=312)
                for e in plan.exercises.all():
                    for _ in range(3): ExerciseSet.objects.create(session=session,exercise=e.exercise,weight=e.weight,reps=e.reps,completed_at=end)
        FavoriteFood.objects.create(user=user,food=food[0])
        FavoriteFood.objects.create(user=user,food=food[4])
        MealTemplate.objects.create(user=user,name='Bữa trưa quen thuộc',items=[{'food':food[0].id,'quantity':1}])
        self.stdout.write(self.style.SUCCESS('Đã tạo demo với nhật ký mẫu được lưu trong database.'))
