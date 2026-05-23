const itemsEl = document.getElementById("items");
const statusEl = document.getElementById("status");
const reloadBtn = document.getElementById("reload");

function renderChecklist(checklist) {
  if (!Array.isArray(checklist) || checklist.length === 0) return "<em>No checklist</em>";
  const list = checklist
    .map((item) => `<li>${item.done ? "✅" : "⬜"} ${item.text}</li>`)
    .join("");
  return `<ul>${list}</ul>`;
}

function renderItems(items) {
  if (!items.length) {
    itemsEl.innerHTML = "<p>No work items found.</p>";
    return;
  }

  itemsEl.innerHTML = items
    .map(
      (item) => `
      <article class="card">
        <h2>${item.id} · ${item.title}</h2>
        <p><strong>Status:</strong> ${item.status}</p>
        <p><strong>Owner:</strong> ${item.owner}</p>
        <p><strong>Due:</strong> ${item.due}</p>
        <p><strong>File:</strong> ${item.fileName}</p>
        <h3>Checklist</h3>
        ${renderChecklist(item.checklist)}
      </article>
    `
    )
    .join("");
}

async function loadItems() {
  statusEl.textContent = "Loading...";
  try {
    const response = await fetch("/api/work-items");
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || "Request failed");
    renderItems(data.items || []);
    statusEl.textContent = `Loaded ${data.items.length} item(s).`;
  } catch (error) {
    statusEl.textContent = `Failed: ${error.message}`;
    itemsEl.innerHTML = "";
  }
}

reloadBtn.addEventListener("click", loadItems);
loadItems();

