import { coachBanner, handleCoach, bindCoach } from "./coach-ui.js";
import {
  journeyBanner,
  handleJourney,
  bindJourney,
  setup as setupJourney,
} from "./journey-ui.js";
import {
  $,
  esc,
  fmt,
  icon,
  toast,
  close,
  modal,
  button,
  formData,
} from "./ui.js";
import * as views from "./views.js";
import {
  operationId as newOperationId,
  retrySignature,
} from "./operation-id.js";
import {
  setOwner,
  queue,
  enqueue,
  dequeue,
  updatePending,
  readLocal,
  writeLocal,
  clearMealDraft,
  saveMealDraft,
  removeLocal,
} from "./local-data.js";
import {
  smartBar,
  smartSheet,
  previewBody,
  reportView,
  operationHistory,
  outboxSheet,
} from "./smart-ui.js";
import {
  openSheet,
  draft,
  renderMeal,
  renderFoods,
  active,
  onboarding,
} from "./sheets.js";
let data,
  page = "home",
  tab = 0,
  busy = false,
  restUntil = 0;
let smartPreview = null;
bindCoach(() => data);
bindJourney(() => data);
const offlineResources = new Set([
  "water",
  "meals",
  "weight",
  "sleep",
  "steps",
]);
const csrf = () =>
  document.cookie
    .split("; ")
    .find((c) => c.startsWith("csrftoken="))
    ?.split("=")[1];
