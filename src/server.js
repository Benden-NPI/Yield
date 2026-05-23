const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { parseWorkItem } = require("./workItemParser");
const { readAll, addRecord, updateRecord, deleteRecord, buildReport } = require("./yieldData");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = path.resolve(__dirname, "..");
const CLIENT_DIST_DIR = path.join(ROOT_DIR, "client", "dist");
const LEGACY_PUBLIC_DIR = path.join(ROOT_DIR, "public");
const WORK_ITEM_DIR = path.join(ROOT_DIR, "docs", "work-items");

async function pathExists(p) {
  try {
    const stat = await fs.stat(p);
    return stat.isFile();
  } catch {
    return false;
  }
}

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

  // 1. Prefer the React build output (client/dist) so the SPA is served on this port.
  const distCandidate = path.join(CLIENT_DIST_DIR, safePath);
  if (await pathExists(distCandidate)) {
    const data = await fs.readFile(distCandidate);
    res.writeHead(200, { "Content-Type": contentType(distCandidate) });
    res.end(data);
    return;
  }

  // 2. Fall back to the legacy static files in public/ (e.g. old yield.html / work-items board).
  const legacyCandidate = path.join(LEGACY_PUBLIC_DIR, safePath);
  if (await pathExists(legacyCandidate)) {
    const data = await fs.readFile(legacyCandidate);
    res.writeHead(200, { "Content-Type": contentType(legacyCandidate) });
    res.end(data);
    return;
  }

  // 3. SPA fallback: for non-asset GET requests, return the React index.html so client-side
  //    routing keeps working. Only fall back for paths without a file extension.
  const hasExtension = path.extname(safePath) !== "";
  const reactIndex = path.join(CLIENT_DIST_DIR, "index.html");
  if (!hasExtension && (await pathExists(reactIndex))) {
    const data = await fs.readFile(reactIndex);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(data);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
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

  // Yield records – PUT update
  if (url.startsWith("/api/yield/") && method === "PUT") {
    const id = url.slice("/api/yield/".length);
    if (!id) {
      jsonResponse(res, 400, { error: "Missing record id." });
      return;
    }
    try {
      const body = await readBody(req);
      const updates = JSON.parse(body);
      const record = await updateRecord(id, updates);
      if (!record) {
        jsonResponse(res, 404, { error: "Record not found." });
        return;
      }
      jsonResponse(res, 200, { record });
    } catch (error) {
      jsonResponse(res, 500, { error: "Failed to update yield entry.", detail: error.message });
    }
    return;
  }

  // Yield records – DELETE
  if (url.startsWith("/api/yield/") && method === "DELETE") {
    const id = url.slice("/api/yield/".length);
    if (!id) {
      jsonResponse(res, 400, { error: "Missing record id." });
      return;
    }
    try {
      const ok = await deleteRecord(id);
      if (!ok) {
        jsonResponse(res, 404, { error: "Record not found." });
        return;
      }
      jsonResponse(res, 200, { deleted: true });
    } catch (error) {
      jsonResponse(res, 500, { error: "Failed to delete yield entry.", detail: error.message });
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

server.listen(PORT, async () => {
  const hasDist = await pathExists(path.join(CLIENT_DIST_DIR, "index.html"));
  // eslint-disable-next-line no-console
  console.log(`Interface example running at http://localhost:${PORT}`);
  if (!hasDist) {
    // eslint-disable-next-line no-console
    console.warn(
      `[warn] client/dist/index.html not found. Run "npm run build:client" first to serve the React app. ` +
        `Falling back to legacy files in public/.`
    );
  }
});
