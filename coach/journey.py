"""Progressive intake and a persisted calendar; plans never imply completed activity."""
import calendar
from datetime import date, timedelta
from django.utils import timezone
from accounts.models import UserProfile
from nutrition.services import number
from nutrition.models import Meal, WaterLog
from progress.models import SleepLog
from workouts.models import WorkoutSession
from measurements.models import WeightLog
from .models import CoachingJourney, MonthlyRoadmap, DailyCheckIn, CoachingPreference

LESSONS = [
    ('Bắt đầu từ một bản ghi', 'Bấm Ghi nhanh (+), chọn nước và nhập lượng thực tế vừa uống. Các số trên tổng quan tự cập nhật.', 'water'),
    ('Hiểu calo và khẩu phần', 'Calo là năng lượng ước tính. Trong mục Ăn uống, kiểm tra đơn vị khẩu phần trước khi lưu; nửa phần nhập 0,5.', 'meal'),
    ('Hiểu protein, carb và chất béo', 'Ba chỉ số tính bằng gram. Đây là mục tiêu bạn xác nhận, không phải lượng ứng dụng biết bạn đã ăn nếu chưa ghi nhật ký.', 'journey-glossary'),
    ('Ghi giấc ngủ thực tế', 'Nhập tổng thời gian ngủ, không phải toàn bộ thời gian nằm trên giường. Ngày chưa ghi không bị hiểu là không ngủ.', 'sleep'),
    ('Học cách ghi buổi tập', 'Mở Tập luyện, chọn bài, ghi tạ và số lần từng hiệp. Chỉ kết thúc buổi khi bạn đã tập xong.', 'workout'),
    ('Đọc xu hướng cân nặng', 'Ghi cân trong điều kiện tương tự. Coach so trung bình nhiều ngày; một lần cân không đủ kết luận thay đổi mỡ.', 'weight'),
    ('Rà soát tuần đầu', 'Mở báo cáo tuần, xem số ngày có dữ liệu. Chọn một thói quen dễ duy trì, thay vì cố hoàn thành mọi chỉ số.', 'weekly'),
]
GLOSSARY = [
    ('Tuổi, chiều cao, cân nặng', 'Thông tin nền bạn tự khai. Cân nặng ban đầu trong hồ sơ không thay thế các lần cân thực tế trong nhật ký.'),
    ('Mục tiêu cân nặng', 'Mốc bạn muốn hướng tới, không phải dự báo hoặc cam kết đạt vào cuối tháng.'),
    ('Calo ăn / còn lại', 'Năng lượng từ các món đã ghi. Thẻ tổng quan cộng calo tập vào phần còn lại; gợi ý bữa của coach dùng mục tiêu ăn chưa cộng calo tập.'),
    ('Protein / carb / fat', 'Chất đạm / tinh bột, đường / chất béo, đo bằng gram. Quy đổi gần đúng lần lượt 4 / 4 / 9 kcal mỗi gram; số thực phẩm có thể lệch do làm tròn và thành phần khác.'),
    ('Nước và bước chân', 'Mục tiêu do bạn chọn. Chỉ số thể hiện những gì đã nhập, chưa tự đồng bộ từ đồng hồ.'),
    ('Tạ × số lần × số hiệp', 'Tổng khối lượng ghi nhận để so buổi tập; không tự chứng minh tăng sức mạnh nếu kỹ thuật, số hiệp hoặc bài khác nhau.'),
    ('Điểm hôm nay', 'Điểm theo mức đạt các mục tiêu trong ứng dụng, không phải kết quả khám hay đánh giá sức khỏe.'),
    ('Năng lượng / stress / đau mỏi', 'Thang cảm nhận 1–5 giúp điều chỉnh gợi ý hôm nay. Bạn có thể sửa check-in bất cứ lúc nào.'),
]

