const statusEl = document.getElementById("status");
const reloadBtn = document.getElementById("reload");
const searchEl = document.getElementById("search");
const ownerFilterEl = document.getElementById("ownerFilter");
const colTodoEl = document.getElementById("col-todo");
const colInProgressEl = document.getElementById("col-in-progress");
const colDoneEl = document.getElementById("col-done");
const countTodoEl = document.getElementById("count-todo");
const countInProgressEl = document.getElementById("count-in-progress");
const countDoneEl = document.getElementById("count-done");

let allItems = [];

function renderChecklist(checklist) {
  if (!Array.isArray(checklist) || checklist.length === 0) return "<em>No checklist</em>";
  const list = checklist
    .map((item) => `<li>${item.done ? "✅" : "⬜"} ${escapeHtml(item.text)}</li>`)
    .join("");
  return `<ul>${list}</ul>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toBoardStatus(status) {
  if (status === "todo") return "todo";
  if (status === "in_progress") return "in_progress";
  if (status === "done") return "done";
  return "todo";
}

function itemCard(item) {
  return `
    <article class="card">
      <h3>${escapeHtml(item.id)} · ${escapeHtml(item.title)}</h3>
      <p><strong>Status:</strong> ${escapeHtml(item.status)}</p>
      <p><strong>Owner:</strong> ${escapeHtml(item.owner)}</p>
      <p><strong>Due:</strong> ${escapeHtml(item.due)}</p>
      <p><strong>File:</strong> ${escapeHtml(item.fileName)}</p>
      <h4>Checklist</h4>
      ${renderChecklist(item.checklist)}
    </article>
  `;
}

function searchableText(item) {
  const tags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
  return `${item.id} ${item.title} ${item.owner} ${item.fileName} ${tags}`.toLowerCase();
}

function currentFilteredItems() {
  const query = searchEl.value.trim().toLowerCase();
  const owner = ownerFilterEl.value;

  return allItems.filter((item) => {
    if (owner && item.owner !== owner) return false;
    if (query && !searchableText(item).includes(query)) return false;
    return true;
  });
}

function renderBoard() {
  const items = currentFilteredItems();
  const groups = {
    todo: [],
    in_progress: [],
    done: [],
  };

  for (const item of items) {
    groups[toBoardStatus(item.status)].push(item);
  }

  colTodoEl.innerHTML = groups.todo.length
    ? groups.todo.map(itemCard).join("")
    : '<p class="empty">No items</p>';
  colInProgressEl.innerHTML = groups.in_progress.length
    ? groups.in_progress.map(itemCard).join("")
    : '<p class="empty">No items</p>';
  colDoneEl.innerHTML = groups.done.length
    ? groups.done.map(itemCard).join("")
    : '<p class="empty">No items</p>';

  countTodoEl.textContent = String(groups.todo.length);
  countInProgressEl.textContent = String(groups.in_progress.length);
  countDoneEl.textContent = String(groups.done.length);

  statusEl.textContent = `Showing ${items.length} item(s).`;
}

function hydrateOwnerFilter(items) {
  const owners = [...new Set(items.map((item) => item.owner).filter(Boolean))].sort();
  const previous = ownerFilterEl.value;
  ownerFilterEl.innerHTML = '<option value="">All owners</option>';
  owners.forEach((owner) => {
    const option = document.createElement("option");
    option.value = owner;
    option.textContent = owner;
    ownerFilterEl.appendChild(option);
  });
  if (owners.includes(previous)) ownerFilterEl.value = previous;
}

async function loadItems() {
  statusEl.textContent = "Loading data...";
  try {
    const response = await fetch("/api/work-items");
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || "Request failed");
    allItems = Array.isArray(data.items) ? data.items : [];
    hydrateOwnerFilter(allItems);
    renderBoard();
  } catch (error) {
    statusEl.textContent = `Failed: ${error.message}`;
    allItems = [];
    renderBoard();
  }
}

searchEl.addEventListener("input", renderBoard);
ownerFilterEl.addEventListener("change", renderBoard);
reloadBtn.addEventListener("click", loadItems);
loadItems();
