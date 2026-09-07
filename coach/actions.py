from datetime import date, timedelta
from django.db.models import Q
from django.utils import timezone
from nutrition.models import Food
from nutrition.services import number, save_meal
from dashboard.smart_logging import normalize
from .models import DailyCheckIn, CoachingPreference, CoachFeedback, PlannedMeal, WeeklyFocus, CoachConversation


def boolean(data,key):
    if not isinstance(data[key],bool): raise ValueError(f'{key}: lựa chọn phải là bật hoặc tắt.')
    return data[key]


def perform(user,resource,data):
    today=timezone.localdate()
    if resource=='coach/setup':
        from .journey import save_step
        save_step(user,data)
    elif resource=='coach/checkin':
        record,_=DailyCheckIn.objects.get_or_create(user=user,date=today)
        for k,lo,hi in [('energy',1,5),('stress',1,5),('soreness',1,5),('available_minutes',0,180)]:
            if k in data: setattr(record,k,int(number(data,k,lo,hi)))
        if all(k in data for k in ['energy','stress','soreness','available_minutes']): record.wellbeing_complete=True
        if 'nutrition_complete' in data: record.nutrition_complete=boolean(data,'nutrition_complete')
        if 'reflection' in data:
            if not isinstance(data['reflection'],str) or len(data['reflection'])>300: raise ValueError('reflection: tối đa 300 ký tự.')
            record.reflection=data['reflection'].strip()
        record.save()
    elif resource=='coach/preferences':
        pref,_=CoachingPreference.objects.get_or_create(user=user)
        if 'style' in data:
            if data['style'] not in ['brief','detailed']: raise ValueError('Phong cách không hợp lệ.')
            pref.style=data['style']
        for k,lo,hi in [('available_minutes',0,180),('meal_budget',100,1500)]:
            if k in data: setattr(pref,k,int(number(data,k,lo,hi)))
        if 'favorites_only' in data: pref.favorites_only=boolean(data,'favorites_only')
        if 'excluded_foods' in data:
            ids=data['excluded_foods']
            if not isinstance(ids,list) or len(ids)>200 or any(type(i)!=int for i in ids): raise ValueError('Danh sách món không hợp lệ.')
            valid=set(Food.objects.filter(Q(user=user)|Q(user__isnull=True),pk__in=ids).values_list('pk',flat=True))
            if len(valid)!=len(set(ids)): raise ValueError('Món không tồn tại hoặc không thuộc tài khoản của bạn.')
            pref.excluded_foods=list(valid)
        pref.save()
    elif resource=='coach/feedback':
        key,response=data.get('key'),data.get('response')
        if key not in ['checkin','recovery','water','nutrition','sleep','movement','review'] or response not in ['later','not_useful','reset']:
            raise ValueError('Phản hồi không hợp lệ.')
        if response=='reset': CoachFeedback.objects.filter(user=user,date=today,action_key=key).delete()
        else: CoachFeedback.objects.update_or_create(user=user,date=today,action_key=key,defaults={'response':response})
    elif resource=='coach/plan':
        try: day=date.fromisoformat(data.get('date',str(today)))
        except (ValueError,TypeError): raise ValueError('Ngày lên kế hoạch không hợp lệ.')
        if not today<=day<=today+timedelta(days=7): raise ValueError('Chỉ lên kế hoạch từ hôm nay đến 7 ngày tới.')
        if data.get('kind') not in ['breakfast','lunch','dinner','snack']: raise ValueError('Chọn loại bữa ăn.')
        items=data.get('items')
        if not isinstance(items,list) or not 1<=len(items)<=20: raise ValueError('Chọn từ 1 đến 20 món.')
        clean=[];names=[]
        for item in items:
            if not isinstance(item,dict): raise ValueError('Món không hợp lệ.')
            food=Food.objects.filter(Q(user=user)|Q(user__isnull=True)).get(pk=item['food'])
            quantity=number(item,'quantity',.1,20,1)
            clean.append({'food':food.pk,'quantity':quantity});names.append(food.name)
        if data.get('id'):
            plan=PlannedMeal.objects.select_for_update().get(user=user,pk=data['id'])
            if plan.meal_id: raise ValueError('Bữa đã ghi ăn; hãy sửa trong nhật ký dinh dưỡng.')
        else: plan=PlannedMeal(user=user)
        plan.date=day;plan.kind=data['kind'];plan.name=' + '.join(names)[:160];plan.items=clean;plan.save()
    elif resource=='coach/eat':
        plan=PlannedMeal.objects.select_for_update().get(user=user,pk=data['id'])
        if plan.meal_id: return
        if plan.date!=today: raise ValueError('Chỉ đánh dấu đã ăn cho kế hoạch hôm nay.')
        meal=save_meal(user,{'kind':plan.kind,'items':plan.items})
        plan.meal=meal;plan.save(update_fields=['meal'])
    elif resource=='coach/remove-plan':
        plan=PlannedMeal.objects.get(user=user,pk=data['id'])
        if plan.meal_id: raise ValueError('Bữa đã ăn đang nằm trong nhật ký; không xóa từ kế hoạch.')
        plan.delete()
    elif resource=='coach/focus':
        metric=data.get('metric')
        if metric not in ['water','meals','sleep','steps']: raise ValueError('Chọn một thói quen theo dõi.')
        WeeklyFocus.objects.update_or_create(user=user,week_start=today-timedelta(days=today.weekday()),defaults={'metric':metric,'target_days':int(number(data,'target_days',1,7))})
    elif resource=='coach/ask':
        text=data.get('question','')
        if not isinstance(text,str) or not 1<=len(text.strip())<=500: raise ValueError('Nhập câu hỏi từ 1 đến 500 ký tự.')
        from dashboard.services import snapshot
        current=snapshot(user)
        topic,answer=answer_question(text,current)
        CoachConversation.objects.create(user=user,question=text.strip(),topic=topic,answer=answer)
    else: raise ValueError('Chức năng coach không tồn tại.')


