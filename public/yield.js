// ── Utilities ────────────────────────────────────────────────────────────────
function escapeHtml(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtRate(rate) {
  return rate === null || rate === undefined ? "—" : rate.toFixed(2) + "%";
}

function rateBar(rate) {
  if (rate === null || rate === undefined) return "";
  const pct = Math.min(100, Math.max(0, rate));
  const color = pct >= 95 ? "#22c55e" : pct >= 85 ? "#f59e0b" : "#ef4444";
  return `<div class="rate-bar-wrap"><div class="rate-bar" style="width:${pct}%;background:${color}"></div><span>${fmtRate(rate)}</span></div>`;
}

// ── State ────────────────────────────────────────────────────────────────────
let allRecords = [];
let defectCount = 0;

// ── Defect rows ──────────────────────────────────────────────────────────────
function addDefectRow(category = "", count = "") {
  defectCount += 1;
  const id = `defect-${defectCount}`;
  const row = document.createElement("div");
  row.className = "defect-row";
  row.dataset.defectId = id;
  row.innerHTML = `
    <input type="text" placeholder="不良類別" data-defect-category />
    <input type="number" placeholder="數量" min="0" data-defect-count />
    <button type="button" data-remove-defect>✕</button>
  `;
  row.querySelector("[data-defect-category]").value = category;
  row.querySelector("[data-defect-count]").value = count;
  row.querySelector("[data-remove-defect]").addEventListener("click", () => row.remove());
  document.getElementById("defectList").appendChild(row);
}

document.getElementById("addDefect").addEventListener("click", () => addDefectRow());

// ── Form submit ───────────────────────────────────────────────────────────────
const yieldForm = document.getElementById("yieldForm");
const formStatus = document.getElementById("formStatus");

yieldForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formStatus.textContent = "儲存中…";

  const data = Object.fromEntries(new FormData(yieldForm));

  const defects = [];
  document.querySelectorAll(".defect-row").forEach((row) => {
    const cat = row.querySelector("[data-defect-category]").value.trim();
    const cnt = Number(row.querySelector("[data-defect-count]").value);
    if (cat) defects.push({ category: cat, count: cnt });
  });

  const payload = { ...data, input: Number(data.input), good: Number(data.good), defects };

  try {
    const resp = await fetch("/api/yield", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    if (!resp.ok) {
      formStatus.textContent = "錯誤：" + (json.error || resp.statusText);
      return;
    }
    formStatus.textContent = `已儲存 ${json.record.id}`;
    yieldForm.reset();
    document.getElementById("defectList").innerHTML = "";
    defectCount = 0;
    await loadReport();
  } catch (err) {
    formStatus.textContent = "連線失敗：" + err.message;
  }
});

// ── Filters ───────────────────────────────────────────────────────────────────
function hydrateFilters(records) {
  const products = [...new Set(records.map((r) => r.product))].sort();
  const stations = [...new Set(records.map((r) => r.station))].sort();

  const filterProduct = document.getElementById("filterProduct");
  const filterStation = document.getElementById("filterStation");

  const prevP = filterProduct.value;
  const prevS = filterStation.value;

  filterProduct.innerHTML = '<option value="">所有產品</option>';
  products.forEach((p) => {
    const o = document.createElement("option");
    o.value = p;
    o.textContent = p;
    filterProduct.appendChild(o);
  });
  if (products.includes(prevP)) filterProduct.value = prevP;

  filterStation.innerHTML = '<option value="">所有製程站</option>';
  stations.forEach((s) => {
    const o = document.createElement("option");
    o.value = s;
    o.textContent = s;
    filterStation.appendChild(o);
  });
  if (stations.includes(prevS)) filterStation.value = prevS;
}

function filteredRecords() {
  const p = document.getElementById("filterProduct").value;
  const s = document.getElementById("filterStation").value;
  return allRecords.filter((r) => {
    if (p && r.product !== p) return false;
    if (s && r.station !== s) return false;
    return true;
  });
}

// ── Report render ─────────────────────────────────────────────────────────────
function computeYield(input, good) {
  if (!input || input <= 0) return null;
  return Math.round((good / input) * 10000) / 100;
}

