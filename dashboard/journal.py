"""Idempotent writes and conflict-aware undo, scoped to an authenticated user."""
import hashlib
import json
import uuid
from datetime import timedelta
from django.apps import apps
from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone
from .models import Operation

TRACKED = {
    'coach/eat': ['nutrition.Meal'],
    'water': ['nutrition.WaterLog'],
    'meals': ['nutrition.Meal', 'nutrition.MealTemplate'],
    'weight': ['measurements.WeightLog', 'measurements.BodyMeasurement'],
    'sleep': ['progress.SleepLog'],
    'steps': ['progress.StepLog'],
    'smart/commit': ['nutrition.Meal', 'nutrition.WaterLog', 'measurements.WeightLog', 'progress.SleepLog', 'progress.StepLog', 'workouts.WorkoutSession'],
}


def digest(value):
    return hashlib.sha256(json.dumps(value, cls=DjangoJSONEncoder, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def state(record):
    result = {f.attname: getattr(record, f.attname) for f in record._meta.concrete_fields}
    if record._meta.label == 'nutrition.Meal':
        result['_items'] = [{f.attname:getattr(item,f.attname) for f in item._meta.concrete_fields} for item in sorted(record.items.all(),key=lambda row:row.id)]
    return json.loads(json.dumps(result, cls=DjangoJSONEncoder))


def capture(user, resource, data):
    if resource == 'meals' and data.get('id'): return {}
    day=logged_date(data)
    return {label: {row.pk: state(row) for row in tracked_rows(user,label,day)} for label in TRACKED.get(resource, [])}


def tracked_rows(user,label,day):
    model=apps.get_model(label)
    rows=model.objects.filter(user=user)
    if any(f.name=='date' for f in model._meta.fields): rows=rows.filter(date=day)
    if label=='nutrition.Meal': rows=rows.prefetch_related('items')
    return rows


def begin(user, resource, data, client_id):
    try: key = uuid.UUID(client_id) if client_id else uuid.uuid4()
    except (ValueError, TypeError, AttributeError): raise ValueError('Mã thao tác không hợp lệ.')
    payload_hash = digest({'resource': resource, 'data': data})
    existing = Operation.objects.filter(user=user, client_id=key).first()
    if existing and existing.payload_hash != payload_hash:
        raise ValueError('Mã thao tác đã được dùng cho nội dung khác. Không ghi thêm dữ liệu.')
    return key, payload_hash, existing


def finish(user, resource, key, payload_hash, before, day):
    changes = []
    for label, old_rows in before.items():
        for row in tracked_rows(user,label,day):
            after = state(row)
            previous = old_rows.get(row.pk)
            if after != previous:
                changes.append({'model': label, 'id': row.pk, 'before': previous, 'after_hash': digest(after)})
    return Operation.objects.create(user=user, resource=resource, client_id=key, payload_hash=payload_hash, changes=changes)


def describe(operation):
    return {'id': str(operation.client_id), 'resource': operation.resource, 'can_undo': bool(operation.changes) and not operation.undone_at and operation.created_at >= timezone.now()-timedelta(hours=24), 'undone': bool(operation.undone_at)}


def undo(user, client_id):
    try: key = uuid.UUID(str(client_id))
    except (ValueError, TypeError): raise ValueError('Mã hoàn tác không hợp lệ.')
    op = Operation.objects.select_for_update().get(user=user, client_id=key)
    if op.undone_at: return op
    if not describe(op)['can_undo']: raise ValueError('Thao tác không hỗ trợ hoàn tác hoặc đã quá 24 giờ.')
    rows = []
    for change in op.changes:
        row = apps.get_model(change['model']).objects.select_for_update().filter(user=user, pk=change['id']).first()
        if not row or digest(state(row)) != change['after_hash']:
            raise ValueError('Bản ghi đã thay đổi. Hãy mở chi tiết để chỉnh sửa thay vì hoàn tác.')
        if change['model'] == 'workouts.WorkoutSession' and row.sets.exists():
            raise ValueError('Buổi tập đã có thêm set, không thể hoàn tác.')
        rows.append((row, change))
    for row, change in reversed(rows):
        if change['before'] is None: row.delete()
        else:
            for key, value in change['before'].items():
                if key not in ['id', 'user_id', '_items']: setattr(row, key, value)
            row.save()
    op.undone_at = timezone.now()
    op.save(update_fields=['undone_at'])
    return op


def logged_date(data):
    """Keep original local day when replaying an offline log (up to seven days)."""
    from datetime import datetime
    from zoneinfo import ZoneInfo
    if not data.get('logged_at'): return timezone.localdate()
    try:
        dt = datetime.fromisoformat(data['logged_at'].replace('Z', '+00:00'))
        if dt.tzinfo is None: raise ValueError()
    except (ValueError, TypeError, AttributeError): raise ValueError('Thời điểm ghi không hợp lệ.')
    now = timezone.now()
    if dt > now+timedelta(minutes=5) or dt < now-timedelta(days=7):
        raise ValueError('Chỉ đồng bộ bản ghi trong 7 ngày gần đây; thời điểm không được ở tương lai.')
    return dt.astimezone(ZoneInfo('Asia/Ho_Chi_Minh')).date()
