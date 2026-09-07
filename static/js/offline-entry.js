import { setOwner, enqueue, queue } from "./local-data.js";
import { operationId } from "./operation-id.js";
const owner = localStorage.getItem("vita-last-owner");
const form = document.querySelector("form");
const status = document.querySelector("#offline-status");
if (!owner) {
  form.hidden = true;
  status.textContent =
    "Hãy đăng nhập khi có mạng trước khi sử dụng ghi nhanh ngoại tuyến.";
} else {
  setOwner(owner);
  status.textContent = `Tài khoản trên thiết bị #${owner} · ${queue().length} bản ghi đang chờ. Đăng nhập đúng tài khoản này để đồng bộ.`;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const resource = form.elements.resource.value,
      value = Number(form.elements.value.value);
    const fields = {
      water: ["amount", 1, 3000],
      weight: ["weight", 20, 400],
      sleep: ["minutes", 0, 1440],
      steps: ["steps", 0, 150000],
    };
    const [key, min, max] = fields[resource];
    if (!Number.isFinite(value) || value < min || value > max) {
      status.textContent = `Giá trị phải từ ${min} đến ${max}.`;
      return;
    }
    try {
      enqueue({
        id: operationId(),
        resource,
        body: { [key]: value, logged_at: new Date().toISOString() },
        label: form.elements.resource.selectedOptions[0].text,
      });
      status.textContent = `Đã lưu trên thiết bị. ${queue().length} bản ghi chờ đồng bộ.`;
    } catch (error) {
      status.textContent = error.message;
    }
  });
}
