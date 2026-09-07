import json
import uuid
from datetime import timedelta
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from accounts.models import UserProfile
from nutrition.models import Food, Meal
from measurements.models import WeightLog
from .models import DailyCheckIn, PlannedMeal, CoachFeedback, CoachConversation
from .engine import weight_trend

class CoachingTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('coach-test')
        self.other=User.objects.create_user('coach-other')
        UserProfile.objects.create(user=self.user)
        self.client.force_login(self.user)
        self.food=Food.objects.create(name='Test meal',calories=400,protein=30)
    def post(self,path,data,key=None):
        return self.client.post('/api/'+path+'/',json.dumps(data),content_type='application/json',HTTP_X_OPERATION_ID=key or str(uuid.uuid4()))
    def state(self):
        response=self.client.get('/api/dashboard/today/')
        self.assertEqual(response.status_code,200)
        return response.json()
    def plan(self,**kwargs):
        response=self.post('coach/plan',{'kind':'dinner','items':[{'food':self.food.pk,'quantity':1}],**kwargs})
        self.assertEqual(response.status_code,200)
        return PlannedMeal.objects.get(user=self.user)
    def test_plan_eat_retry_and_undo(self):
        plan=self.plan()
        self.assertEqual(self.state()['today']['calories'],0)
        result=self.post('coach/eat',{'id':plan.pk}).json()
        self.assertEqual(result['today']['calories'],400)
        self.assertEqual(self.post('coach/eat',{'id':plan.pk}).status_code,200)
        self.assertEqual(Meal.objects.count(),1)
        self.assertEqual(self.post('undo',{'operation':result['operation']['id']}).status_code,200)
        plan.refresh_from_db()
        self.assertIsNone(plan.meal_id)
        self.assertEqual(Meal.objects.count(),0)
    def test_future_plan_cannot_be_eaten(self):
        plan=self.plan(date=str(timezone.localdate()+timedelta(days=1)))
        self.assertEqual(self.post('coach/eat',{'id':plan.pk}).status_code,400)
        self.assertFalse(Meal.objects.exists())
    def test_account_ownership(self):
        plan=PlannedMeal.objects.create(user=self.other,name='private',items=[])
        self.assertEqual(self.post('coach/eat',{'id':plan.pk}).status_code,400)
        private=Food.objects.create(user=self.other,name='private',calories=300)
        self.assertEqual(self.post('coach/preferences',{'excluded_foods':[private.pk]}).status_code,400)
        self.assertEqual(self.post('coach/plan',{'kind':'lunch','items':[{'food':private.pk}]}).status_code,400)
        self.assertEqual(self.state()['coaching']['plans'],[])
    def test_review_is_not_wellbeing_checkin(self):
        state=self.post('coach/checkin',{'nutrition_complete':True}).json()['coaching']
        self.assertFalse(state['checkin']['wellbeing_complete'])
        self.assertIn('checkin',[a['key'] for a in state['actions']])
        self.assertEqual(state['nutrition_complete_days'],1)
    def test_checkin_changes_workout_and_rejects_bad_values(self):
        state=self.post('coach/checkin',{'energy':1,'stress':2,'soreness':2,'available_minutes':15}).json()['coaching']
        self.assertEqual(state['workout']['mode'],'gentle')
        self.assertNotIn('checkin',[a['key'] for a in state['all_actions']])
        self.assertEqual(self.post('coach/checkin',{'energy':6}).status_code,400)
        self.assertEqual(self.post('coach/checkin',{'nutrition_complete':'true'}).status_code,400)
    def test_filter_and_feedback_expiry(self):
        state=self.post('coach/preferences',{'excluded_foods':[self.food.pk]}).json()['coaching']
        self.assertEqual(state['nutrition']['options'],[])
        state=self.post('coach/feedback',{'key':'checkin','response':'later'}).json()['coaching']
        self.assertNotIn('checkin',[a['key'] for a in state['actions']])
        CoachFeedback.objects.update(date=timezone.localdate()-timedelta(days=1))
        self.assertIn('checkin',[a['key'] for a in self.state()['coaching']['actions']])
    def test_weight_uses_days_not_number_of_entries(self):
        today=timezone.localdate()
        for value in [80,79,78]: WeightLog.objects.create(user=self.user,date=today,weight=value)
        result=weight_trend(self.user)
        self.assertEqual(result['current_days'],1)
        self.assertEqual(result['current_average'],78)
        self.assertIsNone(result['delta'])
        for days,value in [(1,78),(2,78),(7,80),(8,80),(9,80)]:
            WeightLog.objects.create(user=self.user,date=today-timedelta(days=days),weight=value)
        self.assertEqual(weight_trend(self.user)['delta'],-2)
    def test_question_retry_and_private_history(self):
        key=str(uuid.uuid4())
        for _ in range(2):
            result=self.post('coach/ask',{'question':'Uống nước thế nào?'},key)
            self.assertEqual(result.status_code,200)
        self.assertEqual(CoachConversation.objects.filter(user=self.user).count(),1)
        self.assertIn('0 /',result.json()['coaching']['conversations'][0]['answer'])
        CoachConversation.objects.create(user=self.other,question='secret',answer='secret',topic='scope')
        self.assertEqual(len(self.state()['coaching']['conversations']),1)
        self.assertEqual(self.post('coach/ask',{'question':'thời tiết'}).json()['coaching']['conversations'][-1]['topic'],'scope')
    def test_weekly_question_and_focus(self):
        self.assertEqual(self.post('coach/ask',{'question':'Tổng kết tuần này'}).status_code,200)
        state=self.post('coach/focus',{'metric':'water','target_days':4}).json()['coaching']
        self.assertEqual(state['focus']['completed'],0)
        self.post('water',{'amount':200});self.post('water',{'amount':200})
        self.assertEqual(self.state()['coaching']['focus']['completed'],1)
    def test_volume_comparison_discloses_different_sets(self):
        from .engine import workout_analysis
        from .models import CoachingPreference
        state=self.state()
        entry={'exercise_id':99,'weight':20,'reps':10}
        state['sessions']=[{'finished':True,'date':str(timezone.localdate()),'sets':[entry,entry]}, {'finished':True,'date':str(timezone.localdate()-timedelta(days=1)),'sets':[entry]}]
        result=workout_analysis(state,None,CoachingPreference.objects.get(user=self.user))
        self.assertEqual(result['comparisons'][0]['delta'],200)
        self.assertFalse(result['comparisons'][0]['comparable_sets'])
    def test_need_water_question_is_not_weight_and_export_private(self):
        result=self.post('coach/ask',{'question':'Cần uống nước bao nhiêu?'}).json()
        self.assertEqual(result['coaching']['conversations'][-1]['topic'],'water')
        DailyCheckIn.objects.create(user=self.other,reflection='private')
        export=self.client.get('/api/export/').json()
        self.assertEqual(export['dailycheckin'],[])
