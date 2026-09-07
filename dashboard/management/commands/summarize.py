from datetime import date
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone
from dashboard.services import summary

class Command(BaseCommand):
    help = 'Tạo/cập nhật DailySummary. Chạy hàng ngày bằng scheduler.'
    def add_arguments(self, parser): parser.add_argument('--date', type=date.fromisoformat)
    def handle(self,*args,**options):
        day=options.get('date') or timezone.localdate()
        for user in User.objects.iterator(): summary(user, day)
        self.stdout.write(f'Đã tổng hợp ngày {day}.')
