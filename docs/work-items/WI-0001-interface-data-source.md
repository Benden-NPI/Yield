---
id: WI-0001
title: Configure interface to read repo work-items
status: in_progress
owner: platform
due: 2026-06-01
tags:
  - interface
  - data-source
updated_at: 2026-05-23T01:00:00Z
---

## Context

Switch interface source from local AI context to repository markdown files.

## Checklist

- [x] Fix canonical path to `docs/work-items/*.md`
- [ ] Add parser validation for required front matter
- [ ] Add cache refresh by latest commit SHA

## Notes

Cloud mode should support GitHub Contents API and raw URL reads.

