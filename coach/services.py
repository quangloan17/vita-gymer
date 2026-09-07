from typing import Protocol
from django.utils import timezone

class CoachProvider(Protocol):
    def insights(self, summary, targets): ...

class RuleBasedCoach:
    def insights(self, s, p):
        messages = []
        hour = timezone.localtime().hour
        if s['calories'] > p.calories:
            messages.append({'tone': 'orange', 'title': 'Nhẹ nhàng với bản thân', 'text': 'Calo đã vượt mục tiêu bạn đặt. Hãy tiếp tục ghi chép để hiểu thói quen của mình.'})
        if hour >= 18 and s['protein'] < p.protein * .7:
            messages.append({'tone': 'orange', 'title': 'Đừng quên protein', 'text': f"Bạn còn {max(0, round(p.protein - s['protein']))}g so với mục tiêu protein hôm nay."})
        if hour >= 15 and s['water'] < p.water * .5:
            messages.append({'tone': 'blue', 'title': 'Đến giờ uống nước', 'text': 'Lượng nước đã ghi còn dưới một nửa mục tiêu. Thêm một ly nước khi thuận tiện nhé.'})
        if s.get('streak', 0) > 5:
            messages.append({'tone': 'orange', 'title': 'Dành chỗ cho phục hồi', 'text': 'Bạn đã tập hơn 5 ngày liên tiếp. Hãy cân nhắc một ngày nghỉ phù hợp.'})
        if not messages:
            messages.append({'tone': 'green', 'title': 'Từng chút một, mỗi ngày', 'text': 'Ghi lại bữa ăn, nước và vận động để theo dõi tiến độ của bạn.'})
        if s['water'] >= p.water:
            messages.append({'tone': 'blue', 'title': 'Đã đạt mục tiêu nước', 'text': 'Bạn đã hoàn thành lượng nước tự đặt cho hôm nay.'})
        priorities={'Dành chỗ cho phục hồi':0,'Đừng quên protein':1,'Đến giờ uống nước':2,'Nhẹ nhàng với bản thân':3}
        messages.sort(key=lambda item:priorities.get(item['title'],4))
        for item in messages:
            item['action']='water' if item['tone']=='blue' else 'sleep' if item['title']=='Dành chỗ cho phục hồi' else 'meal'
        return messages[:3]
