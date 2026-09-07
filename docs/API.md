# API VITA

Session cookie bắt buộc. POST/DELETE cần `X-CSRFToken` lấy từ cookie `csrftoken`. Payload JSON. Trả 200 kèm snapshot mới; lỗi input 400 `{ "error": "field: nội dung" }`. Chưa đăng nhập chuyển về `/login/`.

Client gửi `X-Operation-ID: <UUID>` cho mutation. Gửi lại UUID với cùng payload trả snapshot mà không ghi trùng; đổi payload nhưng giữ UUID bị từ chối. `X-Account-ID` kiểm tra tài khoản khi đồng bộ; sai tài khoản trả 403. Snapshot mutation có `operation: {id, resource, can_undo, undone}`. `logged_at` là ISO datetime có timezone; giữ ngày địa phương của bản ghi offline trong 7 ngày gần nhất.

| Endpoint mới | Method | Payload |
| --- | --- | --- |
| `/api/smart/preview/` | POST | `{text: "trưa ăn phở bò, uống 350ml nước"}` → events, unresolved, token; không ghi |
| `/api/smart/commit/` | POST | `{token: "..."}`; token gắn user, hết hạn 15 phút; lưu atomic |
| `/api/undo/` | POST | `{operation: "UUID"}`; hoàn tác trong 24h nếu bản ghi chưa bị sửa |

Snapshot bổ sung `user_id`, `habits`, `workout_memory`, `report`, `recent_operations`.

| Endpoint | Method | Payload |
| --- | --- | --- |
| `/api/dashboard/today/` | GET | Snapshot profile, today, week, catalog, meals, water, weights, sessions, insights |
| `/api/meals/` | POST | `{kind: "breakfast", items: [{food: 1, quantity: 1}], id?: 2, template?: "Tên combo"}` |
| `/api/meals/` | DELETE | `{id: 2}` |
| `/api/foods/` | POST | `{name, serving, calories, protein, carbs, fat, fiber, sugar, sodium}`; riêng tài khoản |
| `/api/favorites/` | POST | `{food: 1}`; toggle |
| `/api/water/` | POST / DELETE | `{amount: 250}` / `{id: 1}` |
| `/api/weight/` | POST | `{weight: 74.6, body_fat?: 20, waist?: 82, muscle?: 32}` |
| `/api/measurements/` | POST | Ít nhất một trong body_fat, waist, muscle |
| `/api/sleep/` | POST | `{minutes: 480, quality: "good"}`; upsert hôm nay |
| `/api/steps/` | POST | `{steps: 8420}`; upsert hôm nay |
| `/api/workouts/start/` | POST | `{workout: 1}`; trả session đang mở nếu có |
| `/api/workouts/set/` | POST | `{session: 1, exercise: 1, weight: 40, reps: 10}` |
| `/api/workouts/finish/` | POST | `{session: 1}`; gọi lại không cộng calo hai lần |
| `/api/profile/` | POST | Các field hồ sơ/mục tiêu; score_weights tổng 100 |
| `/api/notifications/` | POST | `{water: "morning", meal: "off"}`; morning/afternoon/evening/off |
| `/api/photos/` | POST / DELETE | `{image: "data:image/jpeg;base64,..."}` / `{id: 1}` |
| `/photos/<id>/` | GET | Nội dung ảnh có kiểm tra quyền sở hữu |
| `/api/progress/weekly/` | GET | Snapshot có 7 summary ngày |
| `/api/coach/today/` | GET | Snapshot có tối đa 3 insights |
| `/api/export/` | GET | Tải dữ liệu JSON |

## Công thức

Calo còn lại = mục tiêu − ăn vào + vận động. Macro lấy snapshot MealItem, không đổi theo chỉnh sửa Food sau này. Điểm: trung bình có trọng số của nutrition/workout/water/sleep/steps, giới hạn 0–100. Nutrition gồm mức đạt protein và độ gần mục tiêu calo; workout đạt 100% ở 30 phút; sleep 8 giờ. Đây là quy tắc sản phẩm có thể thay bằng service khác.

## Dữ liệu

Các module có migration riêng. Django User là chủ sở hữu dữ liệu. Food dùng user null cho catalog chung; món tự tạo chỉ user sở hữu nhìn thấy. MealTemplate chứa tham chiếu món, MealItem lưu snapshot chất dinh dưỡng. DailySummary được upsert theo (user,date), không phát sinh trùng ngày. WeightLog giữ lịch sử nhiều lần đo; dashboard chọn lần cuối. Timezone server Asia/Ho_Chi_Minh.
