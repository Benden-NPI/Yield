const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { parseWorkItem } = require("./workItemParser");
const { readAll, addRecord, buildReport } = require("./yieldData");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const WORK_ITEM_DIR = path.join(ROOT_DIR, "docs", "work-items");

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readWorkItems() {
  const files = await fs.readdir(WORK_ITEM_DIR);
  const candidates = files.filter(
    (name) => name.endsWith(".md") && !name.startsWith("_") && name !== "README.md"
  );

  const parsed = await Promise.all(
    candidates.map(async (fileName) => {
      const fullPath = path.join(WORK_ITEM_DIR, fileName);
      const raw = await fs.readFile(fullPath, "utf8");
      return parseWorkItem(raw, fileName);
    })
  );

  return parsed.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

async function serveStatic(req, res) {
  const pathname = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  const method = req.method;

  // Work items
  if (url === "/api/work-items" && method === "GET") {
    try {
      const items = await readWorkItems();
      jsonResponse(res, 200, { items });
    } catch (error) {
      jsonResponse(res, 500, { error: "Failed to parse work items.", detail: error.message });
    }
    return;
  }

  // Yield records – GET all
  if (url === "/api/yield" && method === "GET") {
    try {
      const records = await readAll();
      jsonResponse(res, 200, { records });
    } catch (error) {
      jsonResponse(res, 500, { error: "Failed to read yield data.", detail: error.message });
    }
    return;
  }

  // Yield records – POST new entry
  if (url === "/api/yield" && method === "POST") {
    try {
      const body = await readBody(req);
      const entry = JSON.parse(body);

      const REQUIRED = ["date", "product", "lot", "station", "input", "good"];
      for (const field of REQUIRED) {
        if (entry[field] === undefined || entry[field] === "") {
          jsonResponse(res, 400, { error: `Missing required field: ${field}` });
          return;
        }
      }
      if (Number(entry.good) > Number(entry.input)) {
        jsonResponse(res, 400, { error: "Good quantity cannot exceed input quantity." });
        return;
      }

      const record = await addRecord(entry);
      jsonResponse(res, 201, { record });
    } catch (error) {
      jsonResponse(res, 500, { error: "Failed to save yield entry.", detail: error.message });
    }
    return;
  }

  // Yield report
  if (url === "/api/yield/report" && method === "GET") {
    try {
      const records = await readAll();
      const report = buildReport(records);
      jsonResponse(res, 200, report);
    } catch (error) {
      jsonResponse(res, 500, { error: "Failed to generate report.", detail: error.message });
    }
    return;
  }

  if (method !== "GET") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  await serveStatic(req, res);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Interface example running at http://localhost:${PORT}`);
});
