import {
  $,
  esc,
  fmt,
  button,
  modal,
  field,
  formData,
  mealKinds,
  spark,
} from "./ui.js";
const b = (label, action, attrs = "") =>
  button(label, action, "secondary", attrs);
const card = (title, body) =>
  `<section class="coach-card"><h3>${esc(title)}</h3>${body}</section>`;
const p = (text) => `<p>${esc(text)}</p>`;
const select = (name, label, options, value) =>
  `<label>${label}<select name="${name}">${options.map(([v, t]) => `<option value="${v}" ${String(value) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
const metrics = [
  ["water", "Ghi nước"],
  ["meals", "Ghi bữa ăn"],
  ["sleep", "Ghi giấc ngủ"],
  ["steps", "Ghi bước chân"],
];
let chosen = null,
  editId = null;
export function coachBanner(data) {
  const a = data.coaching.actions[0];
  return `<section class="coach-banner"><div><span class="eyebrow">COACH CỦA BẠN</span><h3>${esc(a?.title || "Một ngày theo nhịp của bạn")}</h3>${p(a?.reason || "Xem kế hoạch và tiến bộ từ nhật ký.")}</div><div>${button("Mở coach", "coach")}${b("Check-in", "coach-checkin")}</div></section>`;
}
export function center(data, tab = "today") {
  const c = data.coaching;
  let body = "";
  if (tab === "today") {
    body =
      c.actions
        .map((a) =>
          card(
            a.title,
            `${c.preferences.style === "detailed" ? p(a.reason) : `<details><summary>Vì sao?</summary>${p(a.reason)}</details>`}${button(esc(a.label), a.action)}<div class="coach-feedback">${b("Để sau hôm nay", "coach-feedback", `data-key="${a.key}" data-response="later"`)}${b("Chưa phù hợp", "coach-feedback", `data-key="${a.key}" data-response="not_useful"`)}</div>`,
          ),
        )
        .join("") ||
      p(
        "Không còn nhắc việc ưu tiên hôm nay. Bạn vẫn có thể ghi nhật ký bất cứ lúc nào.",
      );
    body += `<div class="coach-toolbar">${b("Cập nhật check-in", "coach-checkin")}${b("Rà soát cuối ngày", "coach-review")}</div>`;
    if (c.hidden_count)
      body += card(
        `${c.hidden_count} nhắc việc đã ẩn hôm nay`,
        c.all_actions
          .map((a) =>
            b(
              `Hiện lại: ${esc(a.title)}`,
              "coach-feedback",
              `data-key="${a.key}" data-response="reset"`,
            ),
          )
          .join(""),
      );
    const f = c.focus;
    body += card(
      "Một thói quen cho tuần này",
      f
        ? `${p(`${metrics.find((x) => x[0] === f.metric)[1]}: ${f.completed}/${f.target} ngày`)}<div class="coach-days">${f.days.map((d, i) => `<span title="${d.date}" class="${d.done ? "done" : ""}">${d.done ? "✓" : ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][i]}</span>`).join("")}</div>${p("Đếm ngày có ghi nhật ký, không phải số ngày đạt mục tiêu sức khỏe.")}${b("Đổi trọng tâm", "coach-focus")}`
        : p("Chọn một việc nhỏ để giữ nhịp ghi chép.") +
            b("Chọn thói quen", "coach-focus"),
    );
  } else if (tab === "food") {
    body = p(
      `Còn ${fmt(c.nutrition.remaining)} kcal và ${fmt(c.nutrition.protein_remaining, 1)}g protein so với mục tiêu ăn uống đã đặt, chưa cộng calo tập.`,
    );
    if (c.nutrition.over_target)
      body += p(
        "Đã vượt mục tiêu bạn đặt. Không cần nhịn ăn hay tập bù; các món dưới đây vẫn là phương án để bạn cân nhắc.",
      );
    body +=
      c.nutrition.options
        .map((o, i) =>
          card(
            o.name,
            `${p(o.portions.join(" · "))}<b>${o.calories} kcal · ${o.protein}g protein</b>${p(o.reason)}${b("Chọn bữa này", "coach-select", `data-id="${i}"`)}`,
          ),
        )
        .join("") ||
      p("Chưa có món phù hợp. Hãy đổi bộ lọc trong tùy chỉnh coach.");
    body +=
      p(c.nutrition.note) +
      card(
        "Kế hoạch bữa ăn",
        c.plans.length
          ? c.plans
              .map(
                (x) =>
                  `<article class="coach-plan"><b>${esc(x.name)}</b>${p(`${x.date} · ${mealKinds[x.kind]} · ~${x.calories} kcal`)}${x.consumed ? "<span>✓ Đã ghi vào nhật ký</span>" : `${x.can_log ? button("Đã ăn", "coach-eat", "primary", `data-id="${x.id}"`) : "<span>Đã lên lịch</span>"}${b("Đổi món", "coach-swap", `data-id="${x.id}"`)}${b("Bỏ kế hoạch", "coach-remove-plan", `data-id="${x.id}"`)}`}</article>`,
              )
              .join("")
          : p(
              "Chưa có kế hoạch. Chọn món phía trên; chỉ tính vào nhật ký khi xác nhận đã ăn.",
            ),
      );
  } else if (tab === "workout") {
    const w = c.workout;
    body = card(
      w.title,
      p(`Thời gian đã chọn: ${w.minutes} phút`) +
        w.reasons.map(p).join("") +
        b("Đổi cảm nhận / thời gian", "coach-checkin") +
        (w.mode !== "rest" ? b("Chọn bài tập", "workout") : ""),
    );
    body +=
      card(
        "So hai buổi gần nhất theo từng bài",
        w.comparisons.length
          ? w.comparisons
              .map(
                (x) =>
                  `<div class="coach-plan"><b>${esc(x.name)}</b>${p(`${x.previous.date}: ${x.previous.volume} → ${x.current.date}: ${x.current.volume} kg × lần`)}${p(`${x.previous.sets} → ${x.current.sets} hiệp. ${x.comparable_sets ? "Cùng số hiệp; vẫn cần xem kỹ thuật và cảm nhận." : "Số hiệp khác nhau, không kết luận mạnh hơn từ tổng khối lượng."}`)}</div>`,
              )
              .join("")
          : p("Cần hai buổi có ghi hiệp cho cùng bài tập để so sánh."),
      ) + p(w.note);
  } else if (tab === "trend") {
    const t = c.trend;
    body = card(
      t.confidence,
      `<div class="coach-stats"><div><b>${t.previous_average ?? "—"}</b><span>kg · ${t.previous_days} ngày kỳ trước</span></div><div><b>${t.current_average ?? "—"}</b><span>kg · ${t.current_days} ngày kỳ này</span></div></div>${spark(
        t.points.map((x) => x.weight),
        true,
      )}${p(t.message)}${b("Ghi cân nặng", "weight")}`,
    );
    body += card(
      "Mức đầy đủ của nhật ký",
      p(`${c.nutrition_complete_days}/7 ngày bạn xác nhận đã ghi đủ bữa ăn.`) +
        p(data.report.next_step) +
        b("Xem báo cáo tuần", "weekly") +
        b("Rà soát hôm nay", "coach-review"),
    );
  } else if (tab === "chat") {
    body =
      p(
        "Coach theo quy tắc, trả lời từ nhật ký của riêng bạn. Không phải AI hội thoại tổng quát.",
      ) +
      `<div class="coach-toolbar">${["Hôm nay ăn gì?", "Nên tập gì?", "Cân nặng tiến triển ra sao?", "Tổng kết tuần này"].map((q) => b(esc(q), "coach-question", `data-question="${esc(q)}"`)).join("")}</div>`;
    body += `<div class="coach-chat">${c.conversations.map((x) => `<article><b>${esc(x.question)}</b>${p(x.answer)}</article>`).join("")}</div>${field("question", "Câu hỏi của bạn", "", "text", 'maxlength="500" placeholder="Ví dụ: Uống nước thế nào?"')}${button("Hỏi coach", "coach-ask")}`;
  }
  modal(
    "Coach cá nhân",
    `<div class="coach-tabs">${[
      ["today", "Hôm nay"],
      ["food", "Ăn gì?"],
      ["workout", "Tập luyện"],
      ["trend", "Xu hướng"],
      ["chat", "Hỏi coach"],
    ]
      .map(([k, n]) =>
        button(
          n,
          "coach-tab",
          k === tab ? "primary" : "secondary",
          `data-section="${k}"`,
        ),
      )
      .join("")}</div><div class="coach-content">${body}</div>`,
    b("Tùy chỉnh coach", "coach-settings") + b("Lịch & hướng dẫn", "journey-calendar"),
  );
}
export async function handleCoach(action, target, data, mutate) {
  if (action !== "coach" && !action.startsWith("coach-")) return false;
  const c = data.coaching;
  if (['coach','coach-tab','coach-food','coach-workout'].includes(action)) editId = null;
  const save = async (resource, body, tab = "today") => {
    if (await mutate(`coach/${resource}`, body, "Đã cập nhật coach"))
      center(currentData(), tab);
  };
  if (action === "coach") center(data);
  else if (action === "coach-tab") center(data, target.dataset.section);
  else if (action === "coach-food" || action === "coach-workout")
    center(data, action === "coach-food" ? "food" : "workout");
  else if (action === "coach-checkin") {
    const x = c.checkin || {};
    modal(
      "Check-in hôm nay",
      `<div class="coach-content">${select(
        "energy",
        "Năng lượng",
        [
          [1, "1 · Rất thấp"],
          [2, "2 · Thấp"],
          [3, "3 · Bình thường"],
          [4, "4 · Tốt"],
          [5, "5 · Rất tốt"],
        ],
        x.energy || 3,
      )}${select(
        "stress",
        "Căng thẳng",
        [
          [1, "1 · Rất nhẹ"],
          [2, "2 · Nhẹ"],
          [3, "3 · Vừa"],
          [4, "4 · Cao"],
          [5, "5 · Rất cao"],
        ],
        x.stress || 3,
      )}${select(
        "soreness",
        "Đau mỏi",
        [
          [1, "1 · Không đáng kể"],
          [2, "2 · Nhẹ"],
          [3, "3 · Vừa"],
          [4, "4 · Nhiều"],
          [5, "5 · Rất nhiều"],
        ],
        x.soreness || 1,
      )}${field("available_minutes", "Phút có thể dành cho vận động", x.available_minutes ?? c.preferences.available_minutes, "number", 'min="0" max="180"')}</div>`,
      button("Lưu check-in", "coach-save-checkin"),
    );
  } else if (action === "coach-save-checkin") await save("checkin", formData());
  else if (action === "coach-review")
    modal(
      "Rà soát cuối ngày",
      `<label><input id="coach-complete" type="checkbox" ${c.checkin?.nutrition_complete ? "checked" : ""}> Tôi đã ghi đủ các bữa ăn hôm nay</label>${field("reflection", "Một điều thuận lợi hoặc khó khăn hôm nay", c.checkin?.reflection || "", "text", 'maxlength="300"')}`,
      button("Lưu rà soát", "coach-save-review"),
    );
  else if (action === "coach-save-review")
    await save("checkin", {
      ...formData(),
      nutrition_complete: $("#coach-complete").checked,
    });
  else if (action === "coach-feedback")
    await save("feedback", {
      key: target.dataset.key,
      response: target.dataset.response,
    });
  else if (action === "coach-focus")
    modal(
      "Trọng tâm tuần này",
      select("metric", "Thói quen", metrics, c.focus?.metric || "water") +
        field(
          "target_days",
          "Số ngày muốn ghi nhật ký",
          c.focus?.target || 4,
          "number",
          'min="1" max="7"',
        ),
      button("Lưu trọng tâm", "coach-save-focus"),
    );
  else if (action === "coach-save-focus") await save("focus", formData());
  else if (action === "coach-settings") {
    const x = c.preferences;
    modal(
      "Tùy chỉnh coach",
      `<div class="coach-content">${select(
        "style",
        "Cách giải thích",
        [
          ["brief", "Ngắn gọn"],
          ["detailed", "Chi tiết"],
        ],
        x.style,
      )}${field("meal_budget", "Ngân sách một bữa (kcal)", x.meal_budget, "number", 'min="100" max="1500"')}${field("available_minutes", "Thời gian vận động mặc định (phút)", x.available_minutes, "number", 'min="0" max="180"')}<label><input id="coach-favorites" type="checkbox" ${x.favorites_only ? "checked" : ""}> Chỉ gợi ý món yêu thích</label><details><summary>Món không muốn được gợi ý</summary>${data.foods.map((f) => `<label class="coach-food-filter"><input type="checkbox" name="excluded" value="${f.id}" ${x.excluded_foods.includes(f.id) ? "checked" : ""}> ${esc(f.name)}</label>`).join("")}</details>${p("Bộ lọc theo tên món trong thư viện; không kiểm tra thành phần dị ứng.")}</div>`,
      button("Lưu tùy chỉnh", "coach-save-settings"),
    );
  } else if (action === "coach-save-settings")
    await save("preferences", {
      ...formData(),
      favorites_only: $("#coach-favorites").checked,
      excluded_foods: [
        ...document.querySelectorAll('[name="excluded"]:checked'),
      ].map((e) => Number(e.value)),
    });
  else if (action === "coach-swap") {
    editId = Number(target.dataset.id);
    center(data, "food");
    $("#sheet-error").textContent =
      "Chọn bữa thay thế phía trên để đổi kế hoạch.";
  } else if (action === "coach-select") {
    chosen = c.nutrition.options[Number(target.dataset.id)];
    const plan = c.plans.find((x) => x.id === editId);
    modal(
      "Xác nhận kế hoạch bữa ăn",
      p(chosen.name) +
        chosen.portions.map(p).join("") +
        select(
          "kind",
          "Bữa ăn",
          Object.entries(mealKinds),
          plan?.kind || "dinner",
        ) +
        field(
          "date",
          "Ngày dự định ăn",
          plan?.date || data.today.date,
          "date",
        ) +
        p("Chưa ghi vào calo hôm nay. Khi ăn xong, bấm “Đã ăn” ở kế hoạch."),
      button("Lưu kế hoạch", "coach-save-plan"),
    );
  } else if (action === "coach-save-plan") {
    await save(
      "plan",
      { ...formData(), items: chosen.items, ...(editId ? { id: editId } : {}) },
      "food",
    );
    editId = null;
  } else if (action === "coach-eat" || action === "coach-remove-plan")
    await save(
      action === "coach-eat" ? "eat" : "remove-plan",
      { id: Number(target.dataset.id) },
      "food",
    );
  else if (action === "coach-ask" || action === "coach-question")
    await save(
      "ask",
      { question: target.dataset.question || $('[name="question"]').value },
      "chat",
    );
  return true;
}
let currentData = () => null;
export function bindCoach(getData) {
  currentData = getData;
}
