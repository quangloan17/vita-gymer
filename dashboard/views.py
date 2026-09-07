import json
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from accounts.models import UserProfile, HealthGoal
from nutrition.models import Food, FavoriteFood, WaterLog, Meal, MealTemplate
from nutrition.services import save_meal, number
from measurements.models import WeightLog, BodyMeasurement
from progress.models import SleepLog, StepLog, ProgressPhoto
from notifications.models import NotificationPreference
from workouts import services as workout_service
from .services import snapshot
from . import journal, smart_logging

@login_required
@ensure_csrf_cookie
def home(request): return render(request, 'dashboard.html')

def signup(request):
    form = UserCreationForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        user = form.save()
        UserProfile.objects.create(user=user, name=user.username)
        login(request, user)
        return redirect('/')
    return render(request, 'registration/signup.html', {'form': form})

@login_required
@require_http_methods(['GET', 'POST', 'DELETE'])
def api(request, resource):
    user = request.user
    if request.headers.get('X-Account-ID') and request.headers['X-Account-ID'] != str(user.pk):
        return JsonResponse({'error':'Tài khoản đã thay đổi. Đăng nhập đúng tài khoản trước khi đồng bộ.'},status=403)
    if request.method == 'GET':
        if resource not in ['dashboard/today', 'progress/weekly', 'coach/today', 'export']:
            return JsonResponse({'error': 'Không tìm thấy endpoint.'}, status=404)
        if resource == 'export':
            from .export import export_data
            result = export_data(user)
        else:
            result = snapshot(user)
        response = JsonResponse(result)
        response['Cache-Control'] = 'no-store'
        if resource == 'export': response['Content-Disposition'] = 'attachment; filename="vita-data.json"'
        return response
    try:
        data = json.loads(request.body or '{}')
        if not isinstance(data, dict): raise ValueError('Dữ liệu không hợp lệ.')
        if resource == 'smart/preview' and request.method == 'POST':
            return JsonResponse(smart_logging.interpret(user,data.get('text')))
        with transaction.atomic():
            UserProfile.objects.get_or_create(user=user)
            UserProfile.objects.select_for_update().get(user=user)
            key, payload_hash, existing = journal.begin(user,resource+('DELETE' if request.method=='DELETE' else ''),data,request.headers.get('X-Operation-ID'))
            if existing:
                return JsonResponse({**snapshot(user),'operation':journal.describe(existing)})
            before = journal.capture(user,resource,data) if request.method == 'POST' else {}
            day = journal.logged_date(data)
            if request.method == 'DELETE':
                classes = {'meals': Meal, 'water': WaterLog, 'weight': WeightLog, 'templates': MealTemplate, 'photos': ProgressPhoto}
                if resource not in classes: return JsonResponse({'error': 'Không hỗ trợ xóa.'}, status=405)
                classes[resource].objects.get(pk=data['id'], user=user).delete()
            elif resource.startswith('coach/'):
                from coach.actions import perform
                perform(user,resource,data)
            elif resource == 'smart/commit': smart_logging.commit(user,data)
            elif resource == 'undo': journal.undo(user,data.get('operation'))
            elif resource == 'meals': save_meal(user, {**data,'date':day})
            elif resource == 'foods':
                name = str(data.get('name', '')).strip()
                if not name: raise ValueError('name: vui lòng nhập tên món.')
                from nutrition.services import NUTRIENTS
                Food.objects.create(user=user, name=name[:120], serving=str(data.get('serving', '1 phần'))[:60], **{k: number(data, k, 0, 50000 if k == 'sodium' else 10000, 0) for k in NUTRIENTS})
            elif resource == 'water': WaterLog.objects.create(user=user, date=day, amount=int(number(data, 'amount', 1, 3000)))
            elif resource == 'weight':
                WeightLog.objects.create(user=user, date=day, weight=number(data, 'weight', 20, 400))
                if any(data.get(k) not in (None, '') for k in ['body_fat', 'waist', 'muscle']): save_measurement(user, data, day)
            elif resource == 'measurements': save_measurement(user, data, day)
            elif resource == 'sleep':
                quality = data.get('quality', 'good')
                if quality not in ['good', 'fair', 'poor']: raise ValueError('Chất lượng không hợp lệ.')
                SleepLog.objects.update_or_create(user=user, date=day, defaults={'minutes': int(number(data, 'minutes', 0, 1440)), 'quality': quality})
            elif resource == 'steps': StepLog.objects.update_or_create(user=user, date=day, defaults={'steps': int(number(data, 'steps', 0, 150000))})
            elif resource == 'workouts/start': workout_service.start(user, data)
            elif resource == 'workouts/set': workout_service.complete_set(user, data)
            elif resource == 'workouts/finish': workout_service.finish(user, data)
            elif resource == 'favorites':
                food = Food.objects.filter(Q(user=user) | Q(user__isnull=True)).get(pk=data['food'])
                fav, created = FavoriteFood.objects.get_or_create(user=user, food=food)
                if not created: fav.delete()
            elif resource == 'profile':
                p, _ = UserProfile.objects.get_or_create(user=user)
                bounds = {'age': (13, 100), 'height': (100, 250), 'target_weight': (20, 400), 'start_weight': (20, 400), 'calories': (500, 10000), 'protein': (1, 500), 'carbs': (1, 1500), 'fat': (1, 500), 'water': (100, 10000), 'steps': (100, 100000), 'frequency': (1, 7)}
                for k, (lo, hi) in bounds.items():
                    if k in data: setattr(p, k, number(data, k, lo, hi))
                for k, allowed in {'theme': ['light', 'dark'], 'goal': ['lose', 'maintain', 'build'], 'activity': ['low', 'moderate', 'high'], 'gender': ['male', 'female', 'other']}.items():
                    if k in data:
                        if data[k] not in allowed: raise ValueError(f'{k}: lựa chọn không hợp lệ.')
                        setattr(p, k, data[k])
                if 'name' in data:
                    if not str(data['name']).strip(): raise ValueError('name: vui lòng nhập tên.')
                    p.name = str(data['name']).strip()[:80]
                if 'onboarded' in data: p.onboarded = bool(data['onboarded'])
                if 'score_weights' in data:
                    keys = ['nutrition', 'workout', 'water', 'sleep', 'steps']
                    supplied = data['score_weights'] or {'nutrition':30, 'workout':25, 'water':15, 'sleep':15, 'steps':15}
                    if not isinstance(supplied, dict): raise ValueError('Trọng số không hợp lệ.')
                    p.score_weights = {k: number(supplied, k, 0, 100) for k in keys}
                    if sum(p.score_weights.values()) != 100: raise ValueError('Tổng trọng số phải bằng 100.')
                p.save()
                if 'goal' in data: HealthGoal.objects.create(user=user, kind=p.goal, target=p.target_weight)
            elif resource == 'notifications':
                allowed = ['meal', 'water', 'workout', 'weight', 'sleep']
                prefs = {k: data[k] for k in allowed if data.get(k) in ['off', 'morning', 'afternoon', 'evening']}
                NotificationPreference.objects.update_or_create(user=user, defaults={'preferences': prefs})
            elif resource == 'photos':
                image = data.get('image', '')
                if not isinstance(image, str) or not image.startswith(('data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,')) or len(image) > 1500000: raise ValueError('Chọn ảnh JPG/PNG/WebP dưới 1 MB.')
                import base64
                try: raw = base64.b64decode(image.split(',', 1)[1], validate=True)
                except Exception: raise ValueError('Ảnh không hợp lệ.')
                if not raw.startswith((b'\xff\xd8\xff', b'\x89PNG\r\n\x1a\n', b'RIFF')): raise ValueError('Nội dung ảnh không hợp lệ.')
                ProgressPhoto.objects.create(user=user, image=image)
            else: return JsonResponse({'error': 'Không tìm thấy endpoint.'}, status=404)
            operation=journal.finish(user,resource,key,payload_hash,before,day)
        return JsonResponse({**snapshot(user),'operation':journal.describe(operation)})
    except (ValueError, TypeError, KeyError, ObjectDoesNotExist) as exc:
        return JsonResponse({'error': str(exc) if isinstance(exc, ValueError) else 'Dữ liệu không hợp lệ hoặc không còn tồn tại.'}, status=400)

def save_measurement(user, data, day=None):
    values = {k: number(data, k, lo, hi) for k, lo, hi in [('body_fat', 1, 70), ('waist', 20, 250), ('muscle', 1, 200)] if data.get(k) not in (None, '')}
    if not values: raise ValueError('Nhập ít nhất một số đo.')
    BodyMeasurement.objects.create(user=user,date=day or timezone.localdate(), **values)

@login_required
def photo(request, pk):
    import base64
    record = get_object_or_404(ProgressPhoto, pk=pk, user=request.user)
    header, encoded = record.image.split(',', 1)
    response = HttpResponse(base64.b64decode(encoded), content_type=header[5:].split(';')[0])
    response['Cache-Control'] = 'no-store'
    return response

def service_worker(request):
    from django.conf import settings
    return HttpResponse((settings.BASE_DIR / 'static' / 'sw.js').read_text(encoding='utf-8'), content_type='application/javascript')
