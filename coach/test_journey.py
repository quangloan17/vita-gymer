from datetime import date, timedelta, datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo
from django.test import TestCase
from . import tests as common
from .models import CoachingJourney, MonthlyRoadmap
from .journey import snapshot

class JourneyTests(TestCase):
    setUp=common.CoachingTests.setUp
    post=common.CoachingTests.post
    state=common.CoachingTests.state
    def complete(self, days=None):
        payloads=[{'name':'Test','age':30,'height':170,'start_weight':70,'target_weight':70,'goal':'maintain'}, {'days':days if days is not None else [0,2,4],'experience':'new','equipment':'bodyweight','minutes':30,'hour':18,'limitations':''}, {'calories':2000,'protein':100,'carbs':250,'fat':67,'water':2000,'steps':6000}, {'wake_hour':7,'bed_hour':22,'review_day':6}, {'confirmed':True}]
        for i,payload in enumerate(payloads):
            response=self.post('coach/setup',{'step':i,**payload})
            self.assertEqual(response.status_code,200,response.content[:200])
        return response.json()
    def test_setup_does_not_skip_or_create_activity(self):
        self.assertEqual(self.post('coach/setup',{'step':4,'confirmed':True}).status_code,400)
        state=self.complete()
        self.assertEqual(state['journey']['step'],5)
        self.assertEqual(state['today']['calories'],0)
        self.assertEqual(state['today']['sessions'],0)
        self.assertEqual(state['weights'],[])
        self.assertTrue(state['profile']['onboarded'])
    def test_calendar_excludes_pre_start_and_is_private(self):
        state=self.complete()
        self.assertTrue(all(x['date']>=state['today']['date'] for x in state['journey']['days']))
        self.client.force_login(self.other)
        state=self.state()
        self.assertEqual(state['journey']['days'],[])
        self.assertEqual(state['journey']['answers'],{})
    def test_setup_resume_and_atomic_invalid_step(self):
        self.assertEqual(self.post('coach/setup',{'step':0,'name':'Saved','age':30,'height':170,'start_weight':70,'target_weight':65,'goal':'lose'}).status_code,200)
        self.assertEqual(self.state()['journey']['step'],1)
        self.assertEqual(self.post('coach/setup',{'step':1,'days':[8]}).status_code,400)
        self.assertEqual(self.state()['journey']['step'],1)
    def test_future_regeneration_preserves_past_and_leap_month(self):
        with patch('coach.journey.timezone.localdate',return_value=date(2028,2,1)):
            self.complete(days=[0,1,2,3,4,5,6])
        record=MonthlyRoadmap.objects.get(user=self.user)
        self.assertEqual(len(record.days),29)
        old=record.days['2028-02-01']
        with patch('coach.journey.timezone.localdate',return_value=date(2028,2,10)):
            response=self.post('coach/setup',{'step':1,'days':[],'experience':'regular','equipment':'gym','minutes':40,'hour':17})
            self.assertEqual(response.status_code,200)
        record.refresh_from_db()
        self.assertEqual(record.days['2028-02-01'],old)
        self.assertEqual(record.days['2028-02-11']['kind'],'recovery')
    def test_checkin_first_and_late_night_review(self):
        self.complete(days=list(range(7)))
        data=self.state()
        atnight=datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).replace(hour=21)
        with patch('coach.journey.timezone.localtime',return_value=atnight):
            self.assertEqual(snapshot(self.user,data['coaching'])['today']['next']['action'],'coach-checkin')
        self.post('coach/checkin',{'energy':3,'stress':1,'soreness':1,'available_minutes':30})
        data=self.state()
        with patch('coach.journey.timezone.localtime',return_value=atnight):
            self.assertEqual(snapshot(self.user,data['coaching'])['today']['next']['action'],'coach-review')
    def test_new_month_materializes_and_low_energy_adapts(self):
        self.complete(days=list(range(7)))
        self.post('coach/checkin',{'energy':1,'stress':1,'soreness':1,'available_minutes':10})
        state=self.state()
        self.assertTrue(state['journey']['today']['adjusted'])
        first=date.today().replace(day=1)
        next_month=(first+timedelta(days=32)).replace(day=1)
        with patch('coach.journey.timezone.localdate',return_value=next_month):
            result=snapshot(self.user,state['coaching'])
        self.assertEqual(result['month'],next_month.strftime('%Y-%m'))
        self.assertEqual(MonthlyRoadmap.objects.filter(user=self.user).count(),2)
    def test_rest_day_respected_and_questions_use_journey(self):
        state=self.complete(days=[])
        self.assertEqual(state['coaching']['workout']['mode'],'rest')
        self.assertNotIn('movement',[x['key'] for x in state['coaching']['actions']])
        answer=self.post('coach/ask',{'question':'Hôm nay phải làm gì?'}).json()['coaching']['conversations'][-1]
        self.assertEqual(answer['topic'],'journey')
        self.assertIn('Check-in',answer['answer'])
