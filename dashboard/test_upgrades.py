import json
import uuid
from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth.models import User
from django.core import signing
from django.test import TestCase
from django.utils import timezone
from accounts.models import UserProfile
from nutrition.models import Food, Meal, WaterLog
from nutrition.services import save_meal
from workouts.models import Workout, Exercise, WorkoutExercise, WorkoutSession, ExerciseSet
from progress.models import SleepLog, StepLog
from .smart_logging import interpret, SALT
from .intelligence import habits, workout_memory, weekly_report
from .models import Operation


class UpgradeTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('smart-user')
        self.other=User.objects.create_user('other-user')
        UserProfile.objects.create(user=self.user)
        self.client.force_login(self.user)
        self.food=Food.objects.create(name='Phở bò',calories=450,protein=25)
        self.banana=Food.objects.create(name='Chuối',calories=105,protein=1.3)
    def post(self,resource,data,key=None,**headers):
        return self.client.post('/api/'+resource+'/',json.dumps(data),content_type='application/json',HTTP_X_OPERATION_ID=key or str(uuid.uuid4()),**headers)
    def test_vietnamese_preview_does_not_write(self):
        result=interpret(self.user,'Trưa ăn phở bò, uống 350ml nước; cân 74,6kg; ngủ 7h30; đi 8.420 bước')
        self.assertEqual(result['unresolved'],[])
        self.assertEqual(len(result['events']),5)
        self.assertEqual(result['events'][0]['data']['kind'],'lunch')
        self.assertEqual(result['events'][2]['data']['weight'],74.6)
        self.assertEqual(result['events'][3]['data']['minutes'],450)
        self.assertEqual(result['events'][4]['data']['steps'],8420)
        self.assertFalse(Meal.objects.exists());self.assertFalse(WaterLog.objects.exists())
    def test_accentless_quantity_and_unknown_text(self):
        result=interpret(self.user,'trua an 2 chuoi; uong 0,5 lit')
        self.assertEqual(result['events'][0]['data']['items'][0]['quantity'],2)
        self.assertEqual(result['events'][1]['data']['amount'],500)
        result=interpret(self.user,'ăn phở bò thêm bánh; uống 350ml')
        self.assertTrue(result['unresolved']);self.assertIsNone(result['token'])
    def test_signed_commit_and_undo_batch(self):
        token=interpret(self.user,'trưa ăn phở bò; uống 350ml')['token']
        result=self.post('smart/commit',{'token':token})
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['today']['water'],350)
        self.assertEqual(result.json()['today']['calories'],450)
        undo=self.post('undo',{'operation':result.json()['operation']['id']})
        self.assertEqual(undo.status_code,200)
        self.assertFalse(Meal.objects.exists());self.assertFalse(WaterLog.objects.exists())
    def test_token_user_and_expiry(self):
        token=interpret(self.other,'uống 250ml')['token']
        self.assertEqual(self.post('smart/commit',{'token':token}).status_code,400)
        with patch('django.core.signing.time.time',return_value=100): token=interpret(self.user,'uống 250ml')['token']
        self.assertEqual(self.post('smart/commit',{'token':token}).status_code,400)
    def test_retry_is_idempotent_and_conflicts_rejected(self):
        key=str(uuid.uuid4())
        first=self.post('water',{'amount':250},key)
        second=self.post('water',{'amount':250},key)
        self.assertEqual(first.status_code,200);self.assertEqual(second.status_code,200)
        self.assertEqual(WaterLog.objects.count(),1)
        self.assertEqual(self.post('water',{'amount':500},key).status_code,400)
        self.assertEqual(WaterLog.objects.count(),1)
    def test_undo_replay_does_not_recreate_record(self):
        key=str(uuid.uuid4());self.post('water',{'amount':250},key)
        self.post('undo',{'operation':key})
        self.assertEqual(self.post('water',{'amount':250},key).status_code,200)
        self.assertFalse(WaterLog.objects.exists())
    def test_undo_refuses_changed_meal(self):
        first=self.post('meals',{'kind':'lunch','items':[{'food':self.food.id}]})
        meal=Meal.objects.get()
        self.post('meals',{'id':meal.pk,'kind':'lunch','items':[{'food':self.food.id,'quantity':2}]})
        response=self.post('undo',{'operation':first.json()['operation']['id']})
        self.assertEqual(response.status_code,400)
        self.assertEqual(Meal.objects.get().items.get().quantity,2)
    def test_undo_restores_previous_sleep_and_is_user_scoped(self):
        SleepLog.objects.create(user=self.user,minutes=420)
        result=self.post('sleep',{'minutes':480})
        self.post('undo',{'operation':result.json()['operation']['id']})
        self.assertEqual(SleepLog.objects.get().minutes,420)
        self.client.force_login(self.other)
        self.assertEqual(self.post('undo',{'operation':result.json()['operation']['id']}).status_code,400)
    def test_offline_keeps_original_day_and_account(self):
        yesterday=timezone.now()-timedelta(days=1)
        result=self.post('water',{'amount':250,'logged_at':yesterday.isoformat()})
        self.assertEqual(result.status_code,200)
        self.assertEqual(WaterLog.objects.get().date,timezone.localdate(yesterday))
        self.assertEqual(result.json()['today']['water'],0)
        self.assertEqual(self.post('water',{'amount':250},HTTP_X_ACCOUNT_ID=str(self.other.pk)).status_code,403)
        self.assertEqual(self.post('water',{'amount':250,'logged_at':(yesterday-timedelta(days=10)).isoformat()}).status_code,400)
    def test_habits_frequency_portions_and_private_history(self):
        for _ in range(3): WaterLog.objects.create(user=self.user,amount=350)
        WaterLog.objects.create(user=self.user,amount=750)
        WaterLog.objects.create(user=self.other,amount=1000)
        save_meal(self.user,{'kind':'lunch','items':[{'food':self.food.pk,'quantity':1.5}]})
        result=habits(self.user)
        self.assertEqual(result['water_presets'][0],350)
        self.assertEqual(result['portions'][str(self.food.pk)],1.5)
    def test_workout_memory_uses_completed_sessions(self):
        workout=Workout.objects.create(name='Push')
        exercise=Exercise.objects.create(name='Bench',muscle='Chest')
        old=WorkoutSession.objects.create(user=self.user,workout=workout,finished_at=timezone.now())
        ExerciseSet.objects.create(session=old,exercise=exercise,weight=50,reps=8)
        active=WorkoutSession.objects.create(user=self.user,workout=workout)
        ExerciseSet.objects.create(session=active,exercise=exercise,weight=90,reps=3)
        self.assertEqual(workout_memory(self.user)[str(exercise.pk)]['sets'][0]['weight'],50)
    def test_report_does_not_treat_missing_days_as_zero(self):
        save_meal(self.user,{'kind':'lunch','items':[{'food':self.food.pk}]})
        result=weekly_report(self.user)
        self.assertEqual(result['current']['calories'],450)
        self.assertEqual(result['current']['meal_days'],1)
        self.assertIsNone(result['previous']['calories'])
        self.assertIsNone(result['changes']['calories'])
    def test_expired_undo(self):
        result=self.post('water',{'amount':250})
        Operation.objects.update(created_at=timezone.now()-timedelta(days=2))
        self.assertEqual(self.post('undo',{'operation':result.json()['operation']['id']}).status_code,400)
    def test_batch_failure_rolls_back_earlier_events(self):
        token=interpret(self.user,'uống 350ml; ăn phở bò')['token']
        self.food.delete()
        self.assertEqual(self.post('smart/commit',{'token':token}).status_code,400)
        self.assertFalse(WaterLog.objects.exists())
    def test_undo_only_affects_the_recorded_day(self):
        old=WaterLog.objects.create(user=self.user,date=timezone.localdate()-timedelta(days=3),amount=750)
        result=self.post('water',{'amount':250})
        self.post('undo',{'operation':result.json()['operation']['id']})
        self.assertEqual(list(WaterLog.objects.values_list('pk',flat=True)),[old.pk])
