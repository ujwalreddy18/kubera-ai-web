# KUBERA AI — Web Edition

A browser version of [KUBERA AI](https://github.com/KundanSadhu/KUBERA-AI), the local-first business-operations workspace. You state a business goal, a manager agent deploys a fixed, capability-limited team, and the team produces a real Office file from your local records.

> **File first, chat second.** The output is an openable PPTX, DOCX or XLSX, not a long chat reply.

## Run it

It is one static file. Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

To host it free, turn on **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root).

## Features

**From the original README**
- Missions: type a goal, e.g. `Build a Q3 pipeline deck for Acme Corp`
- Workforce: Asha (Manager), Maya (Market Analyst), W-1 (Operations Analyst), W-2 (Document Worker), Sentinel (Reviewer)
- Report Center with PPTX / DOCX / XLSX badges
- Business records: clients and projects
- Schedules with cron, timezone and next run
- Activity / audit feed, settings, reset demo data

**Added in this edition**
- Real file generation in the browser: 6-slide PPTX with chart and table, DOCX account report, XLSX workbook with SUM / SUMIF formulas
- Live task graph: Manager → Analysts → Document Worker → Reviewer, with handoffs and cancel
- Sentinel checks (Office package header, file type, size, provenance) before a file reaches you
- Human approval queue: approve, or reject with required feedback and re-run with that feedback
- KPI strip and pipeline-by-stage chart (live, weighted, at-risk, closed won)
- Records: add / edit / delete, search, stage filter, sortable columns, all-or-nothing CSV import with line-level errors, CSV export
- Working cron parser with next-run preview; due schedules start a mission while the page is open
- Fixed agent pool with least-load assignment; one manager at a time, missions queue
- Command menu (`Ctrl K`), light / dark / auto theme, USD / INR / EUR, JSON backup and restore, audit log export
- Optional Claude-written analyst narrative when opened inside Claude (figures always computed locally)
- Mobile bottom navigation, 44 px touch targets, tables become cards on phones, inline form errors, focus-trapped dialogs, AA contrast

## Stack

Vanilla HTML / CSS / JS, no build step. Office files via [PptxGenJS](https://github.com/gitbrent/PptxGenJS), [docx](https://github.com/dolanmiu/docx) and [SheetJS](https://sheetjs.com) from CDNs. Data stays in `localStorage`.

## Credit

Based on [KundanSadhu/KUBERA-AI](https://github.com/KundanSadhu/KUBERA-AI) (Apache-2.0).
