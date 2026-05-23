const fs = require("node:fs/promises");
const path = require("node:path");

const DATA_FILE = path.resolve(__dirname, "..", "docs", "yield-data", "data.json");

async function readAll() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeAll(records) {
  await fs.writeFile(DATA_FILE, JSON.stringify(records, null, 2) + "\n", "utf8");
}

async function addRecord(entry) {
  const records = await readAll();
  const maxNum = records.reduce((max, r) => {
    const m = String(r.id).match(/YD-(\d+)/);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const id = `YD-${String(maxNum + 1).padStart(4, "0")}`;

  const record = {
    id,
    date: String(entry.date || ""),
    product: String(entry.product || ""),
    lot: String(entry.lot || ""),
    station: String(entry.station || ""),
    input: Number(entry.input) || 0,
    good: Number(entry.good) || 0,
    defects: Array.isArray(entry.defects)
      ? entry.defects.map((d) => ({
          category: String(d.category || ""),
          count: Number(d.count) || 0,
        }))
      : [],
    note: String(entry.note || ""),
  };

  records.push(record);
  await writeAll(records);
  return record;
}

function computeYield(input, good) {
  if (!input || input <= 0) return null;
  return Math.round((good / input) * 10000) / 100;
}

function buildReport(records) {
  // Summary
  const totalInput = records.reduce((s, r) => s + r.input, 0);
  const totalGood = records.reduce((s, r) => s + r.good, 0);

  // By date
  const byDate = {};
  for (const r of records) {
    if (!byDate[r.date]) byDate[r.date] = { input: 0, good: 0 };
    byDate[r.date].input += r.input;
    byDate[r.date].good += r.good;
  }
  const trend = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      input: d.input,
      good: d.good,
      yieldRate: computeYield(d.input, d.good),
    }));

  // By station
  const byStation = {};
  for (const r of records) {
    if (!byStation[r.station]) byStation[r.station] = { input: 0, good: 0 };
    byStation[r.station].input += r.input;
    byStation[r.station].good += r.good;
  }
  const stations = Object.entries(byStation).map(([station, d]) => ({
    station,
    input: d.input,
    good: d.good,
    yieldRate: computeYield(d.input, d.good),
  }));

  // Defect Pareto
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
      category,
      count,
      percent: totalDefects ? Math.round((count / totalDefects) * 1000) / 10 : 0,
    }));

  return {
    summary: {
      totalInput,
      totalGood,
      yieldRate: computeYield(totalInput, totalGood),
      recordCount: records.length,
    },
    trend,
    stations,
    pareto,
  };
}

module.exports = { readAll, addRecord, buildReport, computeYield };
