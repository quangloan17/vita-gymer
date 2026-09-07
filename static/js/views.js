import { reportView } from "./smart-ui.js";
import {
  esc,
  fmt,
  icon,
  button,
  bar,
  head,
  empty,
  spark,
  mealKinds,
} from "./ui.js";
export const navs = [
  ["home", "Tổng quan"],
  ["food", "Dinh dưỡng"],
  ["workout", "Tập luyện"],
  ["progress", "Tiến độ"],
  ["profile", "Cá nhân"],
];
export function nutritionCard(d) {
  let s = d.today,
    p = d.profile;
  return `<article class="card">${head("flame", "Calo hôm nay", "nutrition")}<div class="calorie-main"><strong>${fmt(s.calories)}</strong><span>/ ${fmt(p.calories)} kcal</span><span class="remaining">${s.remaining >= 0 ? "Còn" : "Vượt"} ${fmt(Math.abs(s.remaining))} kcal</span></div>${bar(s.calories, p.calories, s.calories > p.calories ? "var(--orange)" : "var(--green)")}<div class="calorie-stats"><span>↗ Ăn vào <b>${fmt(s.calories)}</b></span><span>♨ Tập luyện <b>−${fmt(s.burned)}</b></span><span>◷ Còn lại <b>${fmt(s.remaining)}</b></span></div><div class="macros">${[
    ["protein", "Protein", "#8ca77b"],
    ["carbs", "Carb", "#d6ac79"],
    ["fat", "Fat", "#a7a0bf"],
  ]
    .map(
      ([k, n, c]) =>
        `<div class="macro"><div class="top">${n}<span>${fmt(s[k])} / ${p[k]}g</span></div>${bar(s[k], p[k], c)}<p>${Math.round((s[k] / p[k]) * 100)}% mục tiêu</p></div>`,
    )
    .join("")}</div></article>`;
}
export function quickActions() {
  return `<div class="quick-actions">${[
    ["food", "Bữa ăn", "Thêm món yêu thích", "meal", ""],
    ["water", "Nước", "Một ly nước nhỏ", "water", "blue"],
    ["weight", "Cân nặng", "Ghi nhận thay đổi", "weight", "orange"],
    ["workout", "Tập luyện", "Dành thời gian cho bạn", "workout", "purple"],
  ]
    .map(
      ([i, t, s, a, c]) =>
        `<button class="quick-button" data-action="${a}"><span class="quick-icon ${c}">${icon(i)}</span><span><b>${t}</b><small>${s}</small></span><span>+</span></button>`,
    )
    .join("")}</div>`;
}
export function workoutCard(d) {
  let session =
      d.sessions.find((s) => !s.finished) ||
      d.sessions.find((s) => s.date === d.today.date),
    program =
      d.programs.find((p) => p.id === session?.workout) || d.programs[0];
  return `<article class="card">${head("workout", "Tập luyện hôm nay", "workout")}<div class="workout-title">${esc(session?.name || "Sẵn sàng vận động?")}</div><div class="workout-meta">${session ? `<span>◷ ${fmt(session.minutes)} phút</span><span>♨ ${fmt(session.calories)} kcal</span><span>${session.sets.length} set</span>` : "Chưa có buổi tập. Bắt đầu một chút nhé."}</div>${button(session ? (session.finished ? "✓ Xem buổi tập" : "Tiếp tục buổi tập →") : "Bắt đầu tập luyện →", session && !session.finished ? "active" : session ? "session-detail" : "workout", "primary full", session ? `data-id="${session.id}"` : "")}<p class="muted" style="font-size:9px;margin-top:11px">${session?.finished ? "Đã hoàn thành · Bạn đã dành thời gian cho bản thân." : `${esc(program?.description || "Chọn chương trình phù hợp với bạn")}`}</p></article>`;
}
export function commandCenter(d) {
  const j = d.journey?.today;
  const next = j?.next;
  const complete = j?.tasks?.filter((x) => x.done).length || 0;
  const total = j?.tasks?.length || 0;
  const action = next?.action || "coach";
  const label = next ? "Bắt đầu việc này" : "Mở coach hôm nay";
  return `<section class="command-center"><div class="command-kicker"><span>● LIVE PLAN</span><span>${complete}/${total || 1} việc đã ghi</span></div><div class="command-main"><div><p class="eyebrow">TRUNG TÂM ĐIỀU HÀNH HÔM NAY</p><h2>${esc(next?.title || "Bạn đã hoàn thành các mục chính")}</h2><p>${esc(next?.text || "Coach đã cập nhật kế hoạch từ dữ liệu hôm nay của bạn.")}</p></div><div class="command-actions">${button(label, action, "primary")} ${button("Xem kế hoạch", "journey-today", "secondary")}</div></div><div class="command-rail">${(j?.tasks || []).map((task, index) => `<button class="command-task ${task.done ? "done" : ""} ${task === next ? "next" : ""}" data-action="${task.action}"><span>${task.done ? "✓" : index + 1}</span><b>${esc(task.title)}</b><small>${task.done ? "Đã có dữ liệu" : task === next ? "Việc tiếp theo" : "Chờ thực hiện"}</small></button>`).join("") || `<button class="command-task next" data-action="journey-setup"><span>1</span><b>Thiết lập coach</b><small>Bắt đầu từ dữ liệu của bạn</small></button>`}</div></section>`;
}
export function dataHealth(d) {
  const s = d.today;
  const rows = [
    [
      "Bữa ăn",
      d.meals.some((x) => x.date === s.date),
      "meal",
      "Coach chỉ tính món bạn đã lưu là đã ăn.",
    ],
    ["Nước", s.water > 0, "water", "Lượng nước được cộng từ các lần bạn ghi."],
    [
      "Giấc ngủ",
      s.sleep > 0,
      "sleep",
      "Chưa ghi không có nghĩa là bạn ngủ ít.",
    ],
    [
      "Vận động",
      s.sessions > 0,
      "workout",
      "Chỉ buổi đã hoàn thành mới có trong thống kê.",
    ],
    [
      "Cân nặng",
      d.weights.some((x) => x.date === s.date),
      "weight",
      "Xu hướng cần nhiều ngày cân, không dùng một lần đo.",
    ],
  ];
  const ready = rows.filter((x) => x[1]).length;
  return `<div class="data-health"><section class="data-health-hero"><span>CHẤT LƯỢNG DỮ LIỆU</span><strong>${ready}/5</strong><p>${ready >= 4 ? "Coach có đủ cơ sở để đưa nhận xét hôm nay." : "Bổ sung một vài bản ghi để coach hiểu ngày hôm nay rõ hơn."}</p></section>${rows.map(([name, done, action, note]) => `<section class="data-health-row ${done ? "ready" : "missing"}"><span>${done ? "✓" : "!"}</span><div><b>${name}</b><p>${note}</p></div>${button(done ? "Xem" : "Ghi ngay", action, done ? "secondary" : "primary")}</section>`).join("")}<p class="data-health-note">Số liệu được phân biệt giữa bản ghi thực tế, ước tính và gợi ý. VITA không tự xem dữ liệu thiếu là kết quả xấu.</p></div>`;
}
export function home(d) {
  let s = d.today,
    p = d.profile,
    week = d.weights.filter((w) => w.date >= d.week[0].date),
    change =
      week.length > 1
        ? Number(week.at(-1).weight) - Number(week[0].weight)
        : null;
  let hour = new Date().getHours();
  return `<div class="welcome"><div><span class="eyebrow">MỖI NGÀY LÀ MỘT KHỞI ĐẦU MỚI</span><h1>Chào ${hour < 12 ? "buổi sáng" : hour < 18 ? "buổi chiều" : "buổi tối"}, ${esc(p.name)} <span style="font-size:24px">☀</span></h1><p>${s.calories ? "Bạn đang từng bước tiến gần hơn đến mục tiêu của mình." : "Bắt đầu bằng một thói quen nhỏ. VITA đồng hành cùng bạn."}</p></div><div class="date-pill">${icon("calendar")}${new Date().toLocaleDateString("vi-VN", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</div></div>${commandCenter(d)}<div class="section-top"><h2>Hôm nay của bạn</h2><span class="tag">● Cập nhật theo hoạt động</span></div><div class="hero-grid"><article class="card score-card">${head("spark", "Điểm hôm nay", "score")}<div class="score-middle"><div class="ring" style="--value:${s.score}"><div class="ring-inner"><strong>${s.score}</strong><small>/ 100 điểm</small></div></div><div class="score-copy"><h3>${s.score >= 80 ? "Bạn đang làm rất tốt!" : s.score >= 40 ? "Đang đi đúng hướng" : "Cùng bắt đầu nhé!"}</h3><p>Mỗi lựa chọn nhỏ<br>đều tạo nên khác biệt.</p><span class="tag" style="margin-top:9px">✦ ${s.score >= 80 ? "Một ngày cân bằng" : "Tiếp tục từng bước"}</span></div></div><div class="score-note"><span>✧</span><span>${esc(d.insights[0].text)}</span></div></article>${nutritionCard(d)}</div><section class="quick-wrap"><div class="section-top"><h2>Ghi nhanh <span class="muted" style="font-size:10px;font-weight:400">· Chỉ một vài chạm</span></h2>${button("Lặp bữa sáng ↗", "repeat-breakfast", "link-button")}</div>${quickActions()}</section><div class="triple-grid">${workoutCard(d)}<article class="card">${head("water", "Uống nước", "water-detail")}<div class="stat-number">${fmt(s.water / 1000, 2)} <small>/ ${fmt(p.water / 1000, 2)} lít</small></div><div class="water-cups">${Array.from({ length: 8 }, (_, i) => `<span class="cup" style="--fill:${Math.min(100, Math.max(0, (s.water / p.water) * 8 - i) * 100)}%"></span>`).join("")}</div><div class="water-bottom"><span>${Math.round((s.water / p.water) * 100)}% mục tiêu ngày</span>${button("+250 ml", "quick-water", "water-add")}</div></article><article class="card">${head("weight", "Cân nặng", "weight")}<div class="stat-number">${s.weight ? fmt(s.weight, 1) : "—"} <small>kg</small></div><p class="change">${change === null ? "Ghi cân nặng để theo dõi" : `${change <= 0 ? "↘" : "↗"} ${fmt(Math.abs(change), 1)} kg trong 7 ngày`}</p>${spark(week.map((w) => w.weight))}<div class="chart-labels"><span>${d.week[0].date.slice(5)}</span><span>Hôm nay</span></div></article></div><div class="bottom-grid"><article class="card">${head("spark", "Góc đồng hành", "coach")}${d.insights
    .slice(0, 1)
    .map(
      (i) =>
        `<div class="insight"><span class="insight-icon">✧</span><div><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p></div></div>`,
    )
    .join(
      "",
    )}<div style="text-align:right">${button("Xem phân tích của bạn →", "coach", "link-button")}</div></article><article class="card data-health-card">${head("spark", "Sức khỏe dữ liệu", "data-health")}<strong>${[s.calories > 0, s.water > 0, s.sleep > 0, s.sessions > 0, d.weights.some((x) => x.date === s.date)].filter(Boolean).length}/5</strong><p>Kiểm tra dữ liệu coach đang dùng trước khi xem nhận xét.</p>${button("Xem mức đầy đủ", "data-health", "secondary")}</article><article class="card">${head("goal", "Mục tiêu của bạn", "goals")}<span class="tag" style="margin-top:16px">${{ lose: "Giảm mỡ", maintain: "Duy trì cân nặng", build: "Xây dựng cơ bắp" }[p.goal]}</span><div class="goal-main"><strong>${s.weight ? fmt(s.weight, 1) : "—"} <small>kg</small></strong><span>⟶</span><strong>${fmt(p.target_weight, 1)} <small>kg</small></strong></div>${bar(Math.abs(p.start_weight - (s.weight || p.start_weight)), Math.abs(p.start_weight - p.target_weight) || 1)}<div class="goal-bottom"><span>Bắt đầu: ${fmt(p.start_weight, 1)} kg</span><span>Còn ${fmt(Math.abs((s.weight || p.start_weight) - p.target_weight), 1)} kg</span></div></article></div><details class="extras"><summary>Hoạt động, giấc ngủ & tổng kết tuần <span class="muted">↗</span></summary><div class="extras-grid"><article class="card">${head("steps", "Vận động", "steps")}<div class="stat-number">${fmt(s.steps)} <small>/ ${fmt(p.steps)} bước</small></div>${bar(s.steps, p.steps)}<p class="muted" style="margin-top:12px">Khoảng ${fmt(s.steps * 0.0007, 1)} km · Ước tính</p></article><article class="card">${head("sleep", "Giấc ngủ", "sleep")}<div class="stat-number">${Math.floor(s.sleep / 60)}h ${s.sleep % 60}m</div><p class="muted">${s.sleep ? { good: "Chất lượng tốt", fair: "Bình thường", poor: "Chưa tốt" }[s.sleep_quality] : "Chưa ghi giấc ngủ hôm nay"}</p></article><article class="card">${head("progress", "7 ngày gần đây", "weekly")}<div class="stat-number">${d.week.reduce((n, x) => n + x.sessions, 0)} <small>buổi tập</small></div><p class="muted">${d.report.current.calories === null ? "—" : fmt(d.report.current.calories)} kcal / ngày</p></article></div></details>`;
}
export function mealRows(meals) {
  return meals
    .map(
      (m) =>
        `<div class="list-row"><span class="emoji">${esc(m.items[0]?.emoji || "🥗")}</span><div class="grow"><b>${mealKinds[m.kind]} <small>${esc(m.items.map((i) => i.name).join(" · "))}</small></b><small>${m.date} · ${m.time}</small></div><span class="value">${fmt(m.items.reduce((n, i) => n + i.calories, 0))}<small>kcal</small></span><button class="icon-button" data-action="edit-meal" data-id="${m.id}" aria-label="Sửa bữa ăn">✎</button><button class="icon-button" data-action="duplicate" data-id="${m.id}" aria-label="Lặp bữa ăn">↻</button></div>`,
    )
    .join("");
}
export function food(d, tab) {
  let tabs = ["Hôm nay", "Lịch sử", "Yêu thích", "Combo", "Thực phẩm"];
  let body = "";
  if (tab < 2) {
    let meals = d.meals.filter((m) => tab === 1 || m.date === d.today.date);
    body = meals.length
      ? mealRows(meals)
      : empty("Bữa ăn đầu tiên đang chờ bạn ghi lại.", "meal", "+ Thêm bữa ăn");
  } else if (tab === 3) {
    body =
      d.templates
        .map(
          (t) =>
            `<div class="list-row"><span class="emoji">🥙</span><div class="grow"><b>${esc(t.name)}</b><small>${t.items.length} món đã lưu</small></div>${button("Dùng combo", "use-template", "secondary", `data-id="${t.id}"`)}</div>`,
        )
        .join("") || empty("Lưu một bữa ăn thành combo để dùng lại.", "meal");
  } else {
    let foods = d.foods.filter((f) => tab === 4 || d.favorites.includes(f.id));
    body =
      foods
        .map(
          (f) =>
            `<div class="list-row"><span class="emoji">${esc(f.emoji)}</span><div class="grow"><b>${esc(f.name)}</b><small>${f.serving} · ${f.protein}g protein</small></div><span>${f.calories} kcal</span>${button(d.favorites.includes(f.id) ? "★" : "☆", "favorite", "icon-button", `data-id="${f.id}" aria-label="Yêu thích ${esc(f.name)}"`)}${button("+", "select-food", "icon-button", `data-id="${f.id}" aria-label="Thêm ${esc(f.name)}"`)}</div>`,
        )
        .join("") ||
      empty("Chạm ngôi sao bên cạnh món ăn để lưu yêu thích.", "meal");
  }
  return `<div class="welcome"><div><span class="eyebrow">ĂN UỐNG CÓ CHỦ ĐÍCH</span><h1>Dinh dưỡng của bạn</h1><p>Thêm một bữa ngon. Tiến gần hơn một chút.</p></div>${button("+ Bữa ăn", "meal")}</div>${nutritionCard(d)}${tabbar(tabs, tab)}<article class="card">${body}</article>`;
}
export function tabbar(tabs, tab) {
  return `<div class="tabs">${tabs.map((t, i) => `<button class="chip ${i === tab ? "active" : ""}" data-tab="${i}">${t}</button>`).join("")}</div>`;
}
export function workout(d, tab) {
  let tabs = ["Hôm nay", "Chương trình", "Lịch sử", "Bài tập", "Thống kê"];
  let body;
  if (tab === 0) body = workoutCard(d);
  else if (tab === 1)
    body = `<div class="profile-grid">${d.programs.map((p) => `<article class="card"><span class="tag">${p.exercises.length} bài tập</span><h2 style="margin:14px 0">${esc(p.name)}</h2><p class="muted">${esc(p.description)} · ${p.minutes} phút</p><div style="margin-top:20px">${button("Bắt đầu →", "start", "primary full", `data-id="${p.id}"`)}</div></article>`).join("")}</div>`;
  else if (tab === 2)
    body = `<article class="card">${d.sessions.map((s) => `<button class="list-row" data-action="${s.finished ? "session-detail" : "active"}" data-id="${s.id}"><span class="quick-icon purple">${icon("workout")}</span><span class="grow"><b>${esc(s.name)}</b><small>${s.date} · ${s.finished ? "Hoàn thành" : "Đang tập"}</small></span><span>${fmt(s.minutes)} phút ↗</span></button>`).join("") || empty("Chưa có buổi tập.", "workout")}</article>`;
  else if (tab === 3)
    body = `<article class="card">${[...new Map(d.programs.flatMap((p) => p.exercises).map((e) => [e.id, e])).values()].map((e) => `<div class="list-row"><span class="quick-icon">${icon("workout")}</span><div><b>${esc(e.name)}</b><small>${esc(e.muscle)} · ${e.sets} set × ${e.reps}</small></div></div>`).join("")}</article>`;
  else body = weekly(d);
  return `<div class="welcome"><div><span class="eyebrow">KHỎE HƠN TỪNG NGÀY</span><h1>Thời gian dành cho bạn</h1><p>Vận động theo nhịp của riêng mình.</p></div>${button("Bắt đầu tập →", "workout")}</div>${tabbar(tabs, tab)}${body}`;
}
export function weekly(d) {
  return reportView(d);
}
export function progress(d, tab) {
  let body;
  if (tab === 0) body = weekly(d);
  else if (tab === 1)
    body = `<article class="card">${head("weight", "Xu hướng cân nặng", "weight")}${spark(
      d.weights.map((w) => w.weight),
      true,
    )}${d.weights
      .slice(-14)
      .reverse()
      .map(
        (w) =>
          `<div class="settings-row"><span>${w.date}</span><b>${fmt(w.weight, 1)} kg</b></div>`,
      )
      .join("")}</article>`;
  else if (tab === 2)
    body = `<article class="card"><h2>Calo & protein trong tuần</h2>${d.week.map((x) => `<div class="list-row"><span class="grow">${x.date}</span><b>${fmt(x.calories)} kcal · ${fmt(x.protein)}g protein</b></div>`).join("")}</article>`;
  else if (tab === 3) body = weekly(d);
  else if (tab === 4)
    body = `<article class="card">${head("weight", "Số đo cơ thể", "measurements")}${d.measurements.map((m) => `<div class="list-row"><div class="grow"><b>${m.date}</b><small>Mỡ ${m.body_fat ?? "—"}% · Eo ${m.waist ?? "—"}cm · Cơ ${m.muscle ?? "—"}kg</small></div></div>`).join("") || empty("Ghi số đo đầu tiên của bạn.", "measurements")}</article>`;
  else
    body = `<article class="card"><h2>Hành trình qua từng bức ảnh</h2><p class="muted">Ảnh riêng tư chỉ hiển thị trong tài khoản của bạn.</p><label class="file-input">Thêm ảnh (JPG/PNG/WebP, tối đa 1 MB)<input type="file" id="photo-upload" accept="image/jpeg,image/png,image/webp"></label><div class="photo-grid">${d.photos.map((p) => `<div><img src="/photos/${p.id}/" alt="Ảnh tiến độ ${p.date}" loading="lazy"><small>${p.date}</small>${button("Xóa", "delete-photo", "link-button danger", `data-id="${p.id}"`)}</div>`).join("")}</div></article>`;
  return `<div class="welcome"><div><span class="eyebrow">NHÌN LẠI ĐỂ TIẾN XA HƠN</span><h1>Mỗi bước tiến đều đáng ghi nhận</h1></div>${button("+ Cân nặng", "weight")}</div>${tabbar(["Tổng quan", "Cân nặng", "Dinh dưỡng", "Tập luyện", "Số đo", "Ảnh"], tab)}${body}`;
}
export function profile(d) {
  let p = d.profile;
  return `<div class="welcome"><div><span class="eyebrow">HÀNH TRÌNH CỦA RIÊNG BẠN</span><h1>Xin chào, ${esc(p.name)}</h1><p>Điều chỉnh mục tiêu phù hợp với cuộc sống của bạn.</p></div></div><div class="profile-grid"><article class="card"><h2>Hồ sơ & mục tiêu</h2>${[
    ["Thông tin cá nhân", `${p.age} tuổi · ${p.height} cm`, "personal"],
    ["Mục tiêu", `${p.target_weight} kg`, "goals"],
    ["Dinh dưỡng", `${p.calories} kcal / ngày`, "targets"],
    ["Tập luyện", `${p.frequency} buổi / tuần`, "goals"],
    ["Điểm thói quen", "Tùy chỉnh trọng số", "score-settings"],
  ]
    .map(
      ([t, s, a]) =>
        `<div class="settings-row"><span>${t}<small>${s}</small></span>${button("Chỉnh sửa ↗", a, "link-button")}</div>`,
    )
    .join("")}</article><article class="card"><h2>Trải nghiệm của bạn</h2>${[
    ["Giao diện", p.theme === "dark" ? "Tối" : "Sáng", "theme"],
    ["Lịch nhắc", "Theo buổi trong ngày", "notifications"],
    ["Thiết lập ban đầu", "4 bước cá nhân hóa", "onboarding"],
    ["Đơn vị", "kg · cm · ml · kcal", "units"],
  ]
    .map(
      ([t, s, a]) =>
        `<div class="settings-row"><span>${t}<small>${s}</small></span>${button("Thiết lập ↗", a, "link-button")}</div>`,
    )
    .join(
      "",
    )}<div class="settings-row"><span>Dữ liệu & riêng tư<small>Tải bản sao dữ liệu của bạn</small></span><a href="/api/export/">Xuất JSON ↗</a></div><form method="post" action="/logout/"><input type="hidden" name="csrfmiddlewaretoken" value="${
    document.cookie
      .split("; ")
      .find((x) => x.startsWith("csrftoken="))
      ?.split("=")[1] || ""
  }"><button class="link-button danger" style="margin-top:13px">Đăng xuất</button></form></article></div>`;
}
