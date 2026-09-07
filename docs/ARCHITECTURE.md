# VITA — kiến trúc sản phẩm

## 1. Information Architecture
Home: điểm ngày → calo/macro → ghi nhanh → tập luyện/nước/cân nặng → coach → hoạt động/tuần (thu gọn).
Food: hôm nay, lịch sử, yêu thích, combo, tìm món. Workout: hôm nay, chương trình, lịch sử, bài tập. Progress: tổng quan, cân nặng, dinh dưỡng, tập luyện, số đo, ảnh. Profile: cá nhân, mục tiêu, nhắc nhở, giao diện, xuất dữ liệu.

## 2. Database Schema
Django User 1–1 UserProfile; User 1–N HealthGoal, Meal, WaterLog, WeightLog, BodyMeasurement, WorkoutSession, StepLog, SleepLog, DailySummary, DailyCoachInsight, NotificationPreference, ProgressPhoto.
Food 1–N MealItem; Meal 1–N MealItem (snapshot dinh dưỡng tại thời điểm lưu); User N–N Food qua FavoriteFood. MealTemplate chứa danh sách món/khẩu phần. Workout N–N Exercise qua WorkoutExercise; WorkoutSession 1–N ExerciseSet. Mọi truy vấn dữ liệu riêng tư đều giới hạn theo request.user. Summary unique(user,date); sleep/steps unique(user,date). Decimal cho số đo, thời gian timezone Asia/Ho_Chi_Minh.

## 3. Dashboard Wireframe
Desktop: sidebar 224px | header ngày/avatar | lời chào | score (1/3) + calo (2/3) | quick actions | workout + water + weight | coach + mục tiêu | hoạt động/tuần.
Mobile 360–430px: header → score → calo → quick actions 2×2 → cards 1 cột → phần thêm thu gọn. Bottom nav 5 mục và FAB trên nav, safe-area padding. Không có sidebar.

## 4. Component Tree
AppShell → Sidebar / MobileNav, Header, ViewRouter, ToastRegion, ModalHost.
Dashboard → ScoreCard, NutritionCard → MacroMeter, QuickActions, WorkoutCard, WaterCard, WeightSparkline, CoachCard, GoalCard, WeeklySummary.
ModalHost → MealSheet, WaterSheet, WeightSheet, WorkoutPicker, ActiveWorkout, SleepSheet, MeasurementSheet, ProfileSheet, ProgressDetail.
Shared: Card, Button, ChipGroup, ProgressBar, EmptyState, FieldError. Native dialog hỗ trợ focus trap, Escape, focus restore; footer sticky.

## 5. Modal Flow
Meal → loại bữa theo giờ → món gần đây/yêu thích/combo → khẩu phần → lưu (tùy chọn combo). Water preset → lưu ngay. Weight → stepper 0.1kg → lưu; nâng cao thu gọn. Workout → lặp lại/chọn chương trình → active session → hoàn thành set → nghỉ 90s (+30/skip) → kết thúc. Mọi lỗi giữ dữ liệu form và hiển thị tại sheet.

## 6. API Architecture
Session authentication + CSRF; JSON /api/dashboard/today/, /api/meals/, /api/water/, /api/weight/, /api/sleep/, /api/steps/, /api/measurements/, /api/profile/, /api/favorites/, /api/templates/, /api/workouts/start/, /api/workouts/set/, /api/workouts/finish/, /api/progress/weekly/, /api/coach/today/, /api/export/.
Views mỏng → services validation/transaction → ORM. Mọi mutation trả snapshot mới, không reload trang; lỗi 400 có message. Không cache API riêng tư. Summary được tính lại khi đọc/ghi, lệnh summarize cho scheduler hàng ngày. PostgreSQL trong production; SQLite local.

## 7. Mobile UX Flow
Mở app → hiểu trạng thái → +250ml (1 chạm); thêm món → chọn preset → lưu; lặp bữa sáng (1 chạm); lặp workout → bắt đầu (1 chạm). Sheet tối đa 90dvh, nút ≥48px, nội dung cuộn độc lập. Onboarding 4 bước, mục tiêu do người dùng xác nhận. PWA cache static và trang offline, không giả vờ lưu server khi offline.

## Triển khai và giới hạn
Python 3.10+ (máy hiện tại dùng 3.14) / Django 5.2 LTS, server-rendered shell + JavaScript modules + CSS responsive không cần build. Quy tắc coach là gợi ý hành vi dựa trên mục tiêu người dùng, không chẩn đoán. Provider interface cho AI sau này. Điểm là chỉ số hoàn thành thói quen, không phải đánh giá y khoa. Dữ liệu mẫu chỉ được tạo qua lệnh seed_demo riêng. Notifications là lịch nhắc trong app; push cần worker/provider triển khai riêng. Production cần HTTPS, SECRET_KEY, VITA_DEBUG=0, PostgreSQL, static server và backup.
