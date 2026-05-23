const test = require("node:test");
const assert = require("node:assert/strict");
const { buildReport, computeYield } = require("../src/yieldData");

const SAMPLE_RECORDS = [
  {
    id: "YD-0001",
    date: "2026-05-20",
    product: "ProductA",
    lot: "LOT-001",
    station: "SMT",
    input: 500,
    good: 485,
    defects: [
      { category: "Solder Bridge", count: 8 },
      { category: "Missing Component", count: 5 },
      { category: "Tombstone", count: 2 },
    ],
    note: "",
  },
  {
    id: "YD-0002",
    date: "2026-05-21",
    product: "ProductA",
    lot: "LOT-002",
    station: "SMT",
    input: 500,
    good: 492,
    defects: [
      { category: "Solder Bridge", count: 5 },
      { category: "Missing Component", count: 3 },
    ],
    note: "",
  },
  {
    id: "YD-0003",
    date: "2026-05-21",
    product: "ProductA",
    lot: "LOT-002",
    station: "AOI",
    input: 492,
    good: 488,
    defects: [
      { category: "Solder Bridge", count: 3 },
      { category: "Open Circuit", count: 1 },
    ],
    note: "",
  },
];

test("computeYield calculates correct percentage", () => {
  assert.equal(computeYield(500, 485), 97);
  assert.equal(computeYield(0, 0), null);
  assert.equal(computeYield(null, 100), null);
});

test("buildReport summary totals are correct", () => {
  const report = buildReport(SAMPLE_RECORDS);
  assert.equal(report.summary.totalInput, 1492);
  assert.equal(report.summary.totalGood, 1465);
  assert.equal(report.summary.recordCount, 3);
});

test("buildReport trend groups by date ascending", () => {
  const report = buildReport(SAMPLE_RECORDS);
  assert.equal(report.trend[0].date, "2026-05-20");
  assert.equal(report.trend[1].date, "2026-05-21");
  assert.equal(report.trend[1].input, 992); // 500 + 492
});

test("buildReport stations aggregates correctly", () => {
  const report = buildReport(SAMPLE_RECORDS);
  const smt = report.stations.find((s) => s.station === "SMT");
  const aoi = report.stations.find((s) => s.station === "AOI");
  assert.ok(smt, "SMT should exist");
  assert.equal(smt.input, 1000);
  assert.equal(smt.good, 977);
  assert.ok(aoi, "AOI should exist");
});

test("buildReport pareto sorts by count descending", () => {
  const report = buildReport(SAMPLE_RECORDS);
  const first = report.pareto[0];
  const second = report.pareto[1];
  assert.ok(first.count >= second.count, "Pareto should be sorted descending");
  assert.equal(first.category, "Solder Bridge"); // 8+5+3 = 16
});
