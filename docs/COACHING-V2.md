# VITA Coach v2 — phân tích và thiết kế

## Vấn đề trước nâng cấp
- Coach chỉ có vài ngưỡng calo/protein/nước; không biết năng lượng, căng thẳng, đau mỏi, thời gian rảnh.
- Gợi ý chưa có lý do, hành động tiếp theo và phản hồi; nhắc cùng việc nhiều lần.
- Chưa phân biệt bữa dự kiến và bữa đã ăn; chưa đề xuất phối hợp món theo mục tiêu còn lại.
- Cân nặng mới so hai điểm; dễ diễn giải quá mức dao động ngày. Thiếu trạng thái đủ/thiếu dữ liệu.
- Chưa có nơi hỏi nhanh “ăn gì / tập gì / tiến độ ra sao” dựa trên dữ liệu riêng của tài khoản.

## Nâng cấp triển khai
1. DailyCheckIn: năng lượng, stress, đau mỏi (1–5), thời gian có thể tập, cảm nhận cuối ngày, xác nhận nhật ký ăn đã đầy đủ. Rà soát cuối ngày tách biệt với check-in cảm nhận; một bản ghi/ngày, sửa được.
2. CoachingPreference: phong cách ngắn/chi tiết, số phút rảnh mặc định, ngân sách calo tự chọn cho bữa, món không muốn gợi ý, chỉ dùng món yêu thích nếu muốn.
3. Daily action plan: tối đa 3 việc ưu tiên và lý do; tự cập nhật theo nhật ký, hoãn/không phù hợp đến hết ngày. Không xem việc hoãn là hoàn thành.
4. Meal planner: xếp hạng món/cặp món theo mục tiêu đã đặt, số protein còn lại, ngân sách và sở thích. Hiển thị khẩu phần/macro, cho đổi lựa chọn. Lưu kế hoạch chưa cộng calo. “Đã ăn” mới ghi Meal qua transaction và UUID chống trùng.
5. Workout coach: dựa trên check-in và lịch sử, đưa phương án đầy đủ/ngắn/ưu tiên nghỉ; không tự tăng tạ, không bắt tập bù. Hiển thị thay đổi volume trong hai buổi có cùng bài, kèm số set để tránh so sánh lệch.
6. Trends & weekly focus: so trung bình cân nặng trên từng ngày (mỗi ngày chỉ lần cuối), tối thiểu 3 ngày/kỳ 7 ngày. Không kết luận tăng mỡ/chững cân từ vài lần đo. Cam kết tuần 1 mục do người dùng chọn, tiến độ tự tính từ dữ liệu thực.
7. Coach Q&A: câu hỏi nhanh và nhận diện chủ đề tiếng Việt chạy Python. Trả dữ liệu thực, giới hạn rõ khi không hiểu; không giả vờ là mô hình AI tổng quát. Lưu lịch sử riêng tài khoản.

## Kiến trúc & UX
Django thuần, service layer trong coach; ORM, session, CSRF, mutation journal hiện có. Coach mở bottom sheet/tab; Home chỉ hiển thị một việc tiếp theo, không thêm một loạt card. Không gửi dữ liệu ra dịch vụ ngoài. HTTP Tailscale 8765 tiếp tục hoạt động, không thêm dependency frontend.

## Nguyên tắc chuyên môn
Phân biệt số liệu quan sát, ước tính và gợi ý hành vi. Không tự đổi mục tiêu calo/tạ. Món bị loại chỉ theo lựa chọn người dùng; không phải bộ kiểm tra dị ứng. Cảm nhận vận động là tự báo, không phải đánh giá khả năng tập y khoa. Điểm thói quen không phải health score lâm sàng.

Nguồn tham khảo chung: [WHO về hoạt động thể chất](https://www.who.int/news-room/fact-sheets/detail/physical-activity), [CDC về giấc ngủ](https://www.cdc.gov/sleep/about/index.html). WHO ghi nhận giá trị của việc vận động dù ít; CDC mô tả nhu cầu ngủ thay đổi theo tuổi. Thuật toán xếp hạng, ngưỡng dữ liệu và kế hoạch trong app là quy tắc sản phẩm, không được trình bày như hướng dẫn lâm sàng đã kiểm định.

## Xác minh
Tài khoản riêng, input invalid, ngày mới, không có dữ liệu, feedback hết ngày, không gợi ý món bị loại, planned ≠ consumed, ghi planned hai lần chỉ có một Meal, undo trả planned về chưa ăn, nhật ký thiếu không suy diễn, mỗi ngày cân chỉ một lần đại diện, hỏi đáp không bịa số, HTTP browser và responsive 360–430px, sau đó migrate/collectstatic/restart Waitress đang phục vụ Tailscale.

Kết quả triển khai: 28 kiểm thử backend cũ và 11 kiểm thử coaching đạt; 6 luồng Playwright đạt, gồm luồng coaching ở 390px. Đăng nhập quang, đọc coaching và ghi/hoàn tác nước trên HTTP Tailscale 8765 đạt, không có lỗi JavaScript. Migration coach 0002 đã áp dụng. Dữ liệu coaching có trong xuất dữ liệu tài khoản.

## Phạm vi hiện tại và hướng tiếp theo

Gợi ý bữa chỉ phối tối đa hai món trong thư viện; chưa xây thực đơn đủ vi chất, chưa suy ra nguyên liệu hay kiểm tra dị ứng. Phân tích bài tập mô tả khối lượng đã ghi, chưa tự lập chu kỳ tăng tải. Phản hồi ẩn nhắc việc đến hết ngày; chưa là mô hình học máy. Hỏi đáp nhận diện chủ đề, không hiểu mọi cách diễn đạt.

Các bước sau có giá trị: mở rộng thư viện món và nguyên liệu đã kiểm chứng; lập lịch buổi tập theo thiết bị và bài thay thế; tích hợp thiết bị có quyền truy cập; tùy chọn mô hình hội thoại nếu người dùng muốn gửi dữ liệu sang nhà cung cấp. Không giả lập các tích hợp này trong bản hiện tại.
