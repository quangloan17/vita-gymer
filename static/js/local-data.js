// All local records are partitioned by account; no private page is cached by SW.
let owner = null;
export function setOwner(id) {
  owner = String(id);
  localStorage.setItem("vita-last-owner", owner);
}
const key = (name) => `vita:${owner}:${name}`;
export function readLocal(name, fallback = null) {
  if (!owner) return fallback;
  try {
    return JSON.parse(localStorage.getItem(key(name))) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(name, value) {
  if (!owner) throw new Error("Chưa xác định tài khoản.");
  localStorage.setItem(key(name), JSON.stringify(value));
}
export function removeLocal(name) {
  if (owner) localStorage.removeItem(key(name));
}
export function queue() {
  return readLocal("outbox", []);
}
export function enqueue(operation) {
  let items = queue();
  if (items.length >= 100)
    throw new Error("Có 100 bản ghi chờ. Hãy đồng bộ trước khi ghi thêm.");
  if (!items.some((x) => x.id === operation.id)) {
    items.push(operation);
    writeLocal("outbox", items);
  }
  return operation;
}
export function dequeue(id) {
  writeLocal(
    "outbox",
    queue().filter((x) => x.id !== id),
  );
}
export function updatePending(id, error) {
  writeLocal(
    "outbox",
    queue().map((x) => (x.id === id ? { ...x, error } : x)),
  );
}
export function saveMealDraft(draft) {
  if (!draft.id && draft.items?.length)
    writeLocal("meal-draft", { ...draft, saved_at: Date.now() });
}
export function clearMealDraft() {
  removeLocal("meal-draft");
}
