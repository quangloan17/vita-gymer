# Coaching theo ngày và thiết lập từng bước

Bản cập nhật 06/09/2026, Django thuần; mở tại http://100.88.123.53:8765 trong Tailscale.

## Bắt đầu sử dụng

1. Đăng nhập. Người mới thấy hướng dẫn tự mở; tài khoản đã dùng chọn **Thiết lập cùng coach** ở đầu tổng quan.
2. Xác nhận tên, tuổi, giới tính nếu muốn chia sẻ, mức vận động, chiều cao, cân xuất phát, mục tiêu. Số đang lưu có thể là mặc định; không xem là số đã đo.
3. Chọn kinh nghiệm, điều kiện tập, ngày/giờ thuận tiện, thời lượng và ghi chú. Có thể chưa chọn ngày tập.
4. Đọc và xác nhận mục tiêu calo, protein, carb, chất béo, nước và bước chân. Đây là mục tiêu người dùng giữ/chỉnh, không phải đơn dinh dưỡng mới được tự tính.
5. Chọn giờ sinh hoạt và ngày tổng kết, xem lại, xác nhận tạo lịch. Mỗi bước được lưu; đóng hoặc tải lại vẫn tiếp tục từ bước còn thiếu.

## Hướng dẫn sau thiết lập

- **Hướng dẫn hôm nay:** check-in, ngủ, ghi bữa, buổi tập nếu có lịch, rà soát cuối ngày và tổng kết tuần. Có bản ghi không đồng nghĩa đã ghi đủ; chỉ rà soát ăn đủ khi người dùng xác nhận.
- **Lịch tháng:** chọn ngày để xem lịch. Lịch bắt đầu từ ngày xác nhận, không sinh việc quá hạn cho đầu tháng. Ngày có buổi tập thực tế được đánh dấu riêng; lịch không tạo calo hay buổi tập đã hoàn thành.
- **7 bài sử dụng:** ghi nhanh → khẩu phần/calo → macro → ngủ → ghi hiệp tập → cân nặng → tổng kết. Thư viện mở lại được bất cứ lúc nào.
- **Hiểu các thông số:** giải thích đơn vị, điểm hôm nay, số đã nhập và dữ liệu ước tính, sự khác nhau giữa calo tổng quan và ngân sách bữa của coach.
- **Mỗi lần quay lại:** cập nhật từ nhật ký mới; ưu tiên check-in chưa làm, buổi theo giờ đã chọn hoặc rà soát gần giờ ngủ. Không thay nội dung form đang nhập. Thời gian theo Asia/Ho_Chi_Minh.

## Lịch và giới hạn

Ngày tập do người dùng chọn. Người mới có thời lượng tuần đầu được giới hạn 20 phút trong kế hoạch; ngày tập liên tiếp được xen nhịp nhẹ, không tự tăng tạ. Đây là quy tắc sản phẩm để khởi đầu vừa sức, không phải phác đồ đã thẩm định. Gợi ý tôn trọng ngày nghỉ và check-in. Chưa tự chọn bài dựa trên phân tích bệnh lý hoặc ghi chú tự do; điều kiện tập hiển thị để người dùng chọn chương trình phù hợp.

Nguyên tắc chọn hoạt động phù hợp khả năng và theo dõi nhật ký tham khảo [CDC: Adding Physical Activity as an Adult](https://www.cdc.gov/physical-activity-basics/adding-adults/index.html). Lịch không tự tăng mục tiêu hoặc bảo đảm đạt cân nặng cuối tháng. Nhắc việc hiển thị trong ứng dụng, chưa phải thông báo đẩy khi đóng trình duyệt.

Lịch được lưu theo tháng. Sửa thiết lập cập nhật từ hôm nay, giữ nguyên các ngày đã qua; tháng mới được tạo khi truy cập tháng đó. Chưa duyệt nhiều tháng hoặc tự chuyển buổi bỏ lỡ. API `POST /api/coach/setup/` áp dụng transaction, kiểm tra thứ tự, quyền tài khoản và receipt chống ghi trùng. Hai model mới có trong xuất dữ liệu tài khoản.

## Kiểm thử và vận hành

45 kiểm thử backend đạt trước bổ sung ca ngày nghỉ/hỏi lịch; cả 7 ca journey cuối cùng đạt (tổng bộ hiện tại 46 ca). 7 luồng Playwright đạt trên môi trường phát triển; luồng coaching và thiết lập/lịch tháng cũng đã chạy thành công trực tiếp qua Tailscale bằng tài khoản kiểm thử riêng. Tài khoản quang giữ nguyên tiến độ bước 1 để người dùng tự cung cấp dữ liệu.

Supervisor khởi chạy worker trong tiến trình riêng, chờ thoát rồi khởi động lại sau 5 giây. Tác vụ VITA-Gymer có lịch đăng nhập và kiểm tra mỗi phút, IgnoreNew tránh chạy trùng; cơ chế này phục hồi nếu chính supervisor bị ngắt. Máy cần bật và người dùng Windows đã đăng nhập; tác vụ chạy trước đăng nhập bằng SYSTEM vẫn cần cài riêng như tài liệu triển khai.
