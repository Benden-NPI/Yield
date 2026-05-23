# Yield

Git repo can be used as the source of truth for work-management markdown data.

## Work item data source

- Directory: `/tmp/workspace/Benden-NPI/Yield/docs/work-items`
- Pattern: `*.md`
- Format: YAML front matter + markdown checklist body

See `/tmp/workspace/Benden-NPI/Yield/docs/work-items/README.md` for schema and access modes.

## Interface example

A minimal interface example is included and reads:

- `/tmp/workspace/Benden-NPI/Yield/docs/work-items/*.md`

Run:

1. `cd /tmp/workspace/Benden-NPI/Yield`
2. `npm start`
3. Open `http://localhost:3000`

API endpoint:

- `GET /api/work-items`

UI features:

- Kanban board columns: `Todo`, `In Progress`, `Done`
- Search by id/title/owner/file/tags
- Owner filter dropdown

## Yield management interface

Navigate to `http://localhost:3000/yield.html` to use the yield management system.

Features:
- Input form for yield records (product / lot / station / quantity / defect categories)
- Auto-generated report: overall yield summary, daily trend, yield by station, defect Pareto
- Filter by product and station
