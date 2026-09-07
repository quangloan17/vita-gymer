import {
  $,
  esc,
  fmt,
  icon,
  button,
  bar,
  modal,
  field,
  mealKinds,
  empty,
} from "./ui.js";
import { nutritionCard, mealRows, weekly, quickActions } from "./views.js";
import { readLocal, saveMealDraft, clearMealDraft } from "./local-data.js";
export let draft = {};
export function openSheet(type, d, options = {}) {
  $("#sheet").dataset.form = type;
  renderSheet(type, d, options);
  if (["weight", "sleep", "measurements", "steps"].includes(type)) {
    const values = readLocal("form-" + type, {});
    for (const input of document.querySelectorAll(
      "#sheet-body input[name],#sheet-body select[name]",
    ))
      if (values[input.name] !== undefined) input.value = values[input.name];
  }
}
function renderSheet(type, d, options = {}) {
  const s = d.today,
    p = d.profile;
  if (type === "quick")
    return modal(
      "Bạn muốn ghi gì?",
      button("✦ Ghi bằng một câu", "smart", "primary full") +
        quickActions() +
        `<div class="preset-grid">${button("☾ Giấc ngủ", "sleep", "secondary")}${button("↔ Số đo", "measurements", "secondary")}</div>`,
    );
  if (type === "meal") {
    let hour = new Date().getHours();
    draft = {
      kind:
        hour < 10
          ? "breakfast"
          : hour < 15
            ? "lunch"
            : hour < 21
              ? "dinner"
              : "snack",
      items: [],
      filter: "recent",
      ...(!options.id && !options.items ? readLocal("meal-draft", {}) : {}),
      ...options,
    };
    renderMeal(d);
    return;
  }
  if (type === "water" || type === "water-detail") {
    const presets = d.habits.water_presets;
    return modal(
      type === "water" ? "Thêm một ly nước" : "Nước trong ngày",
      `<div class="stat-number">${fmt(s.water / 1000, 2)} <small>/ ${fmt(p.water / 1000, 2)} lít</small></div>${bar(s.water, p.water, "var(--blue)")}<div class="preset-grid">${presets.map((n) => button(`+ ${n} ml`, "water-preset", "", `data-amount="${n}"`)).join("")}</div><details><summary>Lượng nước khác</summary>${field("amount", "Lượng nước (ml)", 350, "number", 'min="1" max="3000"')}${button("Thêm nước", "water-custom", "primary full", 'style="margin-top:12px"')}</details>${type === "water-detail" ? `<h3 style="margin-top:22px">Lịch sử hôm nay</h3>${d.water_logs.map((w) => `<div class="settings-row"><span>${new Date(w.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span><b>+${w.amount} ml</b>${button("×", "delete-water", "icon-button", `data-id="${w.id}" aria-label="Xóa lần ghi nước"`)}</div>`).join("") || empty("Chưa ghi nước hôm nay.")}` : ""}`,
    );
  }
  if (type === "weight")
    return modal(
      "Một bước tiến nhỏ",
      `<p class="muted">Ghi lại cân nặng hôm nay của bạn.</p><div class="stepper">${button("−", "weight-minus", "", 'aria-label="Giảm 0.1 kg"')}<div>${field("weight", "Cân nặng (kg)", s.weight || p.start_weight, "number", 'min="20" max="400" step="0.1"')}</div>${button("+", "weight-plus", "", 'aria-label="Tăng 0.1 kg"')}</div><details><summary>Thông tin nâng cao</summary>${measurementFields()}</details>`,
      button("Lưu cân nặng", "save-weight"),
    );
  if (type === "measurements")
    return modal(
      "Số đo cơ thể",
      `<p class="muted">Chỉ nhập những chỉ số bạn muốn theo dõi.</p>${measurementFields()}`,
      button("Lưu số đo", "save-measurements"),
    );
  if (type === "sleep")
    return modal(
      "Đêm qua bạn ngủ thế nào?",
      `<div class="tabs">${[5, 6, 7, 8, 9].map((h) => button(h + "h", "sleep-preset", "chip", `data-hours="${h}"`)).join("")}</div>${field("hours", "Thời gian ngủ (giờ)", s.sleep ? s.sleep / 60 : 8, "number", 'min="0" max="24" step="0.1"')}<label for="f-quality">Cảm nhận khi thức dậy</label><select name="quality" id="f-quality"><option value="good">Tốt · Đầy năng lượng</option><option value="fair">Bình thường</option><option value="poor">Mệt mỏi</option></select>`,
      button("Lưu giấc ngủ", "save-sleep"),
    );
  if (type === "steps")
    return modal(
      "Vận động trong ngày",
      `<p class="muted">Nhập tổng số bước từ điện thoại hoặc đồng hồ của bạn.</p>${field("steps", "Số bước hôm nay", s.steps, "number", 'min="0" max="150000"')}`,
      button("Cập nhật bước chân", "save-steps"),
    );
  if (type === "workout") {
    let last = d.sessions[0],
      suggested = last
        ? d.programs.find((x) => x.id === last.workout)
        : d.programs[
            (new Date().getDay() + 6) % Math.max(1, d.programs.length)
          ];
    return modal(
      "Dành thời gian cho vận động",
      `${d.sessions.some((x) => !x.finished) ? button("Tiếp tục buổi tập đang mở →", "active", "primary full") : suggested ? button(`${last ? "↻ Lặp lại" : "Bắt đầu"} ${esc(suggested.name)}`, "start", "primary full", `data-id="${suggested.id}"`) : ""}<p class="eyebrow" style="margin-top:23px">CHỌN CHƯƠNG TRÌNH</p>${d.programs.map((w) => `<button class="list-row" data-action="start" data-id="${w.id}"><span class="quick-icon purple">${icon("workout")}</span><span class="grow"><b>${esc(w.name)}</b><small>${w.exercises.length} bài · Khoảng ${w.minutes} phút</small></span><span>→</span></button>`).join("") || empty("Chưa có chương trình. Chạy lệnh seed_catalog để thêm thư viện.")}`,
    );
  }
  if (type === "active") return active(d);
  if (type === "session-detail") {
    let x = d.sessions.find((x) => x.id === Number(options.id));
    if (!x) return;
    return modal(
      x.name,
      `<div class="stats-grid"><div class="stat-tile"><b>${fmt(x.minutes)}</b><small>phút</small></div><div class="stat-tile"><b>${fmt(x.calories)}</b><small>kcal ước tính</small></div><div class="stat-tile"><b>${x.sets.length}</b><small>set hoàn thành</small></div></div>${x.sets.map((set, i) => `<div class="settings-row"><span>${i + 1}. ${esc(d.programs.flatMap((p) => p.exercises).find((e) => e.id === set.exercise_id)?.name || "Bài tập")}</span><b>${set.weight} kg × ${set.reps}</b></div>`).join("") || empty("Chưa ghi set trong buổi tập này.")}`,
      button(
        "↻ Lặp lại buổi tập",
        "start",
        "primary",
        `data-id="${x.workout}"`,
      ),
    );
  }
  if (type === "nutrition")
    return modal(
      "Dinh dưỡng hôm nay",
      nutritionCard(d) +
        `<div class="stats-grid" style="margin:18px 0">${[
          ["Chất xơ", s.fiber, "g"],
          ["Đường", s.sugar, "g"],
          ["Natri", s.sodium, "mg"],
        ]
          .map(
            ([n, v, u]) =>
              `<div class="stat-tile"><small>${n}</small><b>${fmt(v)}${u}</b></div>`,
          )
          .join(
            "",
          )}</div>${mealRows(d.meals.filter((m) => m.date === s.date)) || empty("Chưa có bữa ăn hôm nay.", "meal")}`,
      button("+ Thêm bữa ăn", "meal"),
    );
  if (type === "score")
    return modal(
      "Điểm thói quen hôm nay",
      `<p class="notice">Điểm phản ánh mức hoàn thành mục tiêu đã đặt, không phải chỉ số đánh giá y khoa.</p>${Object.entries(
        s.components,
      )
        .map(
          ([k, v]) =>
            `<div style="margin:18px 0"><div class="settings-row" style="border:0"><span>${{ nutrition: "Dinh dưỡng", workout: "Tập luyện", water: "Uống nước", sleep: "Giấc ngủ", steps: "Bước chân" }[k]}</span><b>${v}%</b></div>${bar(v, 100)}</div>`,
        )
        .join("")}`,
      button("Điều chỉnh trọng số", "score-settings"),
    );
  if (type === "coach")
    return modal(
      "Góc đồng hành",
      d.insights
        .map(
          (i) =>
            `<div class="notice"><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p></div>`,
        )
        .join("") +
        `<p class="muted" style="font-size:11px">Gợi ý tự động theo nhật ký và mục tiêu của bạn. Không sử dụng để chẩn đoán hoặc điều trị.</p>`,
      button(
        {
          water: "Ghi một ly nước",
          sleep: "Ghi giấc ngủ",
          meal: "Ghi một bữa ăn",
        }[d.insights[0].action],
        d.insights[0].action,
      ),
    );
  if (type === "weekly") return modal("Tuần này của bạn", weekly(d));
  if (type === "personal")
    return modal(
      "Thông tin cá nhân",
      `${field("name", "Tên của bạn", p.name, "text", 'maxlength="80"')}<div class="field-grid"><div>${field("age", "Tuổi", p.age, "number", 'min="13" max="100"')}</div><div>${field("height", "Chiều cao (cm)", p.height, "number", 'min="100" max="250"')}</div></div><label>Giới tính</label><select name="gender">${[
        ["other", "Không chia sẻ"],
        ["male", "Nam"],
        ["female", "Nữ"],
      ]
        .map(
          ([v, t]) =>
            `<option value="${v}" ${p.gender === v ? "selected" : ""}>${t}</option>`,
        )
        .join("")}</select>`,
      button("Lưu thông tin", "save-profile"),
    );
  if (type === "goals")
    return modal(
      "Mục tiêu của riêng bạn",
      goalFields(p) +
        field(
          "frequency",
          "Buổi tập mỗi tuần",
          p.frequency,
          "number",
          'min="1" max="7"',
        ),
      button("Lưu mục tiêu", "save-profile"),
    );
  if (type === "targets")
    return modal(
      "Mục tiêu dinh dưỡng",
      `<p class="muted">Đặt theo kế hoạch cá nhân của bạn.</p><div class="field-grid">${[
        ["calories", "Calo (kcal)"],
        ["protein", "Protein (g)"],
        ["carbs", "Carb (g)"],
        ["fat", "Fat (g)"],
        ["water", "Nước (ml)"],
        ["steps", "Bước chân"],
      ]
        .map(([k, t]) => `<div>${field(k, t, p[k], "number", 'min="1"')}</div>`)
        .join("")}</div>`,
      button("Lưu mục tiêu", "save-profile"),
    );
  if (type === "score-settings")
    return modal(
      "Trọng số điểm thói quen",
      `<p class="muted">Tổng 5 phần cần bằng 100%.</p>${[
        ["nutrition", "Dinh dưỡng", 30],
        ["workout", "Tập luyện", 25],
        ["water", "Nước", 15],
        ["sleep", "Giấc ngủ", 15],
        ["steps", "Bước chân", 15],
      ]
        .map(([k, t, v]) =>
          field(
            k,
            t + " (%)",
            p.score_weights[k] ?? v,
            "number",
            'min="0" max="100"',
          ),
        )
        .join("")}`,
      button("Lưu trọng số", "save-score"),
    );
  if (type === "notifications")
    return modal(
      "Lịch nhắc của bạn",
      `<p class="notice">Lời nhắc hiển thị khi bạn mở VITA vào buổi đã chọn.</p>${[
        ["meal", "Bữa ăn"],
        ["water", "Uống nước"],
        ["workout", "Tập luyện"],
        ["weight", "Cân nặng"],
        ["sleep", "Giấc ngủ"],
      ]
        .map(
          ([k, t]) =>
            `<label>${t}</label><select name="${k}">${[
              ["off", "Tắt"],
              ["morning", "Buổi sáng"],
              ["afternoon", "Buổi chiều"],
              ["evening", "Buổi tối"],
            ]
              .map(
                ([v, l]) =>
                  `<option value="${v}" ${d.notifications[k] === v ? "selected" : ""}>${l}</option>`,
              )
              .join("")}</select>`,
        )
        .join("")}`,
      button("Lưu lịch nhắc", "save-notifications"),
    );
  if (type === "units")
    return modal(
      "Đơn vị đo",
      `<p class="notice">VITA sử dụng hệ mét thống nhất: kg, cm, ml, kcal và gram dinh dưỡng.</p>`,
    );
  if (type === "onboarding") {
    draft = { step: 0, profile: { ...p } };
    onboarding();
  }
}
function measurementFields() {
  return `<div class="field-grid"><div>${field("body_fat", "Mỡ cơ thể (%)", "", "number", 'min="1" max="70" step="0.1"')}</div><div>${field("waist", "Vòng eo (cm)", "", "number", 'min="20" max="250" step="0.1"')}</div><div>${field("muscle", "Khối lượng cơ (kg)", "", "number", 'min="1" max="200" step="0.1"')}</div></div>`;
}
function goalFields(p) {
  return `<label>Mục tiêu</label><select name="goal">${[
    ["lose", "Giảm mỡ"],
    ["maintain", "Duy trì"],
    ["build", "Xây dựng cơ bắp"],
  ]
    .map(
      ([v, t]) =>
        `<option value="${v}" ${p.goal === v ? "selected" : ""}>${t}</option>`,
    )
    .join(
      "",
    )}</select><div class="field-grid"><div>${field("start_weight", "Cân nặng ban đầu (kg)", p.start_weight, "number", 'min="20" max="400" step="0.1"')}</div><div>${field("target_weight", "Mục tiêu (kg)", p.target_weight, "number", 'min="20" max="400" step="0.1"')}</div></div>`;
}
export function renderMeal(d) {
  if (draft.items.length) saveMealDraft(draft);
  else if (!draft.id) clearMealDraft();
  let totals = draft.items.reduce(
    (s, i) => {
      let f = d.foods.find((f) => f.id === i.food);
      return {
        calories: s.calories + (f?.calories || 0) * i.quantity,
        protein: s.protein + (f?.protein || 0) * i.quantity,
      };
    },
    { calories: 0, protein: 0 },
  );
  modal(
    draft.id ? "Chỉnh sửa bữa ăn" : "Thêm một bữa ngon",
    `<div class="tabs">${Object.entries(mealKinds)
      .map(([k, t]) =>
        button(
          t,
          "meal-kind",
          `chip ${draft.kind === k ? "active" : ""}`,
          `data-kind="${k}"`,
        ),
      )
      .join(
        "",
      )}</div><input id="food-search" placeholder="Tìm món ăn của bạn…" aria-label="Tìm món ăn" value="${esc(draft.search || "")}"><div class="tabs">${[
      ["recent", "Gần đây"],
      ["favorites", "Yêu thích"],
      ["combo", "Combo"],
      ["all", "Tất cả"],
    ]
      .map(([k, t]) =>
        button(
          t,
          "meal-filter",
          `chip ${draft.filter === k ? "active" : ""}`,
          `data-filter="${k}"`,
        ),
      )
      .join(
        "",
      )}</div><div id="food-results"></div>${button("+ Thêm món khác", "custom-food", "link-button")}<div class="total-strip"><span><b>${fmt(totals.calories)}</b> kcal</span><span><b>${fmt(totals.protein)}</b>g protein</span></div><label class="check-label"><input type="checkbox" id="save-combo" ${draft.combo ? "checked" : ""}> Lưu thành combo cho lần sau</label>${draft.combo ? field("combo_name", "Tên combo", draft.combo_name || "Bữa ăn của tôi", "text") : ""}`,
    `${draft.id ? button("Xóa", "delete-meal", "secondary danger", `data-id="${draft.id}"`) : ""}${button("Lưu bữa ăn" + (draft.items.length ? ` · ${draft.items.length} món` : ""), "save-meal", "primary", !draft.items.length ? "disabled" : "")}`,
  );
  renderFoods(d);
}
export function renderFoods(d) {
  if (draft.filter === "combo") {
    $("#food-results").innerHTML =
      d.templates
        .map(
          (t) =>
            `<button class="list-row" data-action="use-template" data-id="${t.id}"><span class="emoji">🥙</span><span class="grow"><b>${esc(t.name)}</b><small>${t.items.length} món</small></span><span>+</span></button>`,
        )
        .join("") || empty("Lưu bữa ăn thành combo để dùng lại.");
    return;
  }
  let foods = d.foods.filter(
    (f) =>
      (!draft.search ||
        f.name
          .toLocaleLowerCase("vi")
          .includes(draft.search.toLocaleLowerCase("vi"))) &&
      (draft.filter !== "favorites" || d.favorites.includes(f.id)),
  );
  if (draft.filter === "recent") {
    let recent = d.meals.flatMap((m) => m.items.map((i) => i.food));
    foods.sort(
      (a, b) =>
        (recent.includes(a.id) ? recent.indexOf(a.id) : 999) -
        (recent.includes(b.id) ? recent.indexOf(b.id) : 999),
    );
  }
  $("#food-results").innerHTML =
    foods
      .map((f) => {
        let selected = draft.items.find((i) => i.food === f.id);
        return `<div class="list-row ${selected ? "selected-food" : ""}"><span class="emoji">${esc(f.emoji)}</span><div class="grow"><b>${esc(f.name)}</b><small>${f.calories} kcal · ${f.protein}g protein</small><small>${esc(f.serving)}</small></div><div class="food-controls">${selected ? button("−", "food-minus", "", `data-id="${f.id}" aria-label="Giảm khẩu phần"`) + `<span>${selected.quantity}</span>` : ""}${button(selected ? "+" : "+", "food-plus", "", `data-id="${f.id}" aria-label="Thêm ${esc(f.name)}"`)}</div></div>`;
      })
      .join("") || empty("Không tìm thấy món phù hợp.");
}
export function active(d) {
  let session = d.sessions.find((x) => !x.finished);
  if (!session) return openSheet("workout", d);
  let program = d.programs.find((p) => p.id === session.workout);
  let exercise =
    program.exercises.find(
      (e) => session.sets.filter((s) => s.exercise_id === e.id).length < e.sets,
    ) || program.exercises.at(-1);
  draft.session = session.id;
  draft.exercise = exercise.id;
  let sets = session.sets.filter((x) => x.exercise_id === exercise.id);
  const memory = d.workout_memory[String(exercise.id)];
  const previousSet =
    memory?.sets[Math.min(sets.length, memory.sets.length - 1)];
  modal(
    session.name,
    `<div class="card-head"><span class="tag">● Đang tập</span><span class="muted" id="elapsed" data-start="${session.started_at}"></span></div><h2 style="font-size:25px;margin:20px 0 5px">${esc(exercise.name)}</h2><p class="muted">${esc(exercise.muscle)} · Bài ${program.exercises.indexOf(exercise) + 1}/${program.exercises.length}</p><div id="rest-box" hidden><div class="timer" id="rest-timer">01:30</div><p class="timer-note">Thả lỏng một chút · Thời gian nghỉ</p><div class="inline-actions" style="justify-content:center;margin:12px">${button("+30 giây", "rest-add", "secondary")}${button("Bỏ qua", "rest-skip", "secondary")}</div></div><div style="margin-top:18px">${sets.map((x, i) => `<div class="set-row done"><span>${i + 1}</span><b>${x.weight} kg</b><b>× ${x.reps}</b><span>✓</span></div>`).join("")}</div><div class="field-grid"><div>${field("exercise_weight", "Khối lượng (kg)", exercise.weight, "number", 'min="0" max="600" step="0.5"')}</div><div>${field("reps", "Số lần lặp", exercise.reps, "number", 'min="1" max="100"')}</div></div>${button("✓ Hoàn thành set", "complete-set", "primary full", 'style="margin:20px 0 10px;min-height:56px"')}<p class="muted" style="font-size:10px;text-align:center">${session.sets.length} / ${program.exercises.reduce((n, e) => n + e.sets, 0)} set đã hoàn thành</p>`,
    button("Kết thúc buổi tập", "finish", "secondary full"),
  );
  if (previousSet) {
    $("#f-exercise_weight").value = previousSet.weight;
    $("#f-reps").value = previousSet.reps;
    $("#sheet-body .field-grid").insertAdjacentHTML(
      "beforebegin",
      `<div class="notice">Lần trước (${esc(memory.date)}), set ${Math.min(sets.length + 1, memory.sets.length)}: <b>${previousSet.weight} kg × ${previousSet.reps}</b>. Đã điền lại để bạn điều chỉnh theo cảm nhận hôm nay.</div>`,
    );
  }
}
export function onboarding() {
  let p = draft.profile;
  let bodies = [
    `<p class="muted">Bắt đầu với điều quan trọng nhất với bạn.</p>${goalFields(p)}`,
    `${field("name", "Bạn muốn được gọi là gì?", p.name, "text", "required")}${field("age", "Tuổi", p.age, "number", 'min="13" max="100"')}${field("height", "Chiều cao (cm)", p.height, "number", 'min="100" max="250"')}`,
    `<p class="muted">Mức vận động thường ngày của bạn.</p><label>Mức độ vận động</label><select name="activity">${[
      ["low", "Ít vận động"],
      ["moderate", "Vừa phải"],
      ["high", "Vận động nhiều"],
    ]
      .map(
        ([k, t]) =>
          `<option value="${k}" ${p.activity === k ? "selected" : ""}>${t}</option>`,
      )
      .join(
        "",
      )}</select>${field("frequency", "Số buổi tập mỗi tuần", p.frequency, "number", 'min="1" max="7"')}`,
    `<p class="notice">Xác nhận mục tiêu theo kế hoạch cá nhân. Bạn có thể chỉnh lại bất cứ lúc nào trong hồ sơ.</p>${field("calories", "Mục tiêu calo (kcal/ngày)", p.calories, "number", 'min="500" max="10000"')}${field("protein", "Protein (g/ngày)", p.protein, "number", 'min="1" max="500"')}${field("water", "Nước (ml/ngày)", p.water, "number", 'min="100" max="10000"')}`,
  ];
  modal(
    `Chào mừng đến VITA · ${draft.step + 1}/4`,
    bar(draft.step + 1, 4) +
      `<div style="margin-top:20px">${bodies[draft.step]}</div>`,
    (draft.step ? button("Quay lại", "onboard-back", "secondary") : "") +
      button(
        draft.step === 3 ? "Bắt đầu hành trình →" : "Tiếp tục →",
        "onboard-next",
      ),
  );
}
