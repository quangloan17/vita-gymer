"""Deterministic Vietnamese quick logging. Never writes during interpretation."""
import re
import unicodedata
from datetime import timedelta
from django.core import signing
from django.db.models import Q
from django.utils import timezone
from nutrition.models import Food, WaterLog
from nutrition.services import save_meal, number
from measurements.models import WeightLog
from progress.models import SleepLog, StepLog
from workouts.models import Workout, WorkoutSession
from .journal import logged_date

SALT = 'vita.quick-log.v1'


def normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFD', text.lower().replace('đ', 'd')) if unicodedata.category(c) != 'Mn')


def interpret(user, text):
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= 1000:
        raise ValueError('Nhập câu ghi chú từ 1 đến 1.000 ký tự.')
    clean = normalize(text)
    hour = timezone.localtime().hour
    kind = 'breakfast' if hour < 10 else 'lunch' if hour < 15 else 'dinner' if hour < 21 else 'snack'
    foods = list(Food.objects.filter(Q(user=user) | Q(user__isnull=True)))
    programs = list(Workout.objects.all())
    events, unresolved = [], []
    pieces = re.split(r'(?<!\d),(?!\d)|;|\n|\s+(?:va|roi)\s+', clean)
    for piece in pieces:
        piece = piece.strip(' .')
        if not piece: continue
        for token, value in [('sang', 'breakfast'), ('trua', 'lunch'), ('toi', 'dinner'), ('an nhe', 'snack')]:
            if re.search(r'\b'+token+r'\b', piece): kind = value
        v = r'(\d+(?:[.,]\d+)?)'
        match = re.fullmatch(r'(?:da )?(?:uong|nuoc|uong nuoc)\s*'+v+r'\s*(ml|lit|l)(?: nuoc)?', piece)
        if match:
            amount = float(match[1].replace(',', '.')) * (1000 if match[2] != 'ml' else 1)
            number({'amount': amount}, 'amount', 1, 3000)
            events.append({'resource': 'water', 'data': {'amount': round(amount)}, 'label': f'Nước · {round(amount)} ml'})
            continue
        match = re.fullmatch(r'(?:can|can nang)\s*'+v+r'\s*(?:kg|ky|ki)?', piece)
        if match:
            weight = number({'weight':match[1].replace(',', '.')}, 'weight', 20, 400)
            events.append({'resource':'weight', 'data':{'weight':weight}, 'label':f'Cân nặng · {weight:g} kg'})
            continue
        match = re.fullmatch(r'(?:da )?ngu\s*'+v+r'\s*(?:h|gio)(?:\s*(\d+)\s*(?:p|phut)?)?', piece)
        if match:
            minutes = round(float(match[1].replace(',', '.'))*60+int(match[2] or 0))
            number({'minutes':minutes}, 'minutes', 1, 1440)
            events.append({'resource':'sleep','data':{'minutes':minutes,'quality':'good'},'label':f'Ngủ · {minutes//60} giờ {minutes%60} phút (tổng ngày)'})
            continue
        match = re.fullmatch(r'(?:di\s*)?(\d[\d .]*)\s*buoc(?: chan)?', piece)
        if match:
            steps = int(re.sub(r'[ .]', '', match[1]))
            number({'steps':steps}, 'steps', 0, 150000)
            events.append({'resource':'steps','data':{'steps':steps},'label':f'Bước chân · {steps:,} bước (tổng ngày)'})
            continue
        match = re.fullmatch(r'(?:da )?tap\s+(.+?)\s+'+v+r'\s*(?:phut|p)', piece)
        if match:
            plan = next((w for w in programs if normalize(w.name).removesuffix(' day') == match[1].removesuffix(' day')), None)
            if plan:
                minutes=number({'minutes':match[2].replace(',', '.')},'minutes',1,600)
                events.append({'resource':'workout','data':{'workout':plan.id,'minutes':minutes},'label':f'Đã tập {plan.name} · {minutes:g} phút; calo ước tính'})
                continue
        # Match a whole known dish, not a substring that silently drops unknown foods.
        food_text = re.sub(r'^(?:(?:bua )?(?:sang|trua|toi)|an nhe)\s*', '', piece)
        food_text = re.sub(r'^(?:da )?an\s+', '', food_text).strip()
        matches = []
        for food in foods:
            name = normalize(food.name)
            pattern = r'(?:(\d+(?:[.,]\d+)?)\s*(?:phan|to|bat|qua|suat)?\s*)?'+re.escape(name)+r'(?:\s*[x×]\s*(\d+(?:[.,]\d+)?))?'
            m = re.fullmatch(pattern, food_text)
            if m: matches.append((food, float((m[1] or m[2] or '1').replace(',', '.'))))
        if len(matches) == 1:
            food, qty = matches[0]
            number({'quantity':qty},'quantity',.1,20)
            events.append({'resource':'meals','data':{'kind':kind,'items':[{'food':food.pk,'quantity':qty}]},'label':f'{food.name} × {qty:g} · {round(food.calories*qty)} kcal (ước tính)'})
        else:
            unresolved.append(piece)
    # Keep multiple dishes in the same meal rather than emitting duplicate meal cards.
    grouped = []
    for event in events:
        previous=next((e for e in grouped if e['resource']=='meals' and event['resource']=='meals' and e['data']['kind']==event['data']['kind']),None)
        if previous:
            previous['data']['items'].extend(event['data']['items'])
            previous['label']+=' + '+event['label']
        else: grouped.append(event)
    return {'events':grouped,'unresolved':unresolved,'token':signing.dumps({'user':user.pk,'events':grouped},salt=SALT) if grouped and not unresolved else None}


def commit(user, data):
    try: payload = signing.loads(data.get('token',''),salt=SALT,max_age=900)
    except signing.BadSignature: raise ValueError('Bản xem trước đã hết hạn hoặc không hợp lệ. Hãy phân tích lại.')
    if payload['user'] != user.pk: raise ValueError('Bản xem trước không thuộc tài khoản này.')
    day = logged_date(data)
    for event in payload['events']:
        resource, values = event['resource'], event['data']
        if resource == 'meals': save_meal(user,{**values,'date':day})
        elif resource == 'water': WaterLog.objects.create(user=user,date=day,**values)
        elif resource == 'weight': WeightLog.objects.create(user=user,date=day,**values)
        elif resource == 'sleep': SleepLog.objects.update_or_create(user=user,date=day,defaults=values)
        elif resource == 'steps': StepLog.objects.update_or_create(user=user,date=day,defaults=values)
        elif resource == 'workout':
            plan=Workout.objects.get(pk=values['workout'])
            end=timezone.now()
            WorkoutSession.objects.create(user=user,workout=plan,date=day,started_at=end-timedelta(minutes=values['minutes']),finished_at=end,minutes=values['minutes'],calories=round(values['minutes']*plan.calories_per_minute))
