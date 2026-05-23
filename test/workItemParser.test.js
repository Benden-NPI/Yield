const test = require("node:test");
const assert = require("node:assert/strict");
const { parseWorkItem } = require("../src/workItemParser");

test("parseWorkItem parses front matter and checklist", () => {
  const raw = `---
id: WI-0099
title: Parser Test
status: todo
owner: qa
due: 2026-06-30
tags:
  - parser
---
## Checklist

- [ ] first
- [x] second
`;

  const item = parseWorkItem(raw, "WI-0099.md");
  assert.equal(item.id, "WI-0099");
  assert.equal(item.title, "Parser Test");
  assert.deepEqual(item.tags, ["parser"]);
  assert.equal(item.checklist.length, 2);
  assert.equal(item.checklist[0].done, false);
  assert.equal(item.checklist[1].done, true);
});

test("parseWorkItem throws when required field is missing", () => {
  const raw = `---
id: WI-0100
title: Missing owner
status: todo
due: 2026-06-30
---
## Checklist
- [ ] test
`;
  assert.throws(() => parseWorkItem(raw, "WI-0100.md"), /Missing required field: owner/);
});

