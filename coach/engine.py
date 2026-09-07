"""Explainable coaching built from account-owned records, never invented observations."""
from collections import defaultdict
from datetime import timedelta
from itertools import combinations
from statistics import mean
from django.forms.models import model_to_dict
from django.utils import timezone
from measurements.models import WeightLog
from progress.models import SleepLog, StepLog
from nutrition.models import WaterLog, Meal
from .models import DailyCheckIn, CoachingPreference, CoachFeedback, PlannedMeal, WeeklyFocus, CoachConversation

SOURCE_LINKS=[{'title':'WHO · Vận động thể chất','url':'https://www.who.int/news-room/fact-sheets/detail/physical-activity'}, {'title':'CDC · Giấc ngủ','url':'https://www.cdc.gov/sleep/about/index.html'}]


def food_suggestions(data, preference):
    excluded=set(preference.excluded_foods)
    favorites=set(data['favorites'])
    available=[f for f in data['foods'] if f['id'] not in excluded and f['calories']>0 and (not preference.favorites_only or f['id'] in favorites)]
    remaining=max(0,data['profile']['calories']-data['today']['calories'])
    budget=min(preference.meal_budget,remaining) if remaining>=100 else preference.meal_budget
    need=max(0,data['profile']['protein']-data['today']['protein'])
    # Bound catalog work; retain high-protein options plus familiar favorites.
    available=sorted(available,key=lambda f:(f['id'] not in favorites,-f['protein']/f['calories']))[:24]
    candidates=[]
    for group in [(f,) for f in available]+list(combinations(available,2)):
        for portion in [.5,1,1.5]:
            cal=sum(f['calories']*portion for f in group)
            pro=sum(f['protein']*portion for f in group)
            if cal>budget*1.1 or cal<budget*.35: continue
            penalty=abs(cal-budget*.85)/max(budget,1)+max(0,min(need,40)-pro)/40
            penalty-=sum(f['id'] in favorites for f in group)*.1
            candidates.append({'rank':penalty,'name':' + '.join(f['name'] for f in group),'items':[{'food':f['id'],'quantity':portion} for f in group], 'calories':round(cal),'protein':round(pro,1),'carbs':round(sum(f['carbs']*portion for f in group),1),'fat':round(sum(f['fat']*portion for f in group),1),'reason':f'Ước tính {round(cal)} kcal so với ngân sách bữa {round(budget)} kcal; {round(pro,1)}g protein.','portions':[f"{f['name']}: {portion:g} × {f['serving']}" for f in group]})
    candidates.sort(key=lambda c:c['rank'])
    chosen=[];seen=set()
    for item in candidates:
        key=tuple(i['food'] for i in item['items'])
        if key not in seen:
            seen.add(key);item.pop('rank');item['key']=len(chosen);chosen.append(item)
        if len(chosen)==4: break
    return {'budget':round(budget),'remaining':round(remaining),'protein_remaining':round(need,1),'options':chosen,'note':'Dinh dưỡng là ước tính theo thư viện. Khẩu phần và ngân sách do bạn xác nhận; món không muốn gợi ý chỉ được lọc theo danh sách đã chọn.','over_target':data['today']['calories']>data['profile']['calories']}


def weight_trend(user):
    today=timezone.localdate()
    by_day={}
    for row in WeightLog.objects.filter(user=user,date__range=(today-timedelta(days=13),today)).order_by('date','created_at','id'):
        by_day[row.date]=float(row.weight)
    now=[w for d,w in by_day.items() if d>=today-timedelta(days=6)]
    previous=[w for d,w in by_day.items() if d<today-timedelta(days=6)]
    enough=len(now)>=3 and len(previous)>=3
    delta=round(mean(now)-mean(previous),2) if enough else None
    return {'current_days':len(now),'previous_days':len(previous),'current_average':round(mean(now),2) if now else None,'previous_average':round(mean(previous),2) if previous else None,'delta':delta,'confidence':'Đủ dữ liệu để so trung bình' if enough else 'Chưa đủ dữ liệu','message':('Hai trung bình đang gần nhau; chưa đủ để kết luận thay đổi mỡ hoặc chững tiến độ.' if abs(delta)<.2 else f"Trung bình 7 ngày thay đổi {delta:+.2f} kg so với kỳ trước. Đây là thay đổi cân nặng, không phải phép đo mỡ.") if enough else 'Cần ít nhất 3 ngày cân ở mỗi kỳ 7 ngày. Nhiều lần cân cùng ngày chỉ dùng lần cuối.','points':[{'date':str(d),'weight':w} for d,w in by_day.items()]}


