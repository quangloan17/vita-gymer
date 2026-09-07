export const $ = (s) => document.querySelector(s);
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const fmt = (n, digits = 0) =>
  Number(n || 0).toLocaleString("vi-VN", { maximumFractionDigits: digits });
const paths = {
  home: "M3 10 12 3l9 7v11h-6v-7H9v7H3z",
  food: "M5 3v7m4-7v7M3 3v5a4 4 0 0 0 8 0V3M7 12v9M19 3c-4 3-4 8 0 9V3zm0 9v9",
  workout: "M7 7v10M3 9v6M17 7v10M21 9v6M7 12h10M3 12h4m10 0h4",
  progress: "M4 3v17h17M7 15l4-5 4 2 5-7",
  profile: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2",
  water: "M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13zM8 15a4 4 0 0 0 4 4",
  weight: "M4 5h16v16H4zM8 9a5 5 0 0 1 8 0l-4 4z",
  sleep: "M20 15A9 9 0 0 1 9 3 9 9 0 1 0 20 15z",
  steps: "M9 3v5l-3 4 5 3-2 6M9 8l6 3 4-1M11 15l5 2 2 4",
  calendar: "M4 5h16v16H4zM4 10h16M8 3v4m8-4v4",
  flame: "M13 2c3 7 7 9 7 14a8 8 0 0 1-16 0c0-4 3-6 5-9 0 5 2 5 2 5s3-4 2-10z",
  goal: "M20 12a8 8 0 1 1-8-8M16 12a4 4 0 1 1-4-4M12 12l9-9m-5 0h5v5",
  spark: "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`;
export const button = (text, action, cls = "primary", attrs = "") =>
  `<button class="${cls}" data-action="${action}" ${attrs}>${text}</button>`;
export const bar = (value, total, color = "var(--green)") =>
  `<div class="bar" role="progressbar" aria-label="Tiến độ" aria-valuenow="${Math.round(value)}" aria-valuemin="0" aria-valuemax="${Math.max(total, value)}"><i style="--value:${Math.max(0, Math.min(100, (value / total) * 100))}%;background:${color}"></i></div>`;
export const head = (name, label, action) =>
  `<div class="card-head"><span class="card-label">${icon(name)} ${label}</span>${action ? button("↗", action, "icon-button", 'aria-label="Xem chi tiết ' + label + '"') : ""}</div>`;
export const empty = (text, action, label = "Ghi ngay") =>
  `<div class="empty">${icon("spark").replace("<svg", '<svg style="width:28px;height:28px"')}<p>${text}</p>${action ? button(label, action) : ""}</div>`;
export function spark(values, large = false) {
  const list = values.filter((v) => v != null).map(Number);
  if (list.length < 2)
    return `<p class="empty">Ghi thêm dữ liệu để thấy xu hướng.</p>`;
  const min = Math.min(...list) - 0.2,
    max = Math.max(...list) + 0.2;
  const points = list.map(
    (v, i) =>
      `${(i / (list.length - 1)) * 300},${85 - ((v - min) / (max - min)) * 70}`,
  );
  return `<svg class="${large ? "large-chart" : "spark"}" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="Xu hướng từ ${esc(list[0])} đến ${esc(list.at(-1))}"><path d="M0 90H300M0 50H300M0 10H300" stroke="var(--line)" stroke-dasharray="3 4" fill="none"/><path d="M${points.join(" L")} L300 100 L0 100Z" fill="#8ca57b14"/><polyline points="${points.join(" ")}" fill="none" stroke="#8ca57b" stroke-width="2.2" vector-effect="non-scaling-stroke"/></svg>`;
}
export const mealKinds = {
  breakfast: "Bữa sáng",
  lunch: "Bữa trưa",
  dinner: "Bữa tối",
  snack: "Ăn nhẹ",
};
export function toast(text) {
  $("#toast").textContent = "✓ " + text;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 3200);
}
export function modal(title, body, footer = "") {
  $("#sheet-title").textContent = title;
  $("#sheet-body").innerHTML = body;
  $("#sheet-footer").innerHTML = footer;
  $("#sheet-error").textContent = "";
  if (!$("#sheet").open) {
    $("#sheet").showModal();
    document.body.style.overflow = "hidden";
  }
}
export function close() {
  $("#sheet").close();
  document.body.style.overflow = "";
}
export const field = (name, label, value, type = "number", extra = "") =>
  `<label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}><span class="field-error" data-error="${name}"></span>`;
export const formData = () =>
  Object.fromEntries(
    [
      ...document.querySelectorAll(
        "#sheet-body input[name],#sheet-body select[name]",
      ),
    ]
      .filter((e) => e.type !== "checkbox")
      .map((e) => [e.name, e.value]),
  );
