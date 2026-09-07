# VITA — Dashboard ăn uống & tập luyện

Hướng dẫn đưa mã nguồn từ GitHub lên server: [DEPLOY-SERVER.md](docs/DEPLOY-SERVER.md).

Ứng dụng Django với giao diện tiếng Việt, mobile-first, dữ liệu thật theo tài khoản và modal/bottom sheet. Không cần build frontend.

## Coach cá nhân — cập nhật 06/09/2026

Mới: **Thiết lập cùng coach** gồm 5 bước có lưu tiến độ; lịch tháng theo ngày rảnh, hướng dẫn hôm nay theo thời điểm truy cập và 7 bài học sử dụng ứng dụng. [Hướng dẫn bắt đầu và phạm vi kế hoạch](docs/GUIDED-JOURNEY.md).

Bản đang phục vụ trong Tailscale: **http://100.88.123.53:8765**. Mở **Coach của bạn → Mở coach** trên trang tổng quan.

- Check-in năng lượng, căng thẳng, đau mỏi và thời gian rảnh; kế hoạch ngày có tối đa 3 ưu tiên, giải thích và phản hồi để sau/chưa phù hợp.
- Gợi ý bữa theo mục tiêu, ngân sách calo và sở thích; lên lịch đến 7 ngày tới, đổi món, xác nhận đã ăn và hoàn tác.
- Phân tích nhịp tập, khối lượng hai buổi, trung bình cân nặng hai kỳ và độ đầy đủ của nhật ký; chọn một thói quen theo dõi mỗi tuần.
- Hỏi coach bằng tiếng Việt, xem lịch sử riêng tài khoản và tùy chỉnh câu trả lời ngắn/chi tiết. Đây là bộ quy tắc Python trên dữ liệu nhật ký, chưa kết nối mô hình AI ngoài.

Phân tích thiết kế: [docs/COACHING-V2.md](docs/COACHING-V2.md). 28 kiểm thử cũ + 11 kiểm thử coaching và 6 luồng Playwright đã đạt. Máy cần bật và có kết nối Tailscale; tác vụ VITA-Gymer chạy nền, tự khởi động lại tiến trình và chạy khi đăng nhập Windows.

## Chạy tại máy