def workout_analysis(data,checkin,preference):
    reasons=[]
    minutes=checkin.available_minutes if checkin else preference.available_minutes
    mode='regular'
    if checkin and (checkin.energy<=2 or checkin.soreness>=4 or checkin.stress>=4):
        mode='gentle';reasons.append('Check-in cho thấy năng lượng thấp, căng thẳng cao hoặc đau mỏi nhiều.')
    if data['today']['sleep'] and data['today']['sleep']<420 and data['profile']['age']>=18:
        mode='gentle';reasons.append(f"Bạn đã ghi {data['today']['sleep']//60}h{data['today']['sleep']%60:02d} ngủ đêm qua.")
    if data['today']['streak']>5:
        mode='gentle';reasons.append(f"Có buổi tập được ghi trong {data['today']['streak']} ngày liên tiếp.")
    if minutes==0: mode='rest';reasons.append('Bạn chọn không có thời gian tập hôm nay.')
    elif mode=='regular' and minutes<30: mode='short';reasons.append(f'Bạn có {minutes} phút; có thể chọn ít bài phù hợp thay vì cố hoàn thành toàn bộ.')
    if not reasons: reasons.append('Chưa có dấu hiệu cần đổi kế hoạch từ dữ liệu đã ghi; hãy điều chỉnh theo cảm nhận thực tế.')
    completed=[s for s in data['sessions'] if s['finished'] and s['date']<=data['today']['date']]
    history=defaultdict(list)
    for session in completed:
        grouped=defaultdict(list)
        for item in session['sets']: grouped[item['exercise_id']].append(item)
        for key,sets in grouped.items():
            history[key].append({'date':session['date'],'volume':round(sum(x['weight']*x['reps'] for x in sets),1),'sets':len(sets),'best_weight':max(x['weight'] for x in sets)})
    names={e['id']:e['name'] for p in data['programs'] for e in p['exercises']}
    comparisons=[]
    for key,rows in history.items():
        if len(rows)>=2:
            a,b=rows[:2]
            comparisons.append({'name':names.get(key,'Bài tập'),'current':a,'previous':b,'delta':round(a['volume']-b['volume'],1),'comparable_sets':a['sets']==b['sets']})
    return {'mode':mode,'title':{'regular':'Tập theo kế hoạch, theo sức của bạn','gentle':'Hôm nay ưu tiên nhịp nhẹ và phục hồi','short':'Một buổi ngắn vẫn có giá trị','rest':'Dành thời gian nghỉ hôm nay'}[mode],'minutes':minutes,'reasons':reasons,'comparisons':comparisons[:6],'program':data['habits']['workout'],'note':'Gợi ý từ nhật ký và cảm nhận tự báo, không đánh giá khả năng tập y khoa. Không tự tăng tạ; dừng bài gây đau và tìm hỗ trợ chuyên môn nếu cần.'}


def focus_progress(user):
    today=timezone.localdate();start=today-timedelta(days=today.weekday())
    focus=WeeklyFocus.objects.filter(user=user,week_start=start).first()
    if not focus: return None
    models={'water':WaterLog,'meals':Meal,'sleep':SleepLog,'steps':StepLog}
    dates=set(models[focus.metric].objects.filter(user=user,date__range=(start,today)).values_list('date',flat=True))
    return {'metric':focus.metric,'target':focus.target_days,'completed':len(dates),'week_start':str(start),'days':[{'date':str(start+timedelta(days=i)),'done':start+timedelta(days=i) in dates,'future':start+timedelta(days=i)>today} for i in range(7)]}