async function request(resource, body, method = "POST", operationId = null) {
  const response = await fetch(`/api/${resource}/`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrf(),
      ...(data?.user_id ? { "X-Account-ID": String(data.user_id) } : {}),
      ...(operationId ? { "X-Operation-ID": operationId } : {}),
    },
    ...(method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
  if (response.redirected) {
    location.href = "/login/";
    throw new Error("Vui lòng đăng nhập lại.");
  }
  let result = await response.json();
  if (!response.ok) {
    let error = new Error(result.error || "Không thể lưu. Vui lòng thử lại.");
    error.status = response.status;
    throw error;
  }
  return result;
}
function render() {
  document.body.classList.toggle("dark", data.profile.theme === "dark");
  $("#main").innerHTML = views[page](data, tab);
  if (page === "home") {
    document
      .querySelector("#main .hero-grid")
      .insertAdjacentHTML("beforebegin", journeyBanner(data));
    document
      .querySelector("#main .hero-grid")
      .insertAdjacentHTML("afterend", coachBanner(data) + smartBar(data));
  }
  $("#page-name").textContent = views.navs.find((x) => x[0] === page)[1];
  for (let selector of ["#desktop-nav", "#mobile-nav"])
    $(selector).innerHTML = views.navs
      .map(
        ([k, n]) =>
          `<button class="${selector === "#desktop-nav" ? "nav-item " : ""}${page === k ? "active" : ""}" data-nav="${k}">${icon(k)}<span>${n}</span></button>`,
      )
      .join("");
  $("#side-name").textContent = data.profile.name;
  $("#avatar").textContent = $("#side-avatar").textContent = data.profile.name
    .charAt(0)
    .toUpperCase();
  document.querySelectorAll("#main article.card").forEach((card) => {
    const trigger = card.querySelector(".card-head [data-action]");
    if (trigger) {
      card.tabIndex = 0;
      card.setAttribute(
        "aria-label",
        card.querySelector(".card-label").textContent,
      );
      card.addEventListener("click", (e) => {
        if (!e.target.closest("button,a,input,select")) trigger.click();
      });
      card.addEventListener("keydown", (e) => {
        if (e.target === card && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          trigger.click();
        }
      });
    }
  });
}
async function mutate(resource, body, message, keep = false, method = "POST") {
  if (busy) return false;
  busy = true;
  const controls = [
    ...document.querySelectorAll(
      '#sheet button,#main [data-action="quick-water"]',
    ),
  ];
  controls.forEach((b) => (b.disabled = true));
  const signature = await retrySignature([resource, method, body]);
  const retry = readLocal("retry-operations", {});
  const operationId = retry[signature] || newOperationId();
  retry[signature] = operationId;
  const canQueue =
    method === "POST" &&
    offlineResources.has(resource) &&
    !(resource === "meals" && body.id);
  if (canQueue) body = { ...body, logged_at: new Date().toISOString() };
  let stored = false;
  try {
    writeLocal("retry-operations", retry);
    if (canQueue) {
      enqueue({ id: operationId, resource, body, label: message });
      stored = true;
    }
    data = await request(resource, body, method, operationId);
    delete retry[signature];
    writeLocal("retry-operations", retry);
    if (stored) dequeue(operationId);
    if (resource === "meals") clearMealDraft();
    removeLocal("form-" + $("#sheet").dataset.form);
    render();
    if (!keep) close();
    if (message) {
      toast(message);
      addUndo(data.operation);
    }
    return true;
  } catch (e) {
    if (stored && !e.status) {
      delete retry[signature];
      writeLocal("retry-operations", retry);
      updatePending(operationId, "Chưa xác nhận từ máy chủ.");
      if (resource === "meals") clearMealDraft();
      render();
      close();
      toast("Đã giữ trên thiết bị · chờ đồng bộ");
      return true;
    }
    if (stored) dequeue(operationId);
    if (e.status) {
      delete retry[signature];
      writeLocal("retry-operations", retry);
    }
    showError(e.message);
    return false;
  } finally {
    busy = false;
    controls.forEach((b) => (b.disabled = false));
  }
}
function addUndo(operation) {
  if (!operation?.can_undo) return;
  const b = document.createElement("button");
  b.textContent = "Hoàn tác";
  b.dataset.action = "undo";
  b.dataset.id = operation.id;
  $("#toast").append(b);
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 9000);
}
async function syncPending() {
  if (busy) return;
  busy = true;
  try {
    for (const item of queue()) {
      try {
        data = await request(item.resource, item.body, "POST", item.id);
        dequeue(item.id);
      } catch (e) {
        updatePending(item.id, e.message);
        throw e;
      }
    }
    render();
    close();
    toast("Đã đồng bộ tất cả bản ghi");
  } catch (e) {
    render();
    outboxSheet();
    showError(e.message);
  } finally {
    busy = false;
  }
}
function showError(message) {
  if ($("#sheet").open) {
    $("#sheet-error").textContent = message;
    let key = message.split(":")[0];
    let el = document.querySelector(`[name="${CSS.escape(key)}"]`);
    if (el) {
      el.classList.add("field-invalid");
      let error = document.querySelector(`[data-error="${CSS.escape(key)}"]`);
      if (error) error.textContent = message;
      el.focus();
    }
  } else toast(message);
}
function checkFields() {
  for (let el of document.querySelectorAll("#sheet-body input")) {
    if (!el.checkValidity()) {
      el.reportValidity();
      return false;
    }
  }
  return true;
}
document.addEventListener("click", async (event) => {
  let target = event.target.closest("button,[data-nav]");
  if (!target) return;
  if (target.dataset.nav) {
    page = target.dataset.nav;
    tab = 0;
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
  }
  if (target.dataset.tab !== undefined) {
    tab = Number(target.dataset.tab);
    render();
    return;
  }
  let a = target.dataset.action,
    id = Number(target.dataset.id);
  if (!a || busy) return;
  if (await handleJourney(a, target, data, mutate)) return;
  if (await handleCoach(a, target, data, mutate)) return;
  if (a === "smart") {
    smartPreview = null;
    smartSheet(readLocal("smart-text", ""));
    return;
  }
  if (a === "smart-preview") {
    busy = true;
    target.disabled = true;
    try {
      smartPreview = await request("smart/preview", {
        text: $("#smart-text").value,
      });
      $("#smart-preview").innerHTML = previewBody(smartPreview);
      $("#sheet-footer").innerHTML =
        button("Phân tích lại", "smart-preview", "secondary") +
        (smartPreview.token ? button("Xác nhận & lưu", "smart-commit") : "");
    } catch (e) {
      showError(e.message);
    } finally {
      busy = false;
      target.disabled = false;
    }
    return;
  }
  if (a === "smart-commit") {
    if (
      smartPreview?.token &&
      (await mutate(
        "smart/commit",
        { token: smartPreview.token },
        "Đã ghi các hoạt động",
      ))
    ) {
      writeLocal("smart-text", "");
      smartPreview = null;
    }
    return;
  }
  if (a === "usual-meal") {
    await mutate(
      "meals",
      {
        kind: data.habits.kind,
        items: data.habits.meal.map(({ food, quantity }) => ({
          food,
          quantity,
        })),
      },
      "Đã ghi bữa quen thuộc",
    );
    return;
  }
  if (a === "resume-meal") {
    openSheet("meal", data);
    return;
  }
  if (a === "history-undo") {
    operationHistory(data);
    return;
  }
  if (a === "undo") {
    await mutate(
      "undo",
      { operation: target.dataset.id },
      "Đã hoàn tác thao tác",
    );
    return;
  }
  if (a === "outbox") {
    outboxSheet();
    return;
  }
  if (a === "sync") {
    await syncPending();
    return;
  }
  if (a === "discard-pending") {
    dequeue(target.dataset.id);
    render();
    outboxSheet();
    return;
  }
  if (a === "weekly") {
    modal("Báo cáo tuần", reportView(data));
    return;
  }
  if (a === "data-health") {
    modal("Sức khỏe dữ liệu", views.dataHealth(data));
    return;
  }
  if (a === "close") {
    close();
    return;
  }
  if (a === "custom-food") {
    const { field } = await import("./ui.js");
    modal(
      "Thêm món của bạn",
      field("name", "Tên món", "", "text", 'required maxlength="120"') +
        field("serving", "Khẩu phần", "1 phần", "text") +
        `<div class="field-grid">${[
          ["calories", "Calo (kcal)"],
          ["protein", "Protein (g)"],
          ["carbs", "Carb (g)"],
          ["fat", "Fat (g)"],
          ["fiber", "Chất xơ (g)"],
          ["sugar", "Đường (g)"],
          ["sodium", "Natri (mg)"],
        ]
          .map(
            ([k, t]) =>
              `<div>${field(k, t, 0, "number", 'min="0" step="0.1"')}</div>`,
          )
          .join("")}</div>`,
      button("Lưu & chọn món", "save-food"),
    );
    return;
  }
  if (a === "save-food") {
    if (!checkFields()) return;
    let before = new Set(data.foods.map((f) => f.id));
    if (await mutate("foods", formData(), "Đã lưu món ăn", true)) {
      let food = data.foods.find((f) => !before.has(f.id));
      draft.items.push({ food: food.id, quantity: 1 });
      renderMeal(data);
    }
    return;
  }
  const sheets = [
    "quick",
    "meal",
    "water",
    "water-detail",
    "weight",
    "measurements",
    "sleep",
    "steps",
    "workout",
    "active",
    "session-detail",
    "nutrition",
    "score",
    "coach",
    "weekly",
    "personal",
    "goals",
    "targets",
    "score-settings",
    "notifications",
    "units",
    "onboarding",
  ];
  if (sheets.includes(a)) {
    openSheet(a, data, { id: target.dataset.id });
    return;
  }
  if (a === "theme") {
    await mutate(
      "profile",
      { theme: data.profile.theme === "light" ? "dark" : "light" },
      "Đã đổi giao diện",
    );
    return;
  }
  if (a === "quick-water") {
    const previous = data.today.water;
    data.today.water += 250;
    render();
    let ok = await mutate("water", { amount: 250 }, "Đã thêm 250 ml nước");
    if (!ok) {
      data.today.water = previous;
      render();
    }
    return;
  }
  if (a === "water-preset" || a === "water-custom") {
    if (!checkFields()) return;
    await mutate(
      "water",
      {
        amount:
          a === "water-preset"
            ? Number(target.dataset.amount)
            : formData().amount,
      },
      "Đã thêm nước",
    );
    return;
  }
  if (a === "weight-minus" || a === "weight-plus") {
    let el = $("#f-weight");
    el.value = Math.min(
      400,
      Math.max(
        20,
        (Number(el.value) || 70) + (a === "weight-plus" ? 0.1 : -0.1),
      ),
    ).toFixed(1);
    writeLocal("form-weight", formData());
    return;
  }
  if (a === "sleep-preset") {
    $("#f-hours").value = target.dataset.hours;
    writeLocal("form-sleep", formData());
    return;
  }
  if (
    [
      "save-weight",
      "save-measurements",
      "save-sleep",
      "save-steps",
      "save-profile",
      "save-score",
      "save-notifications",
    ].includes(a)
  ) {
    if (!checkFields()) return;
    let values = formData();
    let resource = {
      "save-weight": "weight",
      "save-measurements": "measurements",
      "save-sleep": "sleep",
      "save-steps": "steps",
      "save-profile": "profile",
      "save-score": "profile",
      "save-notifications": "notifications",
    }[a];
    if (a === "save-sleep")
      values = {
        minutes: Math.round(Number(values.hours) * 60),
        quality: values.quality,
      };
    if (a === "save-score") values = { score_weights: values };
    await mutate(resource, values, "Đã lưu thay đổi");
    return;
  }
  if (a === "meal-kind") {
    draft.kind = target.dataset.kind;
    renderMeal(data);
    return;
  }
  if (a === "meal-filter") {
    draft.filter = target.dataset.filter;
    renderMeal(data);
    return;
  }
  if (a === "food-plus" || a === "food-minus") {
    let item = draft.items.find((x) => x.food === id);
    if (!item)
      draft.items.push({
        food: id,
        quantity: data.habits.portions[String(id)] || 1,
      });
    else
      item.quantity = Math.min(
        20,
        item.quantity + (a === "food-plus" ? 1 : -1),
      );
    draft.items = draft.items.filter((x) => x.quantity > 0);
    renderMeal(data);
    return;
  }
  if (a === "select-food") {
    openSheet("meal", data, { items: [{ food: id, quantity: 1 }] });
    return;
  }
  if (a === "save-meal") {
    if (!checkFields()) return;
    await mutate(
      "meals",
      {
        id: draft.id,
        kind: draft.kind,
        items: draft.items,
        template: draft.combo
          ? $("#f-combo_name")?.value || "Bữa ăn của tôi"
          : undefined,
      },
      "Đã lưu bữa ăn",
    );
    return;
  }
  if (a === "edit-meal") {
    let m = data.meals.find((m) => m.id === id);
    openSheet("meal", data, {
      id: m.id,
      kind: m.kind,
      items: m.items.map((i) => ({ food: i.food, quantity: i.quantity })),
    });
    return;
  }
  if (a === "duplicate") {
    let m = data.meals.find((m) => m.id === id);
    await mutate(
      "meals",
      {
        kind: m.kind,
        items: m.items.map((i) => ({ food: i.food, quantity: i.quantity })),
      },
      "Đã lặp lại bữa ăn",
    );
    return;
  }
  if (a === "repeat-breakfast") {
    let yesterday = new Date(data.today.date + "T12:00:00");
    yesterday.setDate(yesterday.getDate() - 1);
    let date = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    let meals = data.meals.filter(
      (m) => m.date === date && m.kind === "breakfast",
    );
    if (!meals.length) {
      openSheet("meal", data, { kind: "breakfast" });
      toast("Chưa có bữa sáng hôm qua. Chọn món để bắt đầu.");
      return;
    }
    await mutate(
      "meals",
      {
        kind: "breakfast",
        items: meals.flatMap((m) =>
          m.items.map((i) => ({ food: i.food, quantity: i.quantity })),
        ),
      },
      "Đã lặp bữa sáng hôm qua",
    );
    return;
  }
  if (a === "use-template") {
    let t = data.templates.find((t) => t.id === id);
    openSheet("meal", data, { items: t.items.map((i) => ({ ...i })) });
    return;
  }
  if (a === "favorite") {
    await mutate("favorites", { food: id }, "Đã cập nhật yêu thích", true);
    return;
  }
  if (a === "delete-meal" || a === "delete-water" || a === "delete-photo") {
    await mutate(
      {
        "delete-meal": "meals",
        "delete-water": "water",
        "delete-photo": "photos",
      }[a],
      { id },
      "Đã xóa bản ghi",
      false,
      "DELETE",
    );
    return;
  }
  if (a === "start") {
    if (
      await mutate(
        "workouts/start",
        { workout: id },
        "Buổi tập đã bắt đầu",
        true,
      )
    )
      active(data);
    return;
  }
  if (a === "complete-set") {
    if (!checkFields()) return;
    let values = formData();
    if (
      await mutate(
        "workouts/set",
        {
          session: draft.session,
          exercise: draft.exercise,
          weight: values.exercise_weight,
          reps: values.reps,
        },
        "Đã hoàn thành set",
        true,
      )
    ) {
      restUntil = Date.now() + 90000;
      writeLocal("rest-" + draft.session, restUntil);
      active(data);
      updateTimer();
    }
    return;
  }
  if (a === "rest-add") {
    restUntil += 30000;
    writeLocal("rest-" + draft.session, restUntil);
    updateTimer();
    return;
  }
  if (a === "rest-skip") {
    restUntil = 0;
    writeLocal("rest-" + draft.session, 0);
    updateTimer();
    return;
  }
  if (a === "finish") {
    if (
      await mutate(
        "workouts/finish",
        { session: draft.session },
        "Hoàn thành buổi tập. Làm tốt lắm!",
      )
    ) {
      restUntil = 0;
      openSheet("meal", data, { filter: "all" });
      toast("Buổi tập đã lưu. Bạn có muốn ghi bữa ăn sau tập?");
    }
    return;
  }
  if (a === "onboard-next" || a === "onboard-back") {
    if (!checkFields()) return;
    Object.assign(draft.profile, formData());
    if (a === "onboard-back") {
      draft.step--;
      onboarding();
      return;
    }
    if (draft.step < 3) {
      draft.step++;
      onboarding();
    } else
      await mutate(
        "profile",
        { ...draft.profile, onboarded: true },
        "Hành trình của bạn đã sẵn sàng",
      );
    return;
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "smart-text") {
    writeLocal("smart-text", e.target.value);
    smartPreview = null;
    $("#sheet-footer").innerHTML = button("Phân tích câu ghi", "smart-preview");
  }
  if (e.target.id === "food-search") {
    draft.search = e.target.value;
    renderFoods(data);
  }
  if (e.target.id === "f-combo_name") draft.combo_name = e.target.value;
  if (e.target.id === "f-combo_name") saveMealDraft(draft);
  if (
    ["weight", "sleep", "measurements", "steps"].includes(
      $("#sheet").dataset.form,
    )
  )
    writeLocal("form-" + $("#sheet").dataset.form, formData());
  e.target.classList.remove("field-invalid");
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "save-combo") {
    draft.combo = e.target.checked;
    renderMeal(data);
  }
  if (e.target.id === "photo-upload") {
    let file = e.target.files[0];
    if (!file) return;
    if (
      file.size > 1000000 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      toast("Chọn ảnh JPG/PNG/WebP dưới 1 MB.");
      return;
    }
    let reader = new FileReader();
    reader.onload = () =>
      mutate("photos", { image: reader.result }, "Đã lưu ảnh tiến độ");
    reader.readAsDataURL(file);
  }
});
$("#sheet").addEventListener(
  "close",
  () => (document.body.style.overflow = ""),
);
$("#sheet").addEventListener("click", (e) => {
  if (e.target === $("#sheet")) {
    let r = $("#sheet").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      close();
  }
});
function updateTimer() {
  let rest = $("#rest-box");
  if (rest) {
    restUntil = readLocal("rest-" + draft.session, 0);
    let seconds = Math.max(0, Math.ceil((restUntil - Date.now()) / 1000));
    rest.hidden = seconds === 0;
    $("#rest-timer").textContent =
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  let elapsed = $("#elapsed");
  if (elapsed)
    elapsed.textContent =
      Math.floor(
        (Date.now() - new Date(elapsed.dataset.start).getTime()) / 60000,
      ) + " phút";
}
setInterval(updateTimer, 1000);
async function init() {
  try {
    data = await request("dashboard/today", null, "GET");
    setOwner(data.user_id);
    render();
    if (queue().length) toast(`Có ${queue().length} bản ghi đang chờ đồng bộ.`);
    if (!data.profile.onboarded) setupJourney(data);
    else {
      let h = new Date().getHours(),
        period = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
      let reminders = Object.entries(data.notifications).filter(
        ([k, v]) => v === period,
      );
      let key = "vita-reminder-" + data.today.date + period;
      if (reminders.length && !sessionStorage.getItem(key)) {
        toast(
          "Lịch nhắc: " +
            reminders
              .map(
                ([k]) =>
                  ({
                    meal: "ghi bữa ăn",
                    water: "uống nước",
                    workout: "vận động",
                    weight: "ghi cân nặng",
                    sleep: "ghi giấc ngủ",
                  })[k],
              )
              .join(", "),
        );
        sessionStorage.setItem(key, "1");
      }
    }
  } catch (e) {
    $("#main").innerHTML =
      `<div class="card"><h2>Chưa tải được dữ liệu</h2><p>${esc(e.message)}</p><button class="primary" id="retry">Thử lại</button></div>`;
    $("#retry").onclick = init;
  }
}
window.addEventListener("online", () => {
  if (data && queue().length) syncPending();
});
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
init();
// Refresh contextual coaching when returning to an open app, without replacing an active form.
let lastContextRefresh = Date.now();
async function refreshContext(force = false) {
  if (!data || busy || document.hidden || $("#sheet").open || !navigator.onLine)
    return;
  if (!force && Date.now() - lastContextRefresh < 60000) return;
  lastContextRefresh = Date.now();
  const previous = data;
  try {
    const latest = await request("dashboard/today", null, "GET");
    if (!busy && !$("#sheet").open && data === previous) {
      data = latest;
      render();
    }
  } catch (_) {
    /* Retain the last usable snapshot while offline. */
  }
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshContext(true);
});
window.addEventListener("focus", () => refreshContext());
setInterval(() => refreshContext(), 60000);
