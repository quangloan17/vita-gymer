import { esc, button, modal, fmt, field } from "./ui.js";
import { queue, readLocal } from "./local-data.js";

export function smartBar(d) {
  const h = d.habits,
    pending = queue();
  return `<section class="smart-panel"><div class="smart-command"><div><span class="eyebrow">VITA HIỂU THÓI QUEN CỦA BẠN</span><h2>Ghi một câu, nhớ cả ngày</h2><p>“Trưa ăn phở bò, uống 350ml nước”</p></div>${button("✦ Ghi bằng một câu", "smart", "primary")}</div><div class="habit-actions">${h.meal.length ? button(`↻ ${esc(h.meal.map((i) => i.name).join(" + "))}`, "usual-meal", "chip", `title="Đã ghi ${h.meal_count} lần trong 30 ngày"`) : ""}${h.workout ? button(`↗ ${esc(h.workout.name)}`, "start", "chip", `data-id="${h.workout.id}" title="${esc(h.workout.reason)}"`) : ""}${readLocal("meal-draft") ? button("✎ Tiếp tục bữa ăn đang ghi", "resume-meal", "chip") : ""}${button(pending.length ? `${pending.length} bản ghi chờ đồng bộ` : "✓ Đã đồng bộ", "outbox", "chip")}${button("Lịch sử & hoàn tác", "history-undo", "chip")}</div></section>`;
}
export function smartSheet(text = "") {
  modal(
    "Bạn muốn ghi gì?",
    `<p class="muted">Nhập tên món có trong thư viện, nước, cân nặng, ngủ, bước chân hoặc buổi tập đã hoàn thành.</p><label for="smart-text">Một câu ghi chú</label><textarea id="smart-text" rows="3" maxlength="1000" placeholder="Trưa ăn phở bò, uống 350ml nước">${esc(text)}</textarea><p class="notice">Ví dụ: “cân 74,6kg; ngủ 7h30; đi 8000 bước; đã tập cardio 30 phút”. Kết quả chỉ được lưu sau khi bạn xác nhận.</p><div id="smart-preview"></div>`,
    button("Phân tích câu ghi", "smart-preview"),
  );
}
export function previewBody(result) {
  return `${result.events.map((e) => `<div class="list-row"><span>✓</span><b>${esc(e.label)}</b></div>`).join("")}${result.unresolved.length ? `<p class="notice danger">Chưa hiểu: ${result.unresolved.map(esc).join("; ")}. Hãy sửa câu hoặc thêm món vào thư viện rồi phân tích lại.</p>` : ""}`;
}
export function reportView(d) {
  let r = d.report,
    c = r.current,
    p = r.previous;
  return `<article class="card"><span class="eyebrow">BÁO CÁO CÓ NGỮ CẢNH</span><h2>7 ngày qua, bạn đã thay đổi gì?</h2><p class="muted">${c.from} → ${c.to}</p><div class="report-grid">${[
    ["calories", "Calo", "kcal", c.meal_days],
    ["protein", "Protein", "g", c.meal_days],
    ["steps", "Bước chân", "bước", c.step_days],
    ["sleep", "Giấc ngủ", "phút", c.sleep_days],
  ]
    .map(
      ([k, title, unit, count]) =>
        `<div class="stat-tile"><small>${title} / ngày có ghi</small><b>${c[k] === null ? "Chưa ghi" : fmt(c[k]) + " " + unit}</b><small>${count}/7 ngày có dữ liệu</small><p>${r.changes[k] === null ? "Chưa đủ hai kỳ để so sánh" : `${r.changes[k] > 0 ? "+" : ""}${fmt(r.changes[k])} ${unit} so với 7 ngày trước`}</p></div>`,
    )
    .join(
      "",
    )}</div><div class="notice">Đã ghi ${c.sessions} buổi tập (kỳ trước: ${p.sessions}). ${c.weight_change === null ? "Chưa đủ hai ngày cân để xác định thay đổi." : `Cân nặng thay đổi ${c.weight_change > 0 ? "+" : ""}${c.weight_change} kg.`}</div><p class="muted">${esc(r.note)}</p><div class="notice"><b>Một việc cho tuần tới</b><p>${esc(r.next_step)}</p></div></article>`;
}
export function operationHistory(d) {
  modal(
    "Nhật ký thao tác",
    d.recent_operations
      .map(
        (o) =>
          `<div class="settings-row"><span>${esc({ water: "Thêm nước", meals: "Thêm bữa ăn", weight: "Ghi cân nặng", sleep: "Ghi giấc ngủ", steps: "Ghi bước chân", "smart/commit": "Ghi bằng một câu" }[o.resource] || o.resource)}<small>${new Date(o.created_at).toLocaleString("vi-VN")}${o.undone ? " · Đã hoàn tác" : ""}</small></span>${o.can_undo ? button("Hoàn tác", "undo", "secondary", `data-id="${o.id}"`) : ""}</div>`,
      )
      .join("") || '<p class="empty">Chưa có thao tác hỗ trợ hoàn tác.</p>',
  );
}
export function outboxSheet() {
  let items = queue();
  modal(
    "Bản ghi chờ đồng bộ",
    `<p class="notice">Dữ liệu này đang lưu trên thiết bị, chưa chắc đã tới máy chủ. Đồng bộ sẽ giữ nguyên ngày ghi và không tạo trùng.</p>${items.map((x) => `<div class="settings-row"><span>${esc(x.label || x.resource)}<small>${new Date(x.body.logged_at).toLocaleString("vi-VN")}</small>${x.error ? `<small class="danger">${esc(x.error)}</small>` : ""}</span>${button("Bỏ bản chờ", "discard-pending", "link-button", `data-id="${x.id}"`)}</div>`).join("") || '<p class="empty">Không có bản ghi đang chờ.</p>'}`,
    items.length ? button("Đồng bộ ngay", "sync") : "",
  );
}