function buildLocalReport(records) {
  const totalInput = records.reduce((s, r) => s + r.input, 0);
  const totalGood = records.reduce((s, r) => s + r.good, 0);

  const byDate = {};
  for (const r of records) {
    if (!byDate[r.date]) byDate[r.date] = { input: 0, good: 0 };
    byDate[r.date].input += r.input;
    byDate[r.date].good += r.good;
  }
  const trend = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, ...d, yieldRate: computeYield(d.input, d.good) }));

  const byStation = {};
  for (const r of records) {
    if (!byStation[r.station]) byStation[r.station] = { input: 0, good: 0 };
    byStation[r.station].input += r.input;
    byStation[r.station].good += r.good;
  }
  const stations = Object.entries(byStation).map(([station, d]) => ({
    station, ...d, yieldRate: computeYield(d.input, d.good),
  }));

  const defectMap = {};
  for (const r of records) {
    for (const d of r.defects || []) {
      defectMap[d.category] = (defectMap[d.category] || 0) + d.count;
    }
  }
  const totalDefects = Object.values(defectMap).reduce((s, c) => s + c, 0);
  const pareto = Object.entries(defectMap)
    .sort(([, a], [, b]) => b - a)
    .map(([category, count]) => ({
      category, count,
      percent: totalDefects ? Math.round((count / totalDefects) * 1000) / 10 : 0,
    }));

  return {
    summary: { totalInput, totalGood, yieldRate: computeYield(totalInput, totalGood), recordCount: records.length },
    trend,
    stations,
    pareto,
  };
}

function renderSummary(s) {
  document.getElementById("summaryYield").textContent = fmtRate(s.yieldRate);
  document.getElementById("summaryInput").textContent = s.totalInput.toLocaleString();
  document.getElementById("summaryGood").textContent = s.totalGood.toLocaleString();
  document.getElementById("summaryCount").textContent = s.recordCount;
}

function renderTableBody(tableId, rows) {
  document.querySelector(`#${tableId} tbody`).innerHTML = rows.join("");
}

function renderTrend(trend) {
  renderTableBody("trendTable", trend.map((t) => `
    <tr>
      <td>${escapeHtml(t.date)}</td>
      <td>${t.input.toLocaleString()}</td>
      <td>${t.good.toLocaleString()}</td>
      <td>${fmtRate(t.yieldRate)}</td>
      <td>${rateBar(t.yieldRate)}</td>
    </tr>
  `));
}

function renderStations(stations) {
  renderTableBody("stationTable", stations.map((s) => `
    <tr>
      <td>${escapeHtml(s.station)}</td>
      <td>${s.input.toLocaleString()}</td>
      <td>${s.good.toLocaleString()}</td>
      <td>${fmtRate(s.yieldRate)}</td>
      <td>${rateBar(s.yieldRate)}</td>
    </tr>
  `));
}

function renderPareto(pareto) {
  renderTableBody("paretoTable", pareto.map((p) => `
    <tr>
      <td>${escapeHtml(p.category)}</td>
      <td>${p.count}</td>
      <td>${p.percent}%</td>
      <td><div class="rate-bar-wrap"><div class="rate-bar" style="width:${p.percent}%;background:#6366f1"></div><span>${p.percent}%</span></div></td>
    </tr>
  `));
}

function renderRecords(records) {
  if (!records.length) {
    document.getElementById("recordsTable").innerHTML = "<p>無記錄</p>";
    return;
  }
  const rows = records
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => {
      const rate = computeYield(r.input, r.good);
      return `<tr>
        <td>${escapeHtml(r.id)}</td>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.product)}</td>
        <td>${escapeHtml(r.lot)}</td>
        <td>${escapeHtml(r.station)}</td>
        <td>${r.input}</td>
        <td>${r.good}</td>
        <td>${fmtRate(rate)}</td>
        <td>${escapeHtml(r.note || "")}</td>
      </tr>`;
    })
    .join("");
  document.getElementById("recordsTable").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>ID</th><th>日期</th><th>產品</th><th>批次</th><th>製程站</th>
          <th>投入</th><th>良品</th><th>良率</th><th>備注</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderReport(records) {
  const report = buildLocalReport(records);
  renderSummary(report.summary);
  renderTrend(report.trend);
  renderStations(report.stations);
  renderPareto(report.pareto);
  renderRecords(records);
}

// ── Load & wire ───────────────────────────────────────────────────────────────
async function loadReport() {
  try {
    const resp = await fetch("/api/yield");
    const data = await resp.json();
    allRecords = Array.isArray(data.records) ? data.records : [];
    hydrateFilters(allRecords);
    renderReport(filteredRecords());
  } catch (err) {
    document.getElementById("summaryYield").textContent = "錯誤";
    console.error(err);
  }
}

document.getElementById("filterProduct").addEventListener("change", () => renderReport(filteredRecords()));
document.getElementById("filterStation").addEventListener("change", () => renderReport(filteredRecords()));
document.getElementById("refreshReport").addEventListener("click", loadReport);

loadReport();
