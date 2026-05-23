const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { parseWorkItem } = require("./workItemParser");

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

const server = http.createServer(async (req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  if (req.url === "/api/work-items") {
    try {
      const items = await readWorkItems();
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ items }, null, 2));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: "Failed to parse work items.",
          detail: error.message,
        })
      );
    }
    return;
  }

  await serveStatic(req, res);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Interface example running at http://localhost:${PORT}`);
});

