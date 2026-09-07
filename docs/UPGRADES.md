# Nâng cấp VITA trên Django thuần

## Phân tích
Runtime là Django + ORM + session/CSRF + Django Template và JavaScript ES modules thuần. Không có React, Next, DRF, Node server hoặc yêu cầu build frontend. Hiện các card được tạo bằng JS từ JSON; logic nghiệp vụ vẫn thuộc Python. JavaScript cần thiết cho sheet, bộ đếm nghỉ và lưu tạm offline.

Điểm thiếu: mutation chưa có khóa chống trùng; sheet mất draft khi đóng; water preset mới ưu tiên gần nhất thay vì tần suất; workout dùng mức tạ catalog; thống kê coi ngày chưa ghi là 0; chưa có nhập tự nhiên và hoàn tác.

## Thiết kế thực hiện
1. Operation: unique(user, client_id), hash nội dung, thời điểm, các bản ghi đã tạo/cập nhật. API khóa hồ sơ trong transaction, tránh ghi lại cùng yêu cầu; undo có kiểm tra bản ghi chưa bị chỉnh sửa.
2. Parser tiếng Việt chạy Python: nước, cân nặng, ngủ, bước chân, món trong catalog, buổi tập đã hoàn thành. Preview không ghi; token ký theo tài khoản, hết hạn 15 phút. Nội dung không hiểu phải được sửa trước khi xác nhận.
3. Habits: tần suất 30 ngày, gợi ý bữa theo giờ và workout theo thứ; nhớ khẩu phần và từng set của buổi đã hoàn thành gần nhất.
4. Coach: một hành động ưu tiên trên Home, chi tiết vẫn mở sheet. Báo cáo so sánh hai khoảng 7 ngày, nêu số ngày có dữ liệu và một việc tiếp theo, không suy diễn ngày thiếu là 0.
5. Client draft và outbox riêng theo tài khoản. Ghi offline cho bữa, nước, cân nặng, ngủ, bước chân; đồng bộ thủ công/tự động khi có mạng với UUID không đổi, giữ ngày ghi ban đầu. Không cache trang riêng tư trên service worker; offline tại tab đã mở hoặc trang offline có form ghi nhanh.
6. Phần nhận diện ảnh và đồng bộ thiết bị cần nhà cung cấp/cấu hình riêng; không giả lập nhận diện ảnh hoặc tự gửi dữ liệu sức khỏe ra ngoài.

## Kiểm thử bắt buộc
Parser dấu/không dấu, số thập phân, món không hiểu, quyền sở hữu, preview không ghi, token sai user/hết hạn; commit atomic; idempotency và xung đột payload; undo không xóa bản ghi đã sửa; hàng đợi đổi tài khoản; hồi phục draft; so sánh tuần thiếu dữ liệu; giá trị set trước được điền đúng.
