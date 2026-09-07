from collections import Counter
from datetime import timedelta
from django.db.models import Sum
from django.utils import timezone
from nutrition.models import Meal, WaterLog
from workouts.models import WorkoutSession
from progress.models import SleepLog, StepLog
from measurements.models import WeightLog


def habits(user):
    today=timezone.localdate()
    since=today-timedelta(days=30)
    meals=list(Meal.objects.filter(user=user,date__gte=since).prefetch_related('items__food').order_by('-created_at'))
    hour=timezone.localtime().hour
    kind='breakfast' if hour<10 else 'lunch' if hour<15 else 'dinner' if hour<21 else 'snack'
    candidates=[m for m in meals if m.kind==kind]
    signatures=Counter(tuple(sorted((i.food_id,i.quantity) for i in m.items.all())) for m in candidates)
    favorite=signatures.most_common(1)
    usual=[]
    if favorite:
        meal=next(m for m in candidates if tuple(sorted((i.food_id,i.quantity) for i in m.items.all()))==favorite[0][0])
        usual=[{'food':i.food_id,'quantity':i.quantity,'name':i.food.name} for i in meal.items.all()]
    portions={}
    for m in meals:
        for i in m.items.all(): portions.setdefault(str(i.food_id),i.quantity)
    water=[amount for amount,_ in Counter(WaterLog.objects.filter(user=user,date__gte=since).values_list('amount',flat=True)).most_common(4)]
    sessions=list(WorkoutSession.objects.filter(user=user,finished_at__isnull=False,date__gte=since).select_related('workout').order_by('-started_at'))
    same_day=[s for s in sessions if s.date.weekday()==today.weekday()]
    choice=Counter(s.workout_id for s in same_day).most_common(1)
    plan=next((s for s in same_day if choice and s.workout_id==choice[0][0]),sessions[0] if sessions else None)
    return {'kind':kind,'meal':usual,'meal_count':favorite[0][1] if favorite else 0,'portions':portions,'water_presets':list(dict.fromkeys(water+[250,350,500,750]))[:4],'workout':{'id':plan.workout_id,'name':plan.workout.name,'reason':'Theo các buổi cùng thứ trong 30 ngày' if same_day else 'Theo buổi đã hoàn thành gần nhất'} if plan else None}


def workout_memory(user):
    memory={}
    for session in WorkoutSession.objects.filter(user=user,finished_at__isnull=False).order_by('-finished_at').prefetch_related('sets')[:60]:
        group={}
        for s in sorted(session.sets.all(),key=lambda row:row.id):
            group.setdefault(str(s.exercise_id),[]).append({'weight':s.weight,'reps':s.reps})
        for key,sets in group.items(): memory.setdefault(key,{'date':str(session.date),'sets':sets})
    return memory


def weekly_report(user):
    today=timezone.localdate()
    def period(end):
        start=end-timedelta(days=6)
        meals=Meal.objects.filter(user=user,date__range=(start,end)).prefetch_related('items')
        logged=set(m.date for m in meals)
        cal=sum(i.nutrients.get('calories',0) for m in meals for i in m.items.all())
        protein=sum(i.nutrients.get('protein',0) for m in meals for i in m.items.all())
        workouts=WorkoutSession.objects.filter(user=user,date__range=(start,end),finished_at__isnull=False)
        sleeps=list(SleepLog.objects.filter(user=user,date__range=(start,end)).values_list('minutes',flat=True))
        steps=list(StepLog.objects.filter(user=user,date__range=(start,end)).values_list('steps',flat=True))
        weights=list(WeightLog.objects.filter(user=user,date__range=(start,end)).order_by('date','created_at'))
        return {'from':str(start),'to':str(end),'meal_days':len(logged),'calories':round(cal/len(logged)) if logged else None,'protein':round(protein/len(logged)) if logged else None,'sessions':workouts.count(),'sleep_days':len(sleeps),'sleep':round(sum(sleeps)/len(sleeps)) if sleeps else None,'step_days':len(steps),'steps':round(sum(steps)/len(steps)) if steps else None,'weight_change':round(float(weights[-1].weight-weights[0].weight),1) if len({w.date for w in weights})>=2 else None}
    current,previous=period(today),period(today-timedelta(days=7))
    if current['meal_days']<4: next_step='Tuần tới, thử ghi đầy đủ bữa ăn trong 4 ngày để có dữ liệu so sánh rõ hơn.'
    elif current['sleep_days']<4: next_step='Bạn đã ghi bữa ăn khá đều. Tuần tới hãy thêm nhật ký giấc ngủ trong 4 ngày.'
    else: next_step='Duy trì lịch ghi hiện tại và chọn một mục tiêu nhỏ mà bạn thấy phù hợp cho tuần tới.'
    changes={key:round(current[key]-previous[key],1) if current[key] is not None and previous[key] is not None else None for key in ['calories','protein','sleep','steps']}
    return {'current':current,'previous':previous,'changes':changes,'next_step':next_step,'note':'Trung bình chỉ trên ngày có bản ghi; một ngày có ghi chưa chắc đã ghi đầy đủ. Chưa ghi buổi tập không đồng nghĩa không vận động.'}
