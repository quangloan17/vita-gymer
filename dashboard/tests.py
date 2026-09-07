import json
from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase, Client
from django.utils import timezone
from accounts.models import UserProfile
from nutrition.models import Food, Meal, WaterLog
from nutrition.services import save_meal
from workouts.models import Workout, Exercise, WorkoutExercise, WorkoutSession
from dashboard.services import summary

class HealthApiTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('alice',password='test-password-long')
        self.other=User.objects.create_user('bob',password='test-password-long')
        UserProfile.objects.create(user=self.user)
        self.client.force_login(self.user)
        self.food=Food.objects.create(name='Test meal',calories=300,protein=25,carbs=40,fat=10)
    def post(self,path,data): return self.client.post('/api/'+path+'/',json.dumps(data),content_type='application/json')
    def test_water_persists_and_summary_updates(self):
        response=self.post('water',{'amount':250})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['today']['water'],250)
        self.assertEqual(WaterLog.objects.get().amount,250)
        self.assertEqual(self.client.get('/api/dashboard/today/').json()['today']['water'],250)
    def test_invalid_and_nonfinite_inputs_rejected(self):
        for amount in [-1,0,3001,'nan','inf',None]: self.assertEqual(self.post('water',{'amount':amount}).status_code,400)
        self.assertFalse(WaterLog.objects.exists())
        self.assertEqual(self.post('weight',{'weight':-5}).status_code,400)
        self.assertEqual(self.post('profile',{'calories':0}).status_code,400)
    def test_meal_nutrients_snapshot_and_atomicity(self):
        response=self.post('meals',{'kind':'breakfast','items':[{'food':self.food.id,'quantity':2}]})
        self.assertEqual(response.json()['today']['calories'],600)
        self.food.calories=900;self.food.save()
        self.assertEqual(summary(self.user,timezone.localdate())['calories'],600)
        response=self.post('meals',{'kind':'lunch','items':[{'food':self.food.id},{'food':99999}]})
        self.assertEqual(response.status_code,400)
        self.assertEqual(Meal.objects.count(),1)
    def test_user_isolation(self):
        m=save_meal(self.other,{'kind':'lunch','items':[{'food':self.food.id}]})
        self.assertEqual(self.client.get('/api/dashboard/today/').json()['meals'],[])
        response=self.post('meals',{'id':m.id,'kind':'dinner','items':[{'food':self.food.id}]})
        self.assertEqual(response.status_code,400)
        self.assertTrue(Meal.objects.filter(pk=m.id).exists())
    def test_workout_lifecycle_and_idempotent_finish(self):
        w=Workout.objects.create(name='Push')
        e=Exercise.objects.create(name='Bench',muscle='Chest')
        WorkoutExercise.objects.create(workout=w,exercise=e)
        self.assertEqual(self.post('workouts/start',{'workout':w.id}).status_code,200)
        self.post('workouts/start',{'workout':w.id})
        self.assertEqual(WorkoutSession.objects.count(),1)
        session=WorkoutSession.objects.get()
        session.started_at=timezone.now()-timedelta(minutes=30);session.save()
        self.assertEqual(self.post('workouts/set',{'session':session.id,'exercise':e.id,'weight':40,'reps':10}).status_code,200)
        self.assertEqual(self.post('workouts/set',{'session':session.id,'exercise':e.id,'weight':-1,'reps':10}).status_code,400)
        result=self.post('workouts/finish',{'session':session.id}).json()['today']
        self.assertEqual(result['burned'],180)
        self.assertEqual(self.post('workouts/finish',{'session':session.id}).json()['today']['burned'],180)
        self.assertEqual(self.post('workouts/set',{'session':session.id,'exercise':e.id,'weight':40,'reps':10}).status_code,400)
    def test_daily_rollover_and_score_bounds(self):
        WaterLog.objects.create(user=self.user,date=timezone.localdate()-timedelta(days=1),amount=500)
        self.assertEqual(summary(self.user,timezone.localdate())['water'],0)
        self.post('water',{'amount':3000})
        s=summary(self.user,timezone.localdate())
        self.assertGreaterEqual(s['score'],0);self.assertLessEqual(s['score'],100)
    def test_csrf_and_auth(self):
        c=Client(enforce_csrf_checks=True)
        self.assertEqual(c.get('/api/dashboard/today/').status_code,302)
        c.force_login(self.user)
        self.assertEqual(c.post('/api/water/',json.dumps({'amount':250}),content_type='application/json').status_code,403)
    def test_sleep_upserts_and_weight_validation_rolls_back(self):
        self.post('sleep',{'minutes':420});self.post('sleep',{'minutes':480})
        self.assertEqual(self.client.get('/api/dashboard/today/').json()['today']['sleep'],480)
        self.assertEqual(self.post('weight',{'weight':74,'body_fat':900}).status_code,400)
        self.assertEqual(self.client.get('/api/dashboard/today/').json()['weights'],[])
    def test_custom_foods_are_private(self):
        private=Food.objects.create(user=self.other,name='Private',calories=100)
        self.assertNotIn(private.id,[f['id'] for f in self.client.get('/api/dashboard/today/').json()['foods']])
        self.assertEqual(self.post('meals',{'kind':'lunch','items':[{'food':private.id}]}).status_code,400)
        self.assertEqual(self.post('favorites',{'food':private.id}).status_code,400)
    def test_export_includes_older_logs(self):
        WaterLog.objects.create(user=self.user,date=timezone.localdate()-timedelta(days=100),amount=250)
        WaterLog.objects.create(user=self.other,amount=700)
        response=self.client.get('/api/export/')
        self.assertEqual(response.status_code,200)
        self.assertEqual([x['amount'] for x in response.json()['water']],[250])
    def test_coach_rules_and_score_weights(self):
        from unittest.mock import patch
        from coach.services import RuleBasedCoach
        from datetime import datetime
        p=UserProfile.objects.get(user=self.user)
        s=summary(self.user,timezone.localdate())
        with patch('coach.services.timezone.localtime',return_value=datetime(2026,9,6,19)):
            messages=RuleBasedCoach().insights(s,p)
        self.assertIn('Đừng quên protein',[m['title'] for m in messages])
        self.assertIn('Đến giờ uống nước',[m['title'] for m in messages])
        self.assertEqual(self.post('profile',{'score_weights':{'nutrition':50,'workout':50,'water':50,'sleep':50,'steps':50}}).status_code,400)
    def test_private_photo_access_and_invalid_upload(self):
        from progress.models import ProgressPhoto
        photo=ProgressPhoto.objects.create(user=self.other,image='data:image/png;base64,aGVsbG8=')
        self.assertEqual(self.client.get(f'/photos/{photo.id}/').status_code,404)
        self.assertEqual(self.post('photos',{'image':'data:image/png;base64,aGVsbG8='}).status_code,400)
    def test_onboarding_accepts_initial_profile_defaults(self):
        profile=self.client.get('/api/dashboard/today/').json()['profile']
        profile['onboarded']=True
        self.assertEqual(self.post('profile',profile).status_code,200)
        self.assertTrue(UserProfile.objects.get(user=self.user).onboarded)