Môi trường `.venv` đã được cài tại dự án bằng Python 3.14 và Django 5.2.17. Django 5.2 hỗ trợ Python 3.10–3.14: [tài liệu chính thức](https://docs.djangoproject.com/en/5.2/releases/5.2/).

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_catalog
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Mở http://127.0.0.1:8000. Tạo tài khoản mới để bắt đầu với nhật ký trống và thiết lập coaching 5 bước.

Tài khoản xem thử đã tạo tại máy: `demo` / `VitaDemo2026!`. Đây là dữ liệu minh họa, không phải nhật ký của người dùng thật. Không đưa tài khoản demo lên môi trường công khai.

Cài mới:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_catalog
# Tùy chọn dữ liệu minh họa, không ghi đè user đã tồn tại:
$env:VITA_DEMO_PASSWORD='your-local-demo-password'
.\.venv\Scripts\python.exe manage.py seed_demo
```

## Chức năng

- Tổng quan điểm thói quen, calo/macro, nước, cân nặng, workout, mục tiêu, coach, bước chân, giấc ngủ và tuần.
- Ghi nước một chạm; bữa ăn nhiều món/khẩu phần, sửa/xóa/lặp, yêu thích, combo, món tự tạo và lặp bữa sáng hôm qua.
- Buổi tập lưu theo set, bắt đầu/lặp/tiếp tục, nghỉ 90 giây, +30 giây, bỏ qua, kết thúc và lịch sử. Calo vận động là ước tính từ thời lượng.
- Hồ sơ, mục tiêu tùy chỉnh, trọng số điểm, sáng/tối, onboarding, số đo, ảnh riêng tư và xuất JSON.
- Session auth, CSRF, kiểm tra input, transaction, quyền riêng tư theo user, cache static PWA và trang offline.
- Rule-based coach có interface provider để mở rộng AI sau này.

## Nâng cấp thông minh (Django thuần)

Các tính năng dưới đây chạy bằng Python/Django và JavaScript thuần, không cần API AI hoặc Node server:

- **Ghi bằng một câu:** “Trưa ăn phở bò, uống 350ml nước”, “cân 74,6kg; ngủ 7h30; đi 8000 bước”, “đã tập cardio 30 phút”. Xem kết quả trước khi xác nhận. Món phải có trong thư viện; phần không hiểu sẽ được báo để sửa. Bộ phân tích theo quy tắc, không phải mô hình ngôn ngữ tổng quát.
- **Nhớ thói quen:** bữa ăn cùng khung giờ, lượng nước thường dùng trong 30 ngày, khẩu phần gần nhất, chương trình tập theo thứ và từng set của buổi đã hoàn thành gần nhất.
- **Bản nháp:** tự giữ bữa ăn chưa lưu, cân nặng, số đo, giấc ngủ và bước chân trên thiết bị, riêng theo tài khoản.
- **Hoàn tác:** nút sau khi ghi và mục “Lịch sử & hoàn tác”, trong 24 giờ cho các thao tác thêm nhật ký được hỗ trợ. Không xóa bản ghi đã được chỉnh sửa sau đó; thao tác sửa/xóa không nằm trong phạm vi hoàn tác.
- **Offline:** tab đã mở cho phép giữ bữa ăn mới, nước, cân nặng, ngủ, bước chân. Khi mở lạnh không có mạng, trang offline có form nước/cân/ngủ/bước. Đồng bộ tự động khi có mạng trong tab, hoặc nút “Đồng bộ ngay” khi mở lại. Giữ ngày ghi gốc tối đa 7 ngày, có UUID chống trùng và kiểm tra tài khoản. Tối đa 100 bản chờ; dữ liệu đang chờ nằm trên thiết bị, nên đồng bộ trước khi xóa dữ liệu trình duyệt.
- **Coach & báo cáo tuần:** một gợi ý ưu tiên trên Home, so sánh hai khoảng 7 ngày, số ngày có dữ liệu rõ ràng, trung bình chỉ trên ngày có ghi và một việc cho tuần tới.

Xem [phân tích nâng cấp](docs/UPGRADES.md). Nhận diện ảnh tự động và đồng bộ thiết bị chưa kết nối vì cần chọn nhà cung cấp/cấu hình. Không có dữ liệu được gửi ra dịch vụ AI.

## Tài liệu

- [7 phần thiết kế trước khi code](docs/ARCHITECTURE.md)
- [API và mô hình triển khai](docs/API.md)

## Kiểm thử

```powershell
.\.venv\Scripts\python.exe manage.py test
npm ci
npx playwright install chromium
# Khởi động server local trước, dùng tài khoản seed_demo:
npx playwright test
```

Playwright dùng tài khoản demo và sẽ thêm nhật ký kiểm thử vào tài khoản đó. Không chạy trên database production. Ảnh desktop/mobile/dark được ghi vào `test-results/`.

## Triển khai

Đặt `VITA_DEBUG=0`, `SECRET_KEY` ngẫu nhiên, `ALLOWED_HOSTS` và các biến `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`. Chạy migrate và collectstatic; dùng reverse proxy HTTPS phục vụ `/static/` từ `staticfiles/`, chuyển request động tới Waitress.

```powershell
.\.venv\Scripts\python.exe manage.py collectstatic --noinput
.\.venv\Scripts\waitress-serve.exe --listen=127.0.0.1:8000 config.wsgi:application
```

Chạy `manage.py summarize` bằng Task Scheduler/cron hàng ngày. Summary cũng được cập nhật khi mở dashboard. Cần cấu hình backup PostgreSQL và giới hạn đăng nhập tại reverse proxy trước khi mở công khai.

## Phạm vi vận hành

Đã xây bản ứng dụng chạy local với các luồng chính. Chưa triển khai máy chủ công khai hoặc kiểm thử trên PostgreSQL. Lịch nhắc hoạt động khi mở app, chưa có push nền. Hàng đợi offline hoạt động như mô tả trên; ghi bằng câu cần kết nối để phân tích/xác nhận và chưa có đồng bộ nền khi đóng trình duyệt. Ảnh tiến độ giới hạn 1 MB, lưu trong database; chưa nhận diện ảnh bữa ăn. Đơn vị hiện dùng hệ mét. Món mẫu có số dinh dưỡng tham khảo; không phải cơ sở dữ liệu dinh dưỡng đã xác minh. Điểm và coach phản ánh nhật ký/mục tiêu, không đánh giá y khoa. AI Coach chưa kết nối dịch vụ ngoài.
