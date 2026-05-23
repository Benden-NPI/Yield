const REQUIRED_FIELDS = ["id", "title", "status", "owner", "due"];

function extractFrontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    throw new Error("Missing YAML front matter block.");
  }
  return {
    frontMatter: match[1],
    body: raw.slice(match[0].length),
  };
}

function normalizeScalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseSimpleYaml(frontMatter) {
  const lines = frontMatter.split(/\r?\n/);
  const data = {};

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;

    const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!kv) continue;

    const key = kv[1];
    const rawValue = kv[2];

    if (rawValue === "") {
      const arr = [];
      let j = i + 1;
      while (j < lines.length) {
        const item = lines[j].match(/^\s*-\s*(.*)$/);
        if (!item) break;
        arr.push(normalizeScalar(item[1]));
        j += 1;
      }
      data[key] = arr;
      i = j - 1;
      continue;
    }

    data[key] = normalizeScalar(rawValue);
  }

  return data;
}

function parseChecklist(body) {
  const section = body.match(
    /(?:^|\n)##\s+Checklist\s*\n([\s\S]*?)(?:\n##\s+|\n?$)/
  );
  if (!section) return [];

  return section[1]
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s*\[([xX ])\]\s*(.+)$/))
    .filter(Boolean)
    .map((item) => ({
      done: item[1].toLowerCase() === "x",
      text: item[2].trim(),
    }));
}

function parseWorkItem(raw, fileName) {
  const { frontMatter, body } = extractFrontMatter(raw);
  const meta = parseSimpleYaml(frontMatter);

  for (const field of REQUIRED_FIELDS) {
    if (!meta[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return {
    ...meta,
    checklist: parseChecklist(body),
    fileName,
  };
}

module.exports = {
  parseWorkItem,
  parseSimpleYaml,
  parseChecklist,
};