def build(user,data):
    today=timezone.localdate()
    pref,_=CoachingPreference.objects.get_or_create(user=user)
    checkin=DailyCheckIn.objects.filter(user=user,date=today).first()
    nutrition=food_suggestions(data,pref)
    workout=workout_analysis(data,checkin if checkin and checkin.wellbeing_complete else None,pref)
    actions=[]
    def action(key,title,reason,cta,label,priority):
        actions.append({'key':key,'title':title,'reason':reason,'action':cta,'label':label,'priority':priority})
    if not checkin or not checkin.wellbeing_complete: action('checkin','Bạn đang cảm thấy thế nào?','Check-in ngắn giúp coach biết năng lượng và thời gian rảnh hôm nay.','coach-checkin','Check-in 20 giây',0)
    if workout['mode'] in ['gentle','rest']: action('recovery',workout['title'],workout['reasons'][0],'coach-workout','Xem phương án phù hợp',1)
    if data['today']['water']<data['profile']['water']:
        action('water','Một ly nước khi thuận tiện',f"Đã ghi {data['today']['water']} / {data['profile']['water']} ml; không cần uống dồn để bù.",'water','Ghi nước',4)
    today_meals=[m for m in data['meals'] if m['date']==str(today)]
    if not today_meals: action('nutrition','Bữa tiếp theo của bạn','Chưa có bữa ăn được ghi hôm nay; lên kế hoạch hoặc ghi món đã ăn.','coach-food','Gợi ý bữa ăn',2)
    elif nutrition['protein_remaining']>0:
        action('nutrition','Chọn món cho phần ngày còn lại',f"Còn {nutrition['protein_remaining']:g}g protein so với mục tiêu bạn đặt. Số liệu phụ thuộc bữa đã ghi đầy đủ hay chưa.",'coach-food','Xem món phù hợp',3)
    if not data['today']['sleep']: action('sleep','Bổ sung nhật ký giấc ngủ','Chưa ghi không có nghĩa là ngủ ít; coach cần thời gian ngủ thực tế.','sleep','Ghi giấc ngủ',5)
    if not data['today']['sessions'] and workout['mode'] not in ['gentle','rest']:
        action('movement','Dành một khoảng thời gian để vận động',f"Bạn có {workout['minutes']} phút theo cài đặt; có thể chọn buổi phù hợp.",'coach-workout','Xem kế hoạch tập',6)
    if not checkin or not checkin.nutrition_complete:
        action('review','Khép lại ngày với một lần rà soát','Xác nhận bữa ăn đã ghi đầy đủ giúp báo cáo tránh diễn giải nhầm ngày thiếu dữ liệu.','coach-review','Rà soát cuối ngày',7)
    feedback={f.action_key:f.response for f in CoachFeedback.objects.filter(user=user,date=today)}
    actions.sort(key=lambda x:x['priority'])
    visible=[a for a in actions if feedback.get(a['key']) not in ['later','not_useful']]
    plans=[]
    foods={f['id']:f for f in data['foods']}
    for plan in PlannedMeal.objects.filter(user=user,date__range=(today,today+timedelta(days=7))).order_by('date','created_at'):
        plans.append({'id':plan.id,'date':str(plan.date),'kind':plan.kind,'name':plan.name,'items':plan.items,'consumed':bool(plan.meal_id),'can_log':plan.date==today and not plan.meal_id,'calories':round(sum(foods.get(i['food'],{}).get('calories',0)*i['quantity'] for i in plan.items))})
    return {'checkin':model_to_dict(checkin,exclude=['id','user']) if checkin else None,'preferences':model_to_dict(pref,exclude=['id','user']),'actions':visible[:3],'all_actions':actions,'hidden_count':len(actions)-len(visible),'nutrition':nutrition,'workout':workout,'trend':weight_trend(user),'focus':focus_progress(user),'plans':plans,'nutrition_complete_days':DailyCheckIn.objects.filter(user=user,date__range=(today-timedelta(days=6),today),nutrition_complete=True).count(),'conversations':list(CoachConversation.objects.filter(user=user).order_by('-created_at').values('question','answer','topic','created_at')[:12])[::-1],'sources':SOURCE_LINKS}
