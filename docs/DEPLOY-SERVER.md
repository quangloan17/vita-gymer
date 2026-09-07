# Đưa VITA lên server Linux

Ứng dụng Django, không cần build frontend hoặc chạy Node trên server. Database và tài khoản trên máy cá nhân không nằm trong GitHub.

## Cài lần đầu

Clone kho GitHub bằng tài khoản có quyền truy cập (kho riêng tư), vào thư mục dự án rồi chạy với Python 3.10 trở lên:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Đặt biến môi trường qua trình quản lý dịch vụ của server. Thay tên miền và mật khẩu bằng giá trị thực:

```bash
export DJANGO_SETTINGS_MODULE=config.server
export SECRET_KEY='REPLACE_WITH_RANDOM_SECRET'
export ALLOWED_HOSTS='gym.example.com'
export CSRF_TRUSTED_ORIGINS='https://gym.example.com'
```

Tạo secret bằng `python -c 'import secrets; print(secrets.token_urlsafe(64))'`. Không commit secret. File `.env` không được ứng dụng tự động đọc.

Mặc định dùng SQLite tại `db.sqlite3`. Để dùng PostgreSQL, tạo database trước rồi đặt thêm `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`.

```bash
python manage.py migrate
python manage.py seed_catalog
python manage.py collectstatic --noinput
python manage.py createsuperuser
python manage.py check --deploy
waitress-serve --listen=127.0.0.1:8000 config.wsgi:application
```

Dùng systemd hoặc trình quản lý tiến trình để giữ Waitress chạy, với thư mục làm việc là thư mục dự án và các biến môi trường phía trên. Chỉ bind Waitress vào localhost.

## HTTPS / Nginx

Cấu hình chứng chỉ TLS cho tên miền; chuyển HTTP sang HTTPS. Trong server block HTTPS, proxy về Waitress như sau:

```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

WhiteNoise phục vụ static đã collect. `config.server` bắt buộc HTTPS và chỉ tin header do proxy ghi đè. Không đưa cổng 8000 ra Internet. Cấu hình giới hạn đăng nhập tại proxy và sao lưu database định kỳ. Không chạy `seed_demo` trên server công khai.

## Cập nhật

Sao lưu database trước khi cập nhật, rồi chạy trong môi trường đã cấu hình:

```bash
git pull --ff-only
. .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
```

Khởi động lại dịch vụ Waitress. Các script trong `deploy/` và `config.production` dành cho máy Windows/Tailscale cũ; server mới dùng `config.server`.

Nếu cần chuyển cả nhật ký hiện có, chuyển database bằng kênh riêng và khôi phục theo loại database đã chọn; clone GitHub chỉ chuyển mã nguồn.