def save_step(user, data):
    journey,_=CoachingJourney.objects.get_or_create(user=user)
    step=int(number(data,'step',0,4))
    if step>journey.step: raise ValueError('Hãy hoàn thành bước trước để kế hoạch có đủ thông tin.')
    p=UserProfile.objects.get(user=user)
    answers=dict(journey.answers)
    if step==0:
        name=data.get('name','')
        if not isinstance(name,str) or not name.strip(): raise ValueError('Nhập tên bạn muốn coach gọi.')
        p.name=name.strip()[:80]
        for key,lo,hi in [('age',13,100),('height',100,250),('start_weight',20,400),('target_weight',20,400)]:
            setattr(p,key,number(data,key,lo,hi))
        if data.get('goal') not in ['lose','maintain','build']: raise ValueError('Chọn mục tiêu.')
        for key,allowed in [('gender',['male','female','other']),('activity',['low','moderate','high'])]:
            if key in data:
                if data[key] not in allowed: raise ValueError('Thông tin nền không hợp lệ.')
                setattr(p,key,data[key])
        p.goal=data['goal'];p.save()
        answers['basics_confirmed']=True
    elif step==1:
        days=data.get('days')
        if not isinstance(days,list) or len(days)>7 or any(type(x)!=int or x<0 or x>6 for x in days): raise ValueError('Chọn ngày tập trong tuần.')
        for key,allowed in [('experience',['new','returning','regular']),('equipment',['bodyweight','dumbbell','gym'])]:
            if data.get(key) not in allowed: raise ValueError('Chọn kinh nghiệm và điều kiện tập.')
            answers[key]=data[key]
        answers['days']=sorted(set(days))
        answers['minutes']=int(number(data,'minutes',5,120))
        answers['hour']=int(number(data,'hour',0,23))
        note=data.get('limitations','')
        if not isinstance(note,str) or len(note)>300: raise ValueError('Ghi chú tối đa 300 ký tự.')
        answers['limitations']=note.strip()
        CoachingPreference.objects.update_or_create(user=user,defaults={'available_minutes':answers['minutes']})
    elif step==2:
        for key,lo,hi in [('calories',500,10000),('protein',1,500),('carbs',1,1500),('fat',1,500),('water',100,10000),('steps',100,100000)]:
            setattr(p,key,int(number(data,key,lo,hi)))
        p.save()
        answers['targets_confirmed']=True
    elif step==3:
        for key in ['wake_hour','bed_hour']: answers[key]=int(number(data,key,0,23))
        answers['review_day']=int(number(data,'review_day',0,6))
    else:
        if data.get('confirmed') is not True: raise ValueError('Xác nhận thông tin trước khi tạo lịch.')
        if not journey.started: journey.started=timezone.localdate()
        p.onboarded=True;p.save(update_fields=['onboarded'])
    journey.answers=answers
    journey.step=max(journey.step,step+1)
    journey.save()
    if journey.started:
        # Changes take effect from today; past calendar entries retain their original plan.
        today=timezone.localdate()
        for record in MonthlyRoadmap.objects.filter(user=user,month__gte=today.replace(day=1)):
            fill_calendar(journey,record,refresh=True)

def fill_calendar(journey,record,refresh=False):
    a=journey.answers;today=timezone.localdate();days=dict(record.days)
    for n in range(1,calendar.monthrange(record.month.year,record.month.month)[1]+1):
        day=record.month.replace(day=n);key=str(day)
        if day<journey.started or (key in days and (not refresh or day<today)): continue
        elapsed=(day-journey.started).days
        week=elapsed//7+1
        training=day.weekday() in a.get('days',[])
        previous=(day-timedelta(days=1)).weekday() in a.get('days',[])
        # Avoid proposing consecutive full sessions, particularly when all weekdays are selected.
        light=training and previous and elapsed%2==1
        kind='light' if light else 'training' if training else 'recovery'
        minutes=min(a.get('minutes',30),20) if week==1 and a.get('experience')=='new' else a.get('minutes',30)
        if light: minutes=min(minutes,15)
        title={'training':'Buổi vận động theo lịch của bạn','light':'Buổi nhẹ giữa các ngày tập','recovery':'Ngày nghỉ / vận động nhẹ tùy sức'}[kind]
        days[key]={'date':key,'kind':kind,'title':title,'minutes':minutes if training else 0,'hour':a.get('hour',18),'week':week,'phase':'Làm quen và ghi dữ liệu' if week==1 else 'Giữ nhịp, xem lại khả năng duy trì' if week==2 else 'Duy trì và điều chỉnh theo phản hồi','review':day.weekday()==a.get('review_day',6),'lesson':elapsed if elapsed<len(LESSONS) else None,'equipment':a.get('equipment','bodyweight'),'caution':bool(a.get('limitations'))}
    if record.days!=days:
        record.days=days;record.save(update_fields=['days'])
    return days

