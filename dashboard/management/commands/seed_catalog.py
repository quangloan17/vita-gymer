from django.core.management.base import BaseCommand
from nutrition.models import Food
from workouts.models import Exercise, Workout, WorkoutExercise

class Command(BaseCommand):
    help = 'Tạo thư viện món ăn và chương trình tập tham khảo, không tạo nhật ký cá nhân.'
    def handle(self, *args, **options):
        foods = [('Ức gà + cơm + rau', '1 phần · 350g', 520, 42, 62, 11, 6, 4, 450, '🥗'), ('Phở bò', '1 tô · 450g', 450, 25, 58, 13, 3, 5, 900, '🍜'), ('Trứng + bánh mì', '2 trứng · 1 lát bánh', 310, 19, 29, 13, 3, 3, 380, '🍳'), ('Ức gà áp chảo', '100g', 165, 31, 0, 3.6, 0, 0, 74, '🍗'), ('Chuối', '1 quả vừa', 105, 1.3, 27, .4, 3, 14, 1, '🍌'), ('Whey protein', '1 muỗng · 30g', 120, 24, 3, 1.5, 0, 1, 80, '🥛'), ('Yến mạch + sữa chua', '1 bát · 200g', 280, 16, 40, 7, 5, 9, 90, '🥣'), ('Cá hồi + rau xanh', '1 phần · 250g', 420, 38, 16, 22, 5, 3, 320, '🐟')]
        for name, serving, cal, pro, carb, fat, fiber, sugar, sodium, emoji in foods:
            Food.objects.get_or_create(name=name, user=None, defaults=dict(serving=serving, calories=cal, protein=pro, carbs=carb, fat=fat, fiber=fiber, sugar=sugar, sodium=sodium, emoji=emoji))
        plans = {'Push Day': [('Bench Press','Ngực',40), ('Shoulder Press','Vai',20), ('Triceps Extension','Tay sau',12)], 'Pull Day': [('Lat Pulldown','Lưng',35), ('Seated Row','Lưng',30), ('Bicep Curl','Tay trước',10)], 'Leg Day': [('Squat','Chân',40), ('Romanian Deadlift','Đùi sau',40), ('Calf Raise','Bắp chân',20)], 'Upper Body': [('Bench Press','Ngực',40), ('Seated Row','Lưng',30), ('Shoulder Press','Vai',20)], 'Cardio': [('Bodyweight March','Toàn thân',0), ('Step Up','Chân',0), ('Jumping Jack','Toàn thân',0)], 'Full Body': [('Squat','Chân',40), ('Bench Press','Ngực',40), ('Seated Row','Lưng',30)]}
        for name, exercises in plans.items():
            plan, _ = Workout.objects.get_or_create(name=name, defaults={'description': ' · '.join(dict.fromkeys(e[1] for e in exercises)), 'minutes': 45})
            for order, (title, muscle, weight) in enumerate(exercises):
                exercise, _ = Exercise.objects.get_or_create(name=title, defaults={'muscle': muscle})
                WorkoutExercise.objects.get_or_create(workout=plan, exercise=exercise, defaults={'order': order, 'weight': weight})
        self.stdout.write(self.style.SUCCESS('Đã tạo thư viện. Dinh dưỡng và mức tạ chỉ là tham khảo, hãy điều chỉnh khi ghi.'))
