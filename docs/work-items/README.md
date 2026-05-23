# Work Items Data Source

This directory is the raw data source of truth for work management.

## File location

- Absolute path: `/tmp/workspace/Benden-NPI/Yield/docs/work-items`
- File pattern: `*.md`

## Markdown schema

Each work-item file must use:

1. YAML front matter
2. Markdown body with a `## Checklist` section

Required front matter fields:

- `id`: unique stable id (string)
- `title`: short task title (string)
- `status`: one of `todo | in_progress | blocked | done`
- `owner`: task owner (string)
- `due`: ISO date `YYYY-MM-DD`

Optional fields:

- `tags`: array of strings
- `updated_at`: ISO 8601 timestamp

## Template

Use `/tmp/workspace/Benden-NPI/Yield/docs/work-items/_template.md`.

## Interface read modes

### 1) Cloud interface (GitHub as source)

- Read files from repository via GitHub Contents API.
- Or read rendered raw content from the repository raw URL.

### 2) Self-hosted backend

- Periodically run `git pull`.
- Parse files in `docs/work-items/*.md`.

### 3) Local live-read mode

- Interface reads work-item files directly from a local clone path.
- This enables local immediate preview while still keeping Git as source of truth.

## Sync trigger options

- Webhook mode: refresh cache after push/merge events.
- Polling mode: check latest commit SHA periodically and reload on changes.