def snapshot(user,coaching):
    j,_=CoachingJourney.objects.get_or_create(user=user)
    today=timezone.localdate();now=timezone.localtime()
    result={'step':j.step,'answers':j.answers,'started':str(j.started) if j.started else None,'glossary':GLOSSARY,'days':[],'today':None,'month':today.strftime('%Y-%m'),'lessons':[{'title':x[0],'text':x[1],'action':x[2]} for x in LESSONS]}
    if not j.started: return result
    record,_=MonthlyRoadmap.objects.get_or_create(user=user,month=today.replace(day=1))
    days=fill_calendar(j,record)
    start=record.month;end=start.replace(day=calendar.monthrange(start.year,start.month)[1])
    finished=set(WorkoutSession.objects.filter(user=user,date__range=(start,end),finished_at__isnull=False).values_list('date',flat=True))
    reviewed=set(DailyCheckIn.objects.filter(user=user,date__range=(start,end),nutrition_complete=True).values_list('date',flat=True))
    result['days']=[{**x,'workout_logged':date.fromisoformat(x['date']) in finished,'reviewed':date.fromisoformat(x['date']) in reviewed,'past':x['date']<str(today)} for x in sorted(days.values(),key=lambda x:x['date'])]
    current=dict(days[str(today)])
    if current['kind'] in ['recovery','light']:
        if coaching['workout']['mode'] not in ['rest','gentle']:
            coaching['workout']['title']=current['title']
        coaching['workout']['mode']='rest' if current['kind']=='recovery' else 'gentle'
        coaching['workout']['reasons'].insert(0,'Theo ngày tập/nghỉ bạn đã xác nhận trong lịch tháng.')
        coaching['actions']=[x for x in coaching['actions'] if x['key']!='movement']
        coaching['all_actions']=[x for x in coaching['all_actions'] if x['key']!='movement']
    check=coaching['checkin'];gentle=coaching['workout']['mode'] in ['rest','gentle']
    current['adjusted']=gentle and current['kind']=='training'
    if current['adjusted']: current['title']='Điều chỉnh hôm nay: ưu tiên nghỉ hoặc vận động nhẹ'
    current['tasks']=[{'title':'Check-in cảm nhận hôm nay','text':'Cho coach biết năng lượng, đau mỏi và thời gian thực sự có.','action':'coach-checkin','done':bool(check and check['wellbeing_complete'])}, {'title':'Ghi các bữa đã ăn','text':'Mở Ăn uống, chọn đúng món và khẩu phần. Bữa dự kiến chưa tính là đã ăn.','action':'meal','done':Meal.objects.filter(user=user,date=today).exists()}, {'title':'Ghi giấc ngủ vừa qua','text':'Nhập thời gian ngủ thực tế để gợi ý hôm nay có cơ sở.','action':'sleep','done':SleepLog.objects.filter(user=user,date=today).exists()}]
    if current['kind']!='recovery':current['tasks'].append({'title':current['title'],'text':f"Khoảng {current['minutes']} phút, lúc {current['hour']:02d}:00 theo lịch đã chọn. Điều chỉnh hoặc nghỉ nếu cảm nhận không phù hợp.",'action':'coach-workout' if current['adjusted'] or current['caution'] else 'workout','done':today in finished})
    current['tasks'].append({'title':'Rà soát cuối ngày','text':'Kiểm tra bữa còn thiếu và ghi một điều thuận lợi hoặc khó khăn.','action':'coach-review','done':bool(check and check['nutrition_complete'])})
    if current['review']:current['tasks'].append({'title':'Buổi tổng kết tuần','text':'Xem số ngày có dữ liệu, sau đó điều chỉnh lịch nếu khó duy trì.','action':'weekly','done':False})
    pending=[x for x in current['tasks'] if not x['done']]
    if pending and pending[0]['action']=='coach-checkin':
        next_task=pending[0]
    elif (j.answers.get('bed_hour',22)-now.hour)%24<=1 and pending:
        next_task=next((x for x in pending if x['action']=='coach-review'),pending[0])
    elif now.hour>=current['hour'] and not gentle:
        next_task=next((x for x in pending if x['action']=='workout'),pending[0] if pending else None)
    else: next_task=pending[0] if pending else None
    current['next']=next_task
    current['greeting']='Buổi sáng' if now.hour<12 else 'Buổi chiều' if now.hour<18 else 'Buổi tối'
    result['today']=current
    return result
