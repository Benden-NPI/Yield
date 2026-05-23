---
id: WI-0002
title: Add sync trigger for work-item reload
status: todo
owner: backend
due: 2026-06-05
tags:
  - sync
  - webhook
updated_at: 2026-05-23T01:00:00Z
---

## Context

Reload parsed work-item state when repository data changes.

## Checklist

- [ ] Implement webhook endpoint for push events
- [ ] Add polling fallback for environments without webhook
- [ ] Add reload observability logs

## Notes

If webhook is unavailable, polling interval can be 1-5 minutes.

