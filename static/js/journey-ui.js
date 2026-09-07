import { $, esc, button, modal, field, formData } from "./ui.js";
const p = (t) => `<p>${esc(t)}</p>`;
const b = (t, a, attrs = "") => button(t, a, "secondary", attrs);
const days = [
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
  "Chủ nhật",
];
const select = (name, label, options, value) =>
  `<label>${label}<select name="${name}">${options.map(([v, t]) => `<option value="${v}" ${String(v) === String(value) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
const goals = { lose: "Giảm cân", maintain: "Duy trì", build: "Tăng cơ" };
const equipment = {
  bodyweight: "Không dụng cụ",
  dumbbell: "Tạ đơn",
  gym: "Phòng gym",
};
let getData = () => null,
  activeStep = 0;
export function bindJourney(getter) {
  getData = getter;
}
export function journeyBanner(d) {
  const j = d.journey;
  if (!j.started)
    return `<section class="journey-banner"><span class="eyebrow">BẮT ĐẦU CÙNG COACH · ${Math.min(j.step, 4)}/5 BƯỚC</span><h2>Để tôi hiểu bạn, từng chút một.</h2>${p("Xác nhận thông số, chọn lịch phù hợp và nhận hướng dẫn từng ngày. Mỗi bước đều được lưu để tiếp tục sau.")}${button(j.step ? "Tiếp tục thiết lập" : "Thiết lập cùng coach", "journey-setup")}${b("Tôi muốn hiểu các thông số", "journey-glossary")}</section>`;
  const t = j.today,
    n = t.next;
  return `<section class="journey-banner"><span class="eyebrow">${esc(t.greeting)} · ${esc(t.date)} · TUẦN ${t.week}</span><h2>${esc(n?.title || "Bạn đã ghi các mục chính hôm nay")}</h2>${p(n?.text || "Bạn vẫn có thể cập nhật nhật ký khi cần. Không cần tập bù những ngày bỏ lỡ.")}${n ? button("Làm bước này", n.action) : ""}${b("Hướng dẫn hôm nay", "journey-today")}${b("Xem lịch tháng", "journey-calendar")}<small>${esc(t.phase)}</small></section>`;
}
export function setup(d, step = Math.min(d.journey.step, 4)) {
  activeStep = step;
  const a = d.journey.answers,
    pf = d.profile;
  const headers = [
    "Hiểu điểm xuất phát",
    "Lịch tập phù hợp cuộc sống",
    "Hiểu và xác nhận mục tiêu",
    "Nhịp sinh hoạt & ngày tổng kết",
    "Xem lại trước khi bắt đầu",
  ];
  let body = "";
  if (step === 0)
    body =
      p(
        "Đây là các số hiện lưu, có thể còn là mặc định. Hãy sửa theo bạn; bước này chưa tạo bản ghi cân mới.",
      ) +
      field(
        "name",
        "Bạn muốn coach gọi là gì?",
        pf.name,
        "text",
        'maxlength="80"',
      ) +
      field("age", "Tuổi", pf.age, "number", 'min="13" max="100"') +
      select(
        "gender",
        "Thông tin giới tính (có thể không chia sẻ)",
        [
          ["other", "Khác / không muốn chia sẻ"],
          ["male", "Nam"],
          ["female", "Nữ"],
        ],
        pf.gender,
      ) +
      select(
        "activity",
        "Mức vận động thường ngày",
        [
          ["low", "Phần lớn ngồi / ít vận động"],
          ["moderate", "Có đi lại và vận động vừa"],
          ["high", "Công việc hoặc sinh hoạt vận động nhiều"],
        ],
        pf.activity,
      ) +
      field(
        "height",
        "Chiều cao (cm)",
        pf.height,
        "number",
        'min="100" max="250" step="0.1"',
      ) +
      field(
        "start_weight",
        "Cân nặng xuất phát (kg)",
        pf.start_weight,
        "number",
        'min="20" max="400" step="0.1"',
      ) +
      select(
        "goal",
        "Điều bạn muốn hướng tới",
        Object.entries(goals),
        pf.goal,
      ) +
      field(
        "target_weight",
        "Mốc cân nặng bạn muốn hướng tới (kg)",
        pf.target_weight,
        "number",
        'min="20" max="400" step="0.1"',
      ) +
      p(
        "Mốc này không phải cam kết đạt trong tháng. Coach không tự giảm calo để ép đạt mốc.",
      );
  else if (step === 1)
    body =
      select(
        "experience",
        "Kinh nghiệm",
        [
          ["new", "Mới bắt đầu"],
          ["returning", "Quay lại sau thời gian nghỉ"],
          ["regular", "Đang tập đều"],
        ],
        a.experience || "new",
      ) +
      select(
        "equipment",
        "Điều kiện tập",
        Object.entries(equipment),
        a.equipment || "bodyweight",
      ) +
      p(
        "Chọn những ngày thực sự thuận tiện. Có thể bỏ chọn tất cả để ưu tiên xây thói quen ghi chép trước.",
      ) +
      `<div class="journey-weekdays">${days.map((name, i) => `<label><input type="checkbox" name="training-day" value="${i}" ${(a.days || [0, 2, 4]).includes(i) ? "checked" : ""}>${name}</label>`).join("")}</div>` +
      field(
        "minutes",
        "Phút có thể dành cho một buổi",
        a.minutes || 30,
        "number",
        'min="5" max="120"',
      ) +
      field(
        "hour",
        "Giờ muốn tập (0–23)",
        a.hour ?? 18,
        "number",
        'min="0" max="23"',
      ) +
      field(
        "limitations",
        "Điều cần lưu ý (không bắt buộc)",
        a.limitations || "",
        "text",
        'maxlength="300" placeholder="Ví dụ: chưa quen kỹ thuật, không muốn bài nhảy"',
      ) +
      p(
        "Ghi chú được lưu để bạn rà soát. Coach chưa tự diễn giải bệnh lý hay thiết kế bài phục hồi chấn thương.",
      );
  else if (step === 2)
    body =
      p(
        "Các mục tiêu dưới đây là số đang lưu để bạn kiểm tra, không phải đơn dinh dưỡng mới được tính cho bạn. Bạn có thể giữ tạm rồi điều chỉnh sau.",
      ) +
      field(
        "calories",
        "Năng lượng ăn mỗi ngày (kcal)",
        pf.calories,
        "number",
        'min="500" max="10000"',
      ) +
      field(
        "protein",
        "Protein / chất đạm (g)",
        pf.protein,
        "number",
        'min="1" max="500"',
      ) +
      field(
        "carbs",
        "Carb / tinh bột, đường (g)",
        pf.carbs,
        "number",
        'min="1" max="1500"',
      ) +
      field("fat", "Chất béo (g)", pf.fat, "number", 'min="1" max="500"') +
      field(
        "water",
        "Lượng nước theo dõi (ml/ngày)",
        pf.water,
        "number",
        'min="100" max="10000"',
      ) +
      field(
        "steps",
        "Bước chân muốn theo dõi mỗi ngày",
        pf.steps,
        "number",
        'min="100" max="100000"',
      ) +
      `<details><summary>Những con số này liên quan thế nào?</summary>${p("Protein và carb xấp xỉ 4 kcal/g, chất béo xấp xỉ 9 kcal/g. Không cần hiểu hết ngay: trong ngày đầu, chỉ học ghi đúng khẩu phần. Nút Giải thích thông số luôn có trong lịch coach.")}</details>`;
  else if (step === 3)
    body =
      field(
        "wake_hour",
        "Thường thức dậy lúc (0–23)",
        a.wake_hour ?? 7,
        "number",
        'min="0" max="23"',
      ) +
      field(
        "bed_hour",
        "Thường đi ngủ lúc (0–23)",
        a.bed_hour ?? 22,
        "number",
        'min="0" max="23"',
      ) +
      select(
        "review_day",
        "Ngày muốn tổng kết tuần",
        days.map((n, i) => [i, n]),
        a.review_day ?? 6,
      ) +
      p(
        "Khi mở ứng dụng, gợi ý ưu tiên thay đổi theo giờ Việt Nam và việc đã ghi. Đây là hướng dẫn trong ứng dụng, chưa phải thông báo đẩy khi bạn đóng trình duyệt.",
      );
  else
    body = `<div class="coach-card"><h3>${esc(pf.name)} · ${goals[pf.goal]}</h3>${p(`${pf.age} tuổi · ${pf.height} cm · xuất phát ${pf.start_weight} kg → mốc ${pf.target_weight} kg`)}${p(`Lịch tập: ${(a.days || []).map((i) => days[i]).join(", ") || "Chưa chọn ngày tập"} · ${a.minutes} phút · ${a.hour}:00 · ${equipment[a.equipment]}`)}${p(`${pf.calories} kcal · ${pf.protein}g đạm · ${pf.carbs}g carb · ${pf.fat}g béo · ${pf.water} ml nước · ${pf.steps} bước`)}${p(`Thức dậy ${a.wake_hour}:00 · Đi ngủ ${a.bed_hour}:00 · Tổng kết ${days[a.review_day]}`)}${a.limitations ? p("Lưu ý của bạn: " + a.limitations) : ""}</div>${p("7 ngày đầu học từng thao tác; các tuần sau giữ nhịp và tổng kết. Lịch bắt đầu hôm nay, không tạo việc quá hạn cho đầu tháng và không tự tăng tạ.")}${p("Bạn chưa cần hoàn hảo. Việc đầu tiên chỉ là check-in rồi ghi một bản ghi thực tế.")}`;
  modal(
    `${step + 1}/5 · ${headers[step]}`,
    `<div class="coach-content"><div class="journey-progress">${Array.from({ length: 5 }, (_, i) => `<i class="${i <= step ? "done" : ""}"></i>`).join("")}</div>${body}<small>Lưu sau từng bước · Có thể đóng và tiếp tục lần sau.</small></div>`,
    (step ? b("Quay lại", "journey-back") : "") +
      button(
        step === 4 ? "Xác nhận & tạo lịch" : "Lưu và tiếp tục",
        "journey-save",
      ),
  );
}
function today(d) {
  const j = d.journey;
  if (!j.started) return setup(d);
  const t = j.today,
    lesson = t.lesson !== null ? j.lessons[t.lesson] : null;
  modal(
    "Hướng dẫn hôm nay",
    `<div class="coach-content">${p(`${t.date} · Tuần ${t.week} · ${t.phase}`)}${t.tasks.map((x) => `<section class="coach-card"><h3>${x.done ? "✓ " : ""}${esc(x.title)}</h3>${p(x.text)}${x.done ? "<small>Đã có bản ghi · có thể vẫn cần bổ sung</small>" : button("Mở bước này", x.action)}</section>`).join("")}${lesson ? `<section class="coach-card"><span class="eyebrow">HỌC MỘT CHÚT · BÀI ${t.lesson + 1}/7</span><h3>${esc(lesson.title)}</h3>${p(lesson.text)}${button("Thử ngay", lesson.action)}</section>` : ""}</div>`,
    b("Lịch tháng", "journey-calendar") +
      b("Thư viện hướng dẫn", "journey-guide"),
  );
}
function calendar(d) {
  const j = d.journey;
  if (!j.started) return setup(d);
  const offset = (new Date(j.month + "-01T12:00:00").getDay() + 6) % 7;
  const count = new Date(
    Number(j.month.slice(0, 4)),
    Number(j.month.slice(5)),
    0,
  ).getDate();
  modal(
    "Lịch coach · " + j.month,
    `<div class="coach-content">${p("Chọn một ngày để xem hướng dẫn. Dấu ✓ chỉ có khi đã ghi buổi tập; ngày nghỉ không tự coi là đã hoàn thành bài tập.")}<div class="journey-calendar">${["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((n) => `<b>${n}</b>`).join("")}${"<span></span>".repeat(offset)}${Array.from(
      { length: count },
      (_, i) => {
        const key = j.month + "-" + String(i + 1).padStart(2, "0"),
          x = j.days.find((v) => v.date === key);
        return x
          ? `<button class="${x.kind} ${key === d.today.date ? "today" : ""}" data-action="journey-day" data-date="${key}" aria-label="${key} ${esc(x.title)}"><b>${i + 1}</b><small>${x.workout_logged ? "✓ Đã ghi" : x.kind === "training" ? "Tập" : x.kind === "light" ? "Nhẹ" : "Nghỉ"}</small>${x.review ? "<span>• Tổng kết</span>" : ""}</button>`
          : `<span class="journey-unplanned">${i + 1}</span>`;
      },
    ).join(
      "",
    )}</div>${p("Tập: theo ngày đã chọn · Nhẹ: giảm nhịp giữa các ngày liền nhau · Nghỉ: không bắt buộc tập. Tháng mới tự tạo lịch theo thiết lập hiện tại.")}</div>`,
    b("Sửa thiết lập", "journey-edit") +
      b("Hướng dẫn sử dụng", "journey-guide"),
  );
}
function day(d, key) {
  if (key === d.today.date) return today(d);
  const x = d.journey.days.find((v) => v.date === key);
  if (!x) return;
  const lesson = x.lesson !== null ? d.journey.lessons[x.lesson] : null;
  modal(
    "Kế hoạch · " + key,
    `<div class="coach-content"><h3>${esc(x.title)}</h3>${p(`Tuần ${x.week} · ${x.phase}`)}${p(x.kind === "recovery" ? "Ngày nghỉ theo lịch: ăn uống, nghỉ ngơi và ghi nhật ký như bình thường." : `${x.hour}:00 · khoảng ${x.minutes} phút · ${equipment[x.equipment]}. Check-in trước khi tập để điều chỉnh theo cảm nhận.`)}${p("Sau khi thức dậy: ghi giấc ngủ và check-in. Sau bữa ăn: ghi món và khẩu phần. Cuối ngày: rà soát bữa còn thiếu.")}${x.review ? p("Ngày tổng kết: xem báo cáo tuần và chọn điều chỉnh nhỏ cho tuần sau.") : ""}${lesson ? `<h3>Bài hướng dẫn: ${esc(lesson.title)}</h3>${p(lesson.text)}` : ""}${p(x.past ? (x.workout_logged ? "Có buổi tập được ghi ngày này." : "Chưa có buổi tập được ghi ngày này; không suy ra bạn đã không vận động.") : "Đây là kế hoạch dự kiến, chưa ghi hoạt động hoặc cộng calo.")}</div>`,
    b("Về lịch tháng", "journey-calendar"),
  );
}
export async function handleJourney(action, target, d, mutate) {
  if (!action.startsWith("journey-")) return false;
  if (action === "journey-setup") setup(d);
  else if (action === "journey-edit") setup(d, 0);
  else if (action === "journey-back") setup(d, Math.max(0, activeStep - 1));
  else if (action === "journey-save") {
    const inputs = [
      ...document.querySelectorAll("#sheet-body input:not([type=checkbox])"),
    ];
    if (inputs.some((e) => !e.reportValidity())) return true;
    const payload = { ...formData(), step: activeStep };
    if (activeStep === 1)
      payload.days = [
        ...document.querySelectorAll("[name=training-day]:checked"),
      ].map((e) => Number(e.value));
    if (activeStep === 4) payload.confirmed = true;
    if (await mutate("coach/setup", payload, "Đã lưu bước thiết lập")) {
      if (activeStep === 4) today(getData());
      else setup(getData(), activeStep + 1);
    }
  } else if (action === "journey-today") today(d);
  else if (action === "journey-calendar") calendar(d);
  else if (action === "journey-day") day(d, target.dataset.date);
  else if (action === "journey-glossary")
    modal(
      "Hiểu các thông số",
      `<div class="coach-content">${d.journey.glossary.map(([title, text]) => `<details class="coach-card"><summary>${esc(title)}</summary>${p(text)}</details>`).join("")}</div>`,
      b("Hướng dẫn sử dụng", "journey-guide"),
    );
  else if (action === "journey-guide")
    modal(
      "Học sử dụng từng chút một",
      `<div class="coach-content">${p("Bạn có thể học lại bất cứ bài nào, không cần chờ đúng ngày.")} ${d.journey.lessons.map((x, i) => `<section class="coach-card"><small>BÀI ${i + 1}/7</small><h3>${esc(x.title)}</h3>${p(x.text)}${button("Thực hành", x.action)}</section>`).join("")}</div>`,
      b("Giải thích thông số", "journey-glossary") +
        b("Thiết lập của tôi", "journey-edit"),
    );
  return true;
}