def answer_question(question,data):
    q=normalize(question);c=data['coaching'];s=data['today'];p=data['profile']
    if any(word in q for word in ['chan doan','benh','dau nguc','thuoc','chan thuong','chong mat']):
        return 'scope','Coach này phân tích nhật ký và thói quen, không chẩn đoán hoặc chỉ định thuốc. Với triệu chứng hay chấn thương, hãy trao đổi với chuyên gia y tế phù hợp. Tôi có thể giúp bạn tổng hợp nhật ký đã ghi để mang theo.'
    if any(word in q for word in ['lich thang','ngay mai','hom nay lam gi','phai lam gi','bat dau','su dung','thiet lap']):
        j=data['journey']
        if not j['started']: return 'journey',f"Hãy mở Thiết lập cùng coach ở đầu trang. Bạn đang ở bước {min(j['step']+1,5)}/5; ứng dụng lưu sau từng bước. Chúng ta xác nhận thông tin nền, lịch tập, mục tiêu và nhịp sinh hoạt trước khi tạo lịch tháng."
        if 'ngay mai' in q:
            tomorrow=str(timezone.localdate()+timedelta(days=1))
            planned=next((x for x in j['days'] if x['date']==tomorrow),None)
            if not planned:return 'journey','Ngày mai thuộc tháng mới; lịch tháng đó sẽ được tạo khi bạn mở ứng dụng trong tháng mới, theo lịch tuần đã xác nhận. Bạn có thể xem lại thiết lập lịch ngay bây giờ.'
            return 'journey',f"Ngày {tomorrow}: {planned['title']}. "+(f"Dự kiến {planned['minutes']} phút lúc {planned['hour']:02d}:00. " if planned['minutes'] else '')+'Mở Lịch tháng để xem ngày đó. Check-in khi đến ngày để điều chỉnh theo cảm nhận thực tế.'
        task=j['today']['next']
        return 'journey',(f"Bước tiếp theo hôm nay: {task['title']}. {task['text']} " if task else 'Bạn đã ghi các mục chính hôm nay. ')+'Mở Hướng dẫn hôm nay để làm từng bước, hoặc Lịch tháng để xem các ngày sắp tới. Thư viện hướng dẫn cho phép học lại các thao tác bất cứ lúc nào.'
    if any(word in q for word in ['an gi','bua','mon','protein','dinh duong']):
        options=c['nutrition']['options']
        intro=f"Hôm nay đã ghi {s['calories']:g} kcal và {s['protein']:g}g protein, so với mục tiêu {p['calories']} kcal / {p['protein']}g. "
        if s['calories']>p['calories']: intro+='Đã vượt mục tiêu calo bạn đặt; không cần nhịn ăn hoặc tập bù để xóa số liệu. '
        if options:
            intro+=f"Một phương án trong thư viện: {options[0]['name']} ({options[0]['calories']} kcal, {options[0]['protein']}g protein, ước tính). Mở Gợi ý bữa ăn để kiểm tra khẩu phần trước khi chọn."
        else: intro+='Chưa có món phù hợp với bộ lọc hiện tại. Bạn có thể đổi ngân sách hoặc sở thích trong Coach.'
        return 'nutrition',intro+' Kết luận phụ thuộc mức đầy đủ của nhật ký.'
    if any(word in q for word in ['tap','phuc hoi','van dong','met']):
        w=c['workout']
        return 'workout',w['title']+'. '+' '.join(w['reasons'])+' Đây là gợi ý từ dữ liệu tự báo; bạn quyết định theo cảm nhận thực tế. Không tự tăng tạ hoặc buộc tập bù.'
    if any(word in q for word in ['can nang','giam can','tang can','giam mo','tang mo','chung can']):
        t=c['trend']
        return 'weight',f"Có {t['current_days']} ngày cân ở kỳ hiện tại và {t['previous_days']} ở kỳ trước. "+t['message']+' Không tự điều chỉnh mục tiêu từ một lần cân.'
    if 'nuoc' in q:
        return 'water',f"Bạn đã ghi {s['water']} / {p['water']} ml hôm nay. Còn {max(0,p['water']-s['water'])} ml so với mục tiêu tự đặt. Ghi từng lần uống thực tế, không uống dồn để bù nhật ký."
    if 'ngu' in q:
        return 'sleep',(f"Hôm nay bạn đã ghi {s['sleep']//60} giờ {s['sleep']%60} phút ngủ. " if s['sleep'] else 'Chưa có nhật ký giấc ngủ hôm nay; không thể suy ra bạn đã ngủ ít. ')+f"Trong 7 ngày, có {data['report']['current']['sleep_days']} ngày ghi giấc ngủ. Bạn có thể theo dõi cả cảm nhận năng lượng trong check-in."
    if any(word in q for word in ['tuan','tien do','tong ket','thoi quen']):
        r=data['report']['current']
        return 'weekly',f"7 ngày gần đây có {r['meal_days']}/7 ngày ghi bữa ăn, {r['sleep_days']}/7 ngày ghi giấc ngủ và {r['sessions']} buổi tập được ghi. Có {c['nutrition_complete_days']} ngày bạn xác nhận nhật ký ăn đầy đủ. "+data['report']['next_step']
    return 'scope','Tôi chưa xác định rõ chủ đề. Bạn có thể hỏi: “Hôm nay ăn gì?”, “Nên tập gì?”, “Cân nặng tiến triển ra sao?”, “Uống nước thế nào?” hoặc “Tổng kết tuần này”. Câu trả lời được tạo theo quy tắc từ nhật ký, không phải AI hội thoại tổng quát.'
