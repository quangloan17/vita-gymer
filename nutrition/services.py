from django.db import transaction
from django.db.models import Q
from .models import Food, Meal, MealItem, MealTemplate
import math

NUTRIENTS = ('calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium')

def number(data, key, low, high, default=None):
    if not isinstance(data, dict): raise ValueError('Dữ liệu không hợp lệ.')
    try:
        value = float(data.get(key, default))
    except (TypeError, ValueError):
        raise ValueError(f'{key}: vui lòng nhập một số hợp lệ.')
    if not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f'{key}: giá trị phải từ {low} đến {high}.')
    return value

@transaction.atomic
def save_meal(user, data):
    kind = data.get('kind', 'lunch')
    if kind not in ['breakfast', 'lunch', 'dinner', 'snack']:
        raise ValueError('Loại bữa ăn không hợp lệ.')
    items = data.get('items', [])
    if not isinstance(items, list) or not 1 <= len(items) <= 50:
        raise ValueError('Hãy chọn ít nhất một món (tối đa 50).')
    if data.get('id'):
        meal = Meal.objects.get(pk=data['id'], user=user)
        meal.kind = kind
        meal.save()
        meal.items.all().delete()
    else:
        meal = Meal.objects.create(user=user, kind=kind, **({'date':data['date']} if 'date' in data else {}))
    clean = []
    for item in items:
        if not isinstance(item, dict): raise ValueError('Món ăn không hợp lệ.')
        food = Food.objects.filter(Q(user=user) | Q(user__isnull=True)).get(pk=item['food'])
        quantity = number(item, 'quantity', 0.1, 20, 1)
        MealItem.objects.create(meal=meal, food=food, quantity=quantity, nutrients={k: round(getattr(food, k) * quantity, 2) for k in NUTRIENTS})
        clean.append({'food': food.id, 'quantity': quantity})
    if data.get('template'):
        MealTemplate.objects.create(user=user, name=str(data['template'])[:120], items=clean)
    return meal
